"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, X } from "lucide-react";
import { RewardTracker } from "@/components/reward-tracker";
import { money, numberValue } from "@/lib/plan-math";
import type { Mission } from "@/lib/types";

function readableDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function missionProgress(mission: Mission) {
  const steps = mission.mission_steps || [];
  if (!steps.length) return 0;
  const complete = steps.filter((step) => step.is_complete).length;
  return Math.round((complete / steps.length) * 100);
}

function nextDate(mission: Mission) {
  return mission.qualification_deadline || mission.payout_due_date || mission.safe_close_review_date || null;
}

export function CompactMissionHub({ missions }: { missions: Mission[] }) {
  const active = useMemo(() => missions.filter((mission) => !["complete", "cancelled"].includes(mission.status)), [missions]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = active.find((mission) => mission.id === selectedId) || null;

  return (
    <>
      <section className="compact-mission-hub">
        <div className="compact-mission-head">
          <div><small>YOUR ACTIVE ACCOUNTS</small><strong>{active.length ? "Track what you already started." : "Current"}</strong></div>
          <span>{active.length ? `${active.length} active` : "N/A"}</span>
        </div>

        {active.length ? (
          <div className="compact-mission-row">
            {active.slice(0, 4).map((mission) => {
              const progress = missionProgress(mission);
              const expected = numberValue(mission.expected_bonus) + numberValue(mission.expected_interest);
              return (
                <button type="button" className="compact-mission-card" key={mission.id} onClick={() => setSelectedId(mission.id)}>
                  <div className="compact-mission-card-top">
                    <span><small>{mission.institution}</small><strong>{mission.title}</strong></span>
                    <b>{expected > 0 ? money.format(expected) : "Active"}</b>
                  </div>
                  <div className="compact-mission-progress"><span style={{ width: `${progress}%` }} /></div>
                  <div className="compact-mission-card-foot">
                    <span><CheckCircle2 size={12} /> {progress}% complete</span>
                    <span><Clock3 size={12} /> {readableDate(nextDate(mission))}</span>
                    <em>Open tracker <ArrowRight size={12} /></em>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="compact-mission-empty">
            <span><strong>No active account yet.</strong><small>Choose a recommendation below when you are ready.</small></span>
            <b>N/A</b>
          </div>
        )}
      </section>

      {selected ? (
        <div className="mission-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedId(null); }}>
          <aside className="mission-drawer" role="dialog" aria-modal="true" aria-label={`${selected.institution} tracker`}>
            <div className="mission-drawer-head">
              <div><small>ACCOUNT TRACKER</small><strong>{selected.institution} · {selected.title}</strong></div>
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Close tracker"><X size={18} /></button>
            </div>
            <div className="mission-drawer-body">
              <RewardTracker missions={[selected]} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
