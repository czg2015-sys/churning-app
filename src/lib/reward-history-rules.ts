import { numberValue } from "@/lib/plan-math";
import type { AccountHistory, Mission, MissionStep } from "@/lib/types";

type DatedMission = Mission & { created_at?: string | null; updated_at?: string | null };
type DatedStep = MissionStep & { updated_at?: string | null };

export function hasRecordedReward(mission: Mission) {
  if (mission.status !== "complete") return false;
  const bonusStep = (mission.mission_steps || []).find(s => s.step_type === "bonus_received");
  // Completed checkboxes alone must not count as payment.
  return bonusStep ? numberValue(bonusStep.current_amount) > 0 : numberValue(mission.expected_bonus) <= 0;
}
export function hasRealProgress(mission: Mission) {
  const m = mission as DatedMission;
  if (m.opened_at || m.funded_at || m.first_dd_at) return true;
  const created = m.created_at ? Date.parse(m.created_at) : NaN;
  return (m.mission_steps || []).some(raw => {
    const step = raw as DatedStep;
    if (step.is_complete) return true;
    const updated = step.updated_at ? Date.parse(step.updated_at) : NaN;
    // Initial planner amounts can be seeded on creation; not real activity.
    return numberValue(step.current_amount) > 0 &&
      Number.isFinite(created) && Number.isFinite(updated) &&
      updated > created + 60_000;
  });
}
export function visibleRewardHistory(missions: Mission[], records: AccountHistory[]) {
  const completed = missions.filter(hasRecordedReward);
  const stopped = missions.filter(m => m.status === "cancelled" && hasRealProgress(m));
  const completionNotes = new Set(completed.map(m => "Completed through Churning reward tracker · mission:" + m.id));
  // This is a reward history, not a list of every bank relationship.
  const standalone = records.filter(h => Boolean(h.bonus_received) && numberValue(h.bonus_amount) > 0 && !completionNotes.has(h.notes || ""));
  return { completed, stopped, standalone };
}
