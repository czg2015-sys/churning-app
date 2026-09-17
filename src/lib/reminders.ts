import "server-only";

import { createResearchAdminClient } from "@/lib/research/server";

type ReminderLevel = "all" | "important" | "off";

type MissionRow = {
  id: string;
  user_id: string;
  institution: string;
  title: string;
  status: string;
  qualification_deadline: string | null;
  benefit_end_date: string | null;
  payout_due_date: string | null;
  safe_close_review_date: string | null;
  email_reminders_enabled: boolean | null;
  mission_steps?: Array<{ step_type: string; label: string; is_complete: boolean }> | null;
};

type ReminderRule = {
  type: string;
  targetDate: string;
  daysBefore: number;
  title: string;
  message: string;
};

function dateAtNoon(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00Z`);
}

function daysUntil(target: string, today: string) {
  return Math.ceil((dateAtNoon(target).getTime() - dateAtNoon(today).getTime()) / 86_400_000);
}

function scheduleFor(level: ReminderLevel, kind: "benefit" | "qualification" | "payout" | "review") {
  if (level === "off") return [];
  if (level === "important") {
    if (kind === "benefit") return [30, 10, 3, 1, 0];
    if (kind === "qualification") return [10, 3, 1, 0];
    if (kind === "payout") return [7, 0];
    return [7, 0];
  }
  if (kind === "benefit") return [60, 30, 14, 10, 7, 3, 1, 0];
  if (kind === "qualification") return [30, 14, 10, 7, 3, 1, 0];
  if (kind === "payout") return [14, 7, 3, 1, 0];
  return [14, 7, 3, 1, 0];
}

function effectiveLevel(globalLevel: ReminderLevel, override: boolean | null) {
  if (override === false) return "off" as const;
  if (override === true) return globalLevel === "off" ? "important" as const : globalLevel;
  return globalLevel;
}

function formatDays(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function rulesForMission(mission: MissionRow, level: ReminderLevel, today: string): ReminderRule[] {
  const rules: ReminderRule[] = [];
  const incompleteDd = (mission.mission_steps || []).some((step) =>
    !step.is_complete && (step.step_type === "direct_deposit" || step.label.toLowerCase().includes("direct deposit"))
  );

  const addIfDue = (
    kind: "benefit" | "qualification" | "payout" | "review",
    type: string,
    targetDate: string | null,
    title: string,
    message: (days: number) => string,
  ) => {
    if (!targetDate) return;
    const days = daysUntil(targetDate, today);
    if (!scheduleFor(level, kind).includes(days)) return;
    rules.push({ type, targetDate, daysBefore: days, title, message: message(days) });
  };

  addIfDue(
    "benefit",
    "benefit_ending",
    mission.benefit_end_date,
    `${mission.institution} benefit ending soon`,
    (days) => `${mission.title}'s limited benefit period ends ${formatDays(days)}. Review where you want the money next before the benefit runs out.`,
  );

  addIfDue(
    "qualification",
    incompleteDd ? "dd_deadline" : "qualification_deadline",
    mission.qualification_deadline,
    incompleteDd ? `Check your ${mission.institution} direct deposit` : `${mission.institution} qualification deadline`,
    (days) => incompleteDd
      ? `Your direct-deposit window reaches its deadline ${formatDays(days)}. Check the tracker against deposits that actually posted.`
      : `Your qualification window reaches its deadline ${formatDays(days)}. Confirm the requirements from your actual account activity.`,
  );

  addIfDue(
    "payout",
    "payout_check",
    mission.payout_due_date,
    `Check for your ${mission.institution} reward`,
    (days) => `Your stored payout review date is ${formatDays(days)}. Check whether the reward posted before marking it received.`,
  );

  addIfDue(
    "review",
    "account_review",
    mission.safe_close_review_date,
    `${mission.institution} account review`,
    (days) => `Your earliest Churning review date is ${formatDays(days)}. Re-check current terms before moving money, downgrading, or closing anything.`,
  );

  return rules;
}

async function sendEmail(to: string, subject: string, message: string) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.REMINDER_FROM_EMAIL || "").trim();
  if (!apiKey || !from) return { sent: false, reason: "email_not_configured" as const };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: `${message}\n\nOpen My Plan to review your tracker: https://churning-app.vercel.app/my-plan`,
    }),
  });

  if (!response.ok) {
    return { sent: false, reason: `email_http_${response.status}` as const };
  }
  return { sent: true, reason: null };
}

export async function runReminderSweep() {
  const supabase = createResearchAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: missions, error: missionError }, { data: profiles, error: profileError }] = await Promise.all([
    supabase
      .from("missions")
      .select("id,user_id,institution,title,status,qualification_deadline,benefit_end_date,payout_due_date,safe_close_review_date,email_reminders_enabled,mission_steps(step_type,label,is_complete)")
      .in("status", ["planned", "active", "qualified", "payout_pending"]),
    supabase
      .from("financial_profiles")
      .select("user_id,reminder_preference"),
  ]);
  if (missionError) throw missionError;
  if (profileError) throw profileError;

  const preferenceByUser = new Map(
    (profiles || []).map((row) => [row.user_id as string, (row.reminder_preference || "important") as ReminderLevel]),
  );

  let created = 0;
  let emailed = 0;
  let inAppOnly = 0;

  for (const mission of (missions || []) as MissionRow[]) {
    const level = effectiveLevel(preferenceByUser.get(mission.user_id) || "important", mission.email_reminders_enabled);
    if (level === "off") continue;

    const rules = rulesForMission(mission, level, today);
    if (!rules.length) continue;

    let email: string | null = null;
    if (process.env.RESEND_API_KEY && process.env.REMINDER_FROM_EMAIL) {
      const { data } = await supabase.auth.admin.getUserById(mission.user_id);
      email = data.user?.email || null;
    }

    for (const rule of rules) {
      const { data: inserted, error } = await supabase
        .from("reminder_notifications")
        .insert({
          user_id: mission.user_id,
          mission_id: mission.id,
          reminder_type: rule.type,
          target_date: rule.targetDate,
          days_before: rule.daysBefore,
          title: rule.title,
          message: rule.message,
          channel: email ? "email" : "in_app",
          email_status: email ? "pending" : "not_configured",
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") continue;
        throw error;
      }
      if (!inserted) continue;
      created += 1;

      if (!email) {
        inAppOnly += 1;
        continue;
      }

      const result = await sendEmail(email, rule.title, rule.message);
      if (result.sent) {
        emailed += 1;
        await supabase.from("reminder_notifications").update({
          email_status: "sent",
          sent_at: new Date().toISOString(),
        }).eq("id", inserted.id);
      } else {
        inAppOnly += 1;
        await supabase.from("reminder_notifications").update({
          email_status: result.reason || "failed",
        }).eq("id", inserted.id);
      }
    }
  }

  return { status: "completed", created, emailed, inAppOnly };
}
