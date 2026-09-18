"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BellRing,
  CircleDollarSign,
  Clock3,
  History,
  Plus,
  Search,
  Target,
  WalletCards,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel, money, numberValue } from "@/lib/plan-math";
import type { AccountHistory, FinancialProfile, Mission, Opportunity } from "@/lib/types";

type ReminderPreference = "all" | "important" | "off";

function dateOnly(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function daysUntil(value?: string | null) {
  const target = dateOnly(value);
  if (!target) return null;
  const today = dateOnly(new Date().toISOString().slice(0, 10));
  if (!today) return null;
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function compactDate(value?: string | null) {
  const date = dateOnly(value);
  if (!date) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function missionCategory(mission: Mission) {
  return mission.opportunity ? categoryLabel(mission.opportunity) : "Tracked offer";
}

function missionProgress(mission: Mission) {
  if (!mission.opened_at) return { percent: 0, label: "Waiting to start", sub: "Confirm the real opening date" };

  if (mission.benefit_start_date && mission.benefit_end_date) {
    const start = dateOnly(mission.benefit_start_date);
    const end = dateOnly(mission.benefit_end_date);
    const today = dateOnly(new Date().toISOString().slice(0, 10));
    if (start && end && today) {
      const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
      const elapsedDays = Math.max(0, Math.min(totalDays, Math.ceil((today.getTime() - start.getTime()) / 86_400_000)));
      const remainingDays = Math.max(0, totalDays - elapsedDays);
      const totalMonths = Math.max(1, Math.round(totalDays / 30.4375));
      const currentMonth = Math.min(totalMonths, Math.max(1, Math.floor(elapsedDays / 30.4375) + 1));
      const monthsLeft = Math.max(0, Math.ceil(remainingDays / 30.4375));
      return {
        percent: Math.min(100, Math.round((elapsedDays / totalDays) * 100)),
        label: `Month ${currentMonth} of ${totalMonths}`,
        sub: remainingDays <= 0 ? "Benefit period reached" : monthsLeft <= 1 ? `${remainingDays} days left` : `${monthsLeft} months left`,
      };
    }
  }

  const deadline = mission.qualification_deadline || mission.payout_due_date || mission.safe_close_review_date;
  const left = daysUntil(deadline);
  if (left === null) return { percent: 0, label: "Active", sub: "No timed deadline stored" };

  const start = dateOnly(mission.opened_at);
  const end = dateOnly(deadline);
  const today = dateOnly(new Date().toISOString().slice(0, 10));
  let percent = 0;
  if (start && end && today && end.getTime() > start.getTime()) {
    const total = end.getTime() - start.getTime();
    const elapsed = Math.max(0, Math.min(total, today.getTime() - start.getTime()));
    percent = Math.round((elapsed / total) * 100);
  }
  return {
    percent,
    label: left <= 0 ? "Deadline reached" : `${left} days left`,
    sub: deadline ? `Next date · ${compactDate(deadline)}` : "Active",
  };
}

export function PersonalPlanDashboard({
  missions,
  opportunities,
  accountHistory,
  reminderPreference,
  profile,
}: {
  missions: Mission[];
  opportunities: Opportunity[];
  accountHistory: AccountHistory[];
  reminderPreference: ReminderPreference;
  profile: FinancialProfile;
}) {
  const router = useRouter();
  const [globalReminder, setGlobalReminder] = useState<ReminderPreference>(reminderPreference || "off");
  const [reminderSaving, setReminderSaving] = useState(false);
  const [missionReminderState, setMissionReminderState] = useState<Record<string, boolean | null>>(
    Object.fromEntries(missions.map((mission) => [mission.id, mission.email_reminders_enabled ?? null])),
  );
  const [historyRows, setHistoryRows] = useState<AccountHistory[]>(accountHistory);
  const [search, setSearch] = useState("");
  const [selectedOffer, setSelectedOffer] = useState<Opportunity | null>(null);
  const [manualInstitution, setManualInstitution] = useState("");
  const [historySaving, setHistorySaving] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");
  const [historyRemovingId, setHistoryRemovingId] = useState<string | null>(null);

  const active = useMemo(
    () => missions.filter((mission) => !["complete", "cancelled"].includes(mission.status)),
    [missions],
  );
  const trackedCash = active.reduce((sum, mission) => sum + numberValue(mission.amount_committed), 0);
  const potentialRewards = active.reduce((sum, mission) => sum + numberValue(mission.expected_bonus) + numberValue(mission.expected_interest), 0);
  const totalCash = Math.max(0, numberValue(profile.total_cash));
  const protectedReserve = Math.min(totalCash, Math.max(0, numberValue(profile.emergency_reserve)));
  const availableToOptimize = Math.max(0, totalCash - protectedReserve);
  const monthlyDdStream = Math.max(0, numberValue(profile.biweekly_pay)) * (26 / 12);
  const endingSoon = active.filter((mission) => {
    const left = daysUntil(mission.benefit_end_date || mission.qualification_deadline);
    return left !== null && left >= 0 && left <= 30;
  }).length;

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return opportunities
      .filter((item) => `${item.institution} ${item.product_name}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [opportunities, search]);

  async function saveGlobalReminder(value: ReminderPreference) {
    setGlobalReminder(value);
    setReminderSaving(true);
    const supabase = createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (userId) {
      await supabase.from("financial_profiles").update({ reminder_preference: value, updated_at: new Date().toISOString() }).eq("user_id", userId);
    }
    setReminderSaving(false);
  }

  async function setMissionReminder(missionId: string, value: "default" | "on" | "off") {
    const next = value === "on" ? true : value === "off" ? false : null;
    setMissionReminderState((current) => ({ ...current, [missionId]: next }));
    const supabase = createClient();
    await supabase.from("missions").update({ email_reminders_enabled: next, updated_at: new Date().toISOString() }).eq("id", missionId);
  }

  async function saveHistory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const institution = selectedOffer?.institution || manualInstitution.trim();
    if (!institution) return;
    setHistorySaving(true);
    setHistoryMessage("");

    const form = new FormData(event.currentTarget);
    const bonusAnswer = String(form.get("bonus_received") || "unknown");
    const supabase = createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (!userId) {
      setHistorySaving(false);
      return;
    }

    const payload = {
      user_id: userId,
      opportunity_id: selectedOffer?.id || null,
      institution,
      product_name: selectedOffer?.product_name || String(form.get("product_name") || "Older / other offer"),
      opened_at: form.get("opened_at") ? String(form.get("opened_at")) : null,
      closed_at: form.get("closed_at") ? String(form.get("closed_at")) : null,
      bonus_received: bonusAnswer === "yes" ? true : bonusAnswer === "no" ? false : null,
      bonus_amount: 0,
      outcome: form.get("closed_at") ? "closed_good_standing" : "other",
      notes: "Prior offer added from My Plan history search",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("account_history").insert(payload).select("*").single();
    if (error) {
      setHistoryMessage("Could not save that history yet. Please try again.");
    } else if (data) {
      setHistoryRows((current) => [data as AccountHistory, ...current]);
      setHistoryMessage("Saved. We’ll use it when checking future eligibility.");
      setSelectedOffer(null);
      setManualInstitution("");
      setSearch("");
      event.currentTarget.reset();
    }
    setHistorySaving(false);
  }

  async function removeHistory(row: AccountHistory) {
    setHistoryRemovingId(row.id);
    setHistoryMessage("");
    const supabase = createClient();
    const { error } = await supabase.from("account_history").delete().eq("id", row.id);
    if (error) {
      setHistoryMessage("Could not remove that previous offer yet.");
    } else {
      setHistoryRows((current) => current.filter((item) => item.id !== row.id));
      setHistoryMessage(`${row.institution} removed from previous offers.`);
      router.refresh();
    }
    setHistoryRemovingId(null);
  }

  return (
    <section className="personal-plan-dashboard">
      <div className="personal-dashboard-head">
        <div>
          <span className="kicker">YOUR DASHBOARD</span>
          <h1>Your Cash & Bonus Command Center.</h1>
          <p>See your money, bonus opportunities, active requirements, and what needs attention next.</p>
        </div>
        <label className="dashboard-reminder-setting">
          <span><BellRing size={14} /> Email reminders</span>
          <select value={globalReminder} onChange={(event) => saveGlobalReminder(event.target.value as ReminderPreference)} disabled={reminderSaving}>
            <option value="important">Important only</option>
            <option value="all">All reminders</option>
            <option value="off">Off</option>
          </select>
        </label>
      </div>

      <div className="personal-dashboard-stats">
        <article><WalletCards size={18} /><span><small>Cash tracked</small><strong>{money.format(trackedCash)}</strong></span></article>
        <article><Target size={18} /><span><small>Active rewards</small><strong>{active.length}</strong></span></article>
        <article><CircleDollarSign size={18} /><span><small>Potential rewards</small><strong>{money.format(potentialRewards)}</strong></span></article>
        <article className={endingSoon ? "attention" : ""}><Clock3 size={18} /><span><small>Ending in 30 days</small><strong>{endingSoon}</strong></span></article>
      </div>

      <div className="dashboard-money-picture">
        <div><small>Total liquid cash</small><strong>{money.format(totalCash)}</strong></div>
        <div><small>Protected reserve</small><strong>{money.format(protectedReserve)}</strong></div>
        <div><small>Cash after reserve</small><strong>{money.format(availableToOptimize)}</strong></div>
        <div><small>Monthly DD stream</small><strong>{money.format(monthlyDdStream)}</strong><span>from your paycheck input</span></div>
      </div>

      <div className="dashboard-tracking-block">
        <div className="dashboard-section-title"><div><span>ACTIVE TRACKING</span><h2>Your live benefit clocks</h2></div><b>{active.length} active</b></div>
        {active.length ? (
          <div className="dashboard-tracking-list">
            {active.slice(0, 4).map((mission) => {
              const progress = missionProgress(mission);
              const reminder = missionReminderState[mission.id];
              return (
                <article key={mission.id}>
                  <div className="tracking-main">
                    <div className="tracking-title"><span>{missionCategory(mission)}</span><strong>{mission.institution} · {mission.title}</strong></div>
                    <div className="tracking-progress"><span style={{ width: `${progress.percent}%` }} /></div>
                    <div className="tracking-foot"><b>{progress.label}</b><span>{progress.sub}</span></div>
                  </div>
                  <label className="tracking-reminder">
                    <small>Reminder</small>
                    <select value={reminder === true ? "on" : reminder === false ? "off" : "default"} onChange={(event) => setMissionReminder(mission.id, event.target.value as "default" | "on" | "off")}>
                      <option value="default">Default</option>
                      <option value="on">On</option>
                      <option value="off">Off</option>
                    </select>
                  </label>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-empty-track"><Clock3 size={22} /><div><strong>Nothing being tracked yet.</strong><span>Your first added offer will show its real countdown here.</span></div></div>
        )}
      </div>

      <div className="dashboard-history">
        <div className="dashboard-section-title"><div><span>PREVIOUS OFFERS</span><h2>Help us avoid repeat-ineligible offers</h2></div><b>{historyRows.length} saved</b></div>
        <div className="history-search-wrap">
          <Search size={16} />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setSelectedOffer(null); setManualInstitution(""); }} placeholder="Search a bank or offer, like Chase…" />
        </div>

        {matches.length > 0 && search.trim().length >= 2 ? (
          <div className="history-search-results">
            {matches.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedOffer(item); setManualInstitution(""); }}><span>{item.institution}</span><b>{item.product_name}</b><small>{categoryLabel(item)}</small></button>)}
            <button type="button" onClick={() => { setSelectedOffer(null); setManualInstitution(search.trim()); }}><span>Older / other offer</span><b>{search.trim()}</b><small>Add manually</small></button>
          </div>
        ) : search.trim().length >= 2 ? (
          <button className="history-manual-button" type="button" onClick={() => { setSelectedOffer(null); setManualInstitution(search.trim()); }}><Plus size={14} /> Add “{search.trim()}” as an older offer</button>
        ) : null}

        {(selectedOffer || manualInstitution) ? (
          <form className="history-mini-form" onSubmit={saveHistory}>
            <div className="history-selected"><History size={16} /><span><small>Selected</small><strong>{selectedOffer ? `${selectedOffer.institution} · ${selectedOffer.product_name}` : manualInstitution}</strong></span></div>
            {!selectedOffer ? <label><span>Offer name <em>optional</em></span><input name="product_name" placeholder="Older / other offer" /></label> : null}
            <label><span>Opened <em>optional</em></span><input name="opened_at" type="date" /></label>
            <label><span>Closed <em>optional</em></span><input name="closed_at" type="date" /></label>
            <label><span>Received bonus?</span><select name="bonus_received" defaultValue="unknown"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></label>
            <button className="button primary compact" type="submit" disabled={historySaving}>{historySaving ? "Saving…" : "Save history"}</button>
          </form>
        ) : null}
        {historyMessage ? <small className="history-message">{historyMessage}</small> : null}
        {historyRows.length ? <div className="history-chips">{historyRows.slice(0, 8).map((row) => {
          const removable = row.notes === "Reported during onboarding" || row.notes === "Prior offer added from My Plan history search";
          return <span className="history-chip" key={row.id}><span>{row.institution}{row.product_name ? ` · ${row.product_name}` : ""}</span>{removable ? <button type="button" onClick={() => removeHistory(row)} disabled={historyRemovingId === row.id} aria-label={`Remove ${row.institution} from previous offers`} title="Remove mistaken previous offer"><X size={12} /></button> : null}</span>;
        })}</div> : null}
      </div>
    </section>
  );
}
