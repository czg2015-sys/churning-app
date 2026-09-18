"use client";

import { useMemo } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  CircleDollarSign,
  Landmark,
  Route,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { money, numberValue } from "@/lib/plan-math";
import { buildLiveCashBonusRoadmap } from "@/lib/roadmap";
import type { FinancialProfile, Mission } from "@/lib/types";

function formatMonth(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function strategyCopy(name: "Simple" | "Balanced" | "Active") {
  if (name === "Simple") return "Fewer moving parts, more cash kept liquid, and one reward lane at a time.";
  if (name === "Active") return "Use more of your available cash and DD capacity, but only where the selected requirements can realistically coexist.";
  return "Capture strong bonuses while keeping a meaningful liquid-cash lane and manageable requirements.";
}

function remainingCashLabel(profile: FinancialProfile) {
  const apy = numberValue(profile.current_hysa_apy);
  if (apy > 0) return `Keep unassigned cash liquid in your current savings / HYSA at the stored ${apy.toFixed(2)}% APY until you choose another move.`;
  return "Keep unassigned cash liquid while you compare the savings and bonus options below.";
}

export function CashBonusRoadmap({
  profile,
  missions,
}: {
  profile: FinancialProfile;
  missions: Mission[];
}) {
  const roadmap = useMemo(() => buildLiveCashBonusRoadmap({ profile, missions }), [profile, missions]);

  const timelineGroups = useMemo(() => {
    const groups = new Map<string, typeof roadmap.timeline>();
    for (const item of roadmap.timeline) {
      const key = item.date.slice(0, 7);
      groups.set(key, [...(groups.get(key) || []), item]);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({ key, label: formatMonth(items[0].date), items }));
  }, [roadmap.timeline]);

  const hasSelectedOffers = roadmap.missions.length > 0;

  return (
    <section className="cash-roadmap-shell" id="live-roadmap">
      <div className="cash-roadmap-head">
        <div>
          <span className="kicker">YOUR LIVE CASH & BONUS ROADMAP</span>
          <h2>Your selected offers become the map—not another recommendation list.</h2>
          <p>{strategyCopy(roadmap.strategyName)} Add or change offers from the recommendation and category sections; this roadmap then recalculates from your real tracker progress.</p>
        </div>
        <span className="roadmap-strategy-pill"><Route size={14} /> {roadmap.strategyName} roadmap</span>
      </div>

      <div className="roadmap-capacity-strip">
        <div><small>TOTAL LIQUID CASH</small><strong>{money.format(roadmap.totalCash)}</strong><span>from your profile</span></div>
        <div><small>PROTECTED RESERVE</small><strong>{money.format(roadmap.reserve)}</strong><span>kept outside the plan</span></div>
        <div className={roadmap.cashOverage > 0 ? "roadmap-capacity-warning" : ""}><small>IN SELECTED ACCOUNTS</small><strong>{money.format(roadmap.selectedCash)}</strong><span>{roadmap.cashOverage > 0 ? `${money.format(roadmap.cashOverage)} over available cash` : `${roadmap.missions.length} tracked item${roadmap.missions.length === 1 ? "" : "s"}`}</span></div>
        <div><small>POTENTIAL REWARDS</small><strong>{money.format(roadmap.potentialRewardValue)}</strong><span>{roadmap.potentialRewardCount} reward{roadmap.potentialRewardCount === 1 ? "" : "s"} still lined up</span></div>
      </div>

      {!hasSelectedOffers ? (
        <div className="roadmap-empty-live">
          <Route size={24} />
          <div>
            <strong>Your live roadmap is waiting for your selections.</strong>
            <span>Choose from the three best-fit options above. Once an offer is added, Churning will place it here, track its cash/DD requirements, and build the next steps from the dates and progress you confirm.</span>
          </div>
        </div>
      ) : (
        <>
          <div className="roadmap-map" aria-label="Live cash and bonus roadmap">
            <div className="roadmap-origin">
              <span className="roadmap-origin-icon"><WalletCards size={20} /></span>
              <div><small>YOUR MONEY + PAYCHECK STREAM</small><strong>{money.format(roadmap.totalCash)}</strong><p>{money.format(roadmap.deployableCash)} outside reserve · {money.format(roadmap.monthlyDdStream)}/mo DD capacity from your profile</p></div>
            </div>
            <div className="roadmap-map-stem" />

            <div className="roadmap-map-branches live-branches">
              <article className="roadmap-lane protect">
                <div className="roadmap-lane-heading"><span>01</span><div><small>PROTECT</small><strong>Reserve stays outside bonus requirements</strong></div></div>
                <div className="roadmap-bubble reserve">
                  <span className="roadmap-bubble-icon"><ShieldAlert size={18} /></span>
                  <small>PROTECTED RESERVE</small>
                  <strong>{money.format(roadmap.reserve)}</strong>
                  <p>This money is not assigned to an offer.</p>
                </div>
              </article>

              <section className="roadmap-lane earn">
                <div className="roadmap-lane-heading"><span>02</span><div><small>TRACK</small><strong>Every offer you actually added</strong></div></div>
                <div className="roadmap-bonus-stack">
                  {roadmap.missions.map((item) => (
                    <article className={`roadmap-bubble bonus live-mission ${item.action.tone}`} key={item.mission.id}>
                      <div className="roadmap-bubble-top">
                        <span className="roadmap-bubble-icon"><BadgeDollarSign size={18} /></span>
                        <span className="roadmap-choice-tag">{item.mission.status === "planned" ? "Not started" : item.mission.status === "complete" ? "Reward recorded" : "Live"}</span>
                      </div>
                      <div className="roadmap-bubble-tags">
                        <span className="roadmap-review-state cleared">{item.requirementPercent}% requirements</span>
                        {item.lifecycle ? <span className={`roadmap-close-tag ${item.lifecycle.tone}`}>{item.lifecycle.label}</span> : null}
                      </div>
                      <small>{item.mission.institution.toUpperCase()}</small>
                      <strong>{item.mission.title}</strong>
                      <div className="roadmap-bubble-metrics">
                        <span><small>Cash tracked</small><b>{money.format(item.cashAmount)}</b></span>
                        <span><small>Expected value</small><b>{money.format(item.expectedValue)}</b></span>
                        {item.ddTarget > 0 ? <span><small>DD recorded</small><b>{money.format(item.ddRecorded)} / {money.format(item.ddTarget)}</b></span> : null}
                        {item.ddTarget > 0 ? <span><small>DD remaining</small><b>{money.format(item.ddRemaining)}</b></span> : null}
                      </div>
                      <div className="roadmap-live-action">
                        <span>NEXT MOVE</span>
                        <strong>{item.action.label}</strong>
                        <p>{item.action.detail}</p>
                      </div>
                      {item.lifecycle ? <p className="roadmap-close-copy"><strong>After the reward:</strong> {item.lifecycle.text}</p> : null}
                    </article>
                  ))}
                </div>
              </section>

              <article className="roadmap-lane liquid">
                <div className="roadmap-lane-heading"><span>03</span><div><small>KEEP FLEXIBLE</small><strong>Account for every remaining dollar</strong></div></div>
                <div className="roadmap-bubble savings">
                  <span className="roadmap-bubble-icon"><Landmark size={18} /></span>
                  <small>UNASSIGNED CASH</small>
                  <strong>{money.format(roadmap.remainingCash)}</strong>
                  <b>{numberValue(profile.current_hysa_apy) > 0 ? "Current savings / HYSA lane" : "Liquid-cash lane"}</b>
                  <p>{remainingCashLabel(profile)}</p>
                </div>
              </article>
            </div>
          </div>

          <div className="roadmap-dd-route">
            <div className="roadmap-dd-head">
              <div><span className="kicker">DIRECT-DEPOSIT ROUTE</span><h3>See how much paycheck capacity is already spoken for.</h3></div>
              <p>The route only counts unfinished DD requirements. Once a qualifying DD step is confirmed complete, that capacity becomes available for another move.</p>
            </div>
            <div className="roadmap-dd-track">
              <div className="roadmap-dd-node source"><small>MONTHLY DD STREAM</small><strong>{money.format(roadmap.monthlyDdStream)}</strong><span>from your biweekly pay input</span></div>
              {roadmap.missions.filter((item) => item.monthlyDdNeeded > 0).map((item) => (
                <div className="roadmap-dd-piece" key={`dd-${item.mission.id}`}>
                  <ArrowRight size={14} />
                  <div className="roadmap-dd-node active"><small>{item.mission.institution.toUpperCase()}</small><strong>{money.format(item.monthlyDdNeeded)}/mo pace</strong><span>{money.format(item.ddRemaining)} remaining to target</span></div>
                </div>
              ))}
              <ArrowRight size={14} />
              <div className={`roadmap-dd-node remainder ${roadmap.ddOverage > 0 ? "warning" : ""}`}><small>{roadmap.ddOverage > 0 ? "DD OVER CAPACITY" : "UNASSIGNED DD"}</small><strong>{roadmap.ddOverage > 0 ? money.format(roadmap.ddOverage) : money.format(roadmap.monthlyDdRemaining)}/mo</strong><span>{roadmap.ddOverage > 0 ? "Reduce or finish a DD lane before adding another." : "available for future offers"}</span></div>
            </div>
          </div>

          <div className={`roadmap-allocation-check ${roadmap.cashOverage > 0 || roadmap.ddOverage > 0 ? "warning" : ""}`}>
            <CircleDollarSign size={17} />
            <span><strong>{roadmap.cashOverage > 0 || roadmap.ddOverage > 0 ? "Your selected plan needs an adjustment." : "Your selected plan accounts for the full cash picture."}</strong><small>{roadmap.cashOverage > 0 ? `Selected accounts exceed available cash by ${money.format(roadmap.cashOverage)}. ` : ""}{roadmap.ddOverage > 0 ? `DD requirements exceed your entered monthly stream by about ${money.format(roadmap.ddOverage)}. ` : ""}{roadmap.cashOverage <= 0 && roadmap.ddOverage <= 0 ? `${money.format(roadmap.reserve)} protected + ${money.format(roadmap.selectedCash)} tracked + ${money.format(roadmap.remainingCash)} left liquid.` : "Use More Options or remove a tracked offer to bring the roadmap back inside your profile limits."}</small></span>
            <b>{money.format(roadmap.totalCash)} total</b>
          </div>

          <div className="roadmap-timeline">
            <div className="roadmap-timeline-head">
              <div><span className="kicker">MONTH-BY-MONTH ROADMAP</span><h3>What should happen next—and when.</h3></div>
              <p>Real opening dates and tracker progress drive these dates. Change a real date or update DD/balance progress below and the roadmap recalculates.</p>
            </div>
            {timelineGroups.length ? (
              <div className="roadmap-month-track">
                {timelineGroups.map((group) => (
                  <section className="roadmap-month" key={group.key}>
                    <div className="roadmap-month-label">{group.label}</div>
                    <span className="roadmap-month-dot" />
                    <div className="roadmap-month-events">
                      {group.items.map((event) => (
                        <article className={`roadmap-month-event ${event.tone}`} key={event.key}>
                          <small>{formatDate(event.date)}</small>
                          <strong>{event.title}</strong>
                          <span>{event.detail}</span>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="roadmap-empty-timeline"><CalendarClock size={18} /><div><strong>No dated events yet.</strong><small>Confirm a real opening date in Live Tracking and the timeline will populate.</small></div></div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
