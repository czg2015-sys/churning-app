"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  CircleDollarSign,
  Landmark,
  RefreshCw,
  Route,
  ShieldAlert,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel, money, numberValue, rankMatches } from "@/lib/plan-math";
import { buildCashBonusRoadmap, planningDates, type RoadmapOverrides } from "@/lib/roadmap";
import type { FinancialProfile, Mission, Opportunity } from "@/lib/types";

function normalizeOverrides(raw: FinancialProfile["roadmap_selected_opportunity_ids"]): RoadmapOverrides {
  if (!raw) return {};
  if (Array.isArray(raw)) return { bonusIds: raw.filter((value): value is string => typeof value === "string") };
  if (typeof raw === "object") {
    return {
      bonusIds: Array.isArray(raw.bonusIds) ? raw.bonusIds.filter((value): value is string => typeof value === "string") : [],
      hysaId: typeof raw.hysaId === "string" ? raw.hysaId : null,
      keepCurrentSavings: Boolean(raw.keepCurrentSavings),
    };
  }
  return {};
}

function formatMonth(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function compactOpportunity(item: Opportunity) {
  const bonus = numberValue(item.bonus_amount);
  if (bonus > 0) return `${money.format(bonus)} bonus`;
  if (numberValue(item.apy) > 0) return `${numberValue(item.apy).toFixed(2)}% APY`;
  return categoryLabel(item);
}

function roadmapAlternativeLabel(item: Opportunity) {
  return `${categoryLabel(item)} · ${item.institution} · ${item.product_name}`;
}

function strategyCopy(name: "Simple" | "Balanced" | "Active") {
  if (name === "Simple") return "Fewer moving parts: keep more cash liquid and work one bonus lane at a time.";
  if (name === "Active") return "More moving parts: use more available cash and DD capacity when the requirements can realistically work together.";
  return "Middle ground: capture strong bonuses while keeping a meaningful liquid-cash lane.";
}

type TimelineItem = {
  key: string;
  date: string;
  title: string;
  detail: string;
  kind: "planned" | "active";
};

export function CashBonusRoadmap({
  profile,
  opportunities,
  missions,
  usedBanks,
  stateCode,
  addedOpportunityIds,
}: {
  profile: FinancialProfile;
  opportunities: Opportunity[];
  missions: Mission[];
  usedBanks: string[];
  stateCode?: string | null;
  addedOpportunityIds: string[];
}) {
  const [overrides, setOverrides] = useState<RoadmapOverrides>(() => normalizeOverrides(profile.roadmap_selected_opportunity_ids));
  const [savingChoice, setSavingChoice] = useState(false);
  const [choiceMessage, setChoiceMessage] = useState("");

  const roadmap = useMemo(
    () => buildCashBonusRoadmap({ opportunities, profile, missions, usedBanks, stateCode, overrides }),
    [opportunities, profile, missions, usedBanks, stateCode, overrides],
  );

  const ranked = useMemo(
    () => rankMatches(opportunities, profile, usedBanks, stateCode),
    [opportunities, profile, usedBanks, stateCode],
  );

  const activeIds = useMemo(
    () => new Set(missions.filter((mission) => !["complete", "cancelled"].includes(mission.status)).map((mission) => mission.opportunity_id).filter(Boolean)),
    [missions],
  );

  const bonusAlternatives = ranked.filter((result) => {
    const item = result.item;
    if (activeIds.has(item.id)) return false;
    if (item.category === "hysa") return false;
    if (["credit_card_bonus", "brokerage_bonus", "cd", "treasury"].includes(item.category)) return false;
    if (item.category === "debit_spend" && !profile.card_helper_opt_in) return false;
    return result.cashFit >= 95 && result.ddFit >= 90 && result.spendFit >= 75;
  });

  const hysaAlternatives = ranked.filter((result) => (
    result.item.category === "hysa" &&
    !activeIds.has(result.item.id) &&
    Math.max(numberValue(result.item.required_balance), numberValue(result.item.min_opening_deposit)) <= roadmap.savingsSlot.amount + 0.01
  ));

  async function persist(next: RoadmapOverrides) {
    setOverrides(next);
    setSavingChoice(true);
    setChoiceMessage("");
    const supabase = createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (!userId) {
      setSavingChoice(false);
      return;
    }
    const { error } = await supabase
      .from("financial_profiles")
      .update({
        roadmap_selected_opportunity_ids: next,
        roadmap_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    setChoiceMessage(error ? "Could not save that roadmap change yet." : "Roadmap updated.");
    setSavingChoice(false);
  }

  function swapBonus(index: number, id: string) {
    const currentIds = roadmap.bonusSlots.map((slot) => slot.opportunity.id);
    currentIds[index] = id;
    void persist({ ...overrides, bonusIds: currentIds });
  }

  function swapSavings(value: string) {
    if (value === "current") {
      void persist({ ...overrides, hysaId: null, keepCurrentSavings: true });
      return;
    }
    void persist({ ...overrides, hysaId: value, keepCurrentSavings: false });
  }

  function resetRoadmap() {
    void persist({});
  }

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];

    for (const mission of missions.filter((mission) => !["complete", "cancelled"].includes(mission.status))) {
      if (mission.qualification_deadline) items.push({ key: `${mission.id}-q`, date: mission.qualification_deadline, title: `${mission.institution} qualification review`, detail: mission.next_action || "Check actual account activity against the stored requirements.", kind: "active" });
      if (mission.payout_due_date) items.push({ key: `${mission.id}-p`, date: mission.payout_due_date, title: `${mission.institution} payout check`, detail: "Check whether the expected reward posted before marking it received.", kind: "active" });
      if (mission.benefit_end_date) items.push({ key: `${mission.id}-b`, date: mission.benefit_end_date, title: `${mission.institution} benefit review`, detail: "Review the next move before the stored promotional benefit ends.", kind: "active" });
    }

    roadmap.bonusSlots.forEach((slot) => {
      const dates = planningDates(slot.opportunity, roadmap.planningStartDate);
      items.push({
        key: `${slot.opportunity.id}-start`,
        date: dates.start,
        title: `Review ${slot.opportunity.institution}`,
        detail: slot.monthlyDdAmount > 0
          ? `Planned DD lane: about ${money.format(slot.monthlyDdAmount)}/month if you choose this offer.`
          : slot.cashAmount > 0
            ? `Planned cash lane: about ${money.format(slot.cashAmount)} if you choose this offer.`
            : "Review the stored requirements before adding it.",
        kind: "planned",
      });
      if (dates.qualification) items.push({ key: `${slot.opportunity.id}-qual`, date: dates.qualification, title: `${slot.opportunity.institution} qualification target`, detail: "Projected until you confirm the real opening or trigger date.", kind: "planned" });
      if (dates.payout) items.push({ key: `${slot.opportunity.id}-pay`, date: dates.payout, title: `${slot.opportunity.institution} payout review`, detail: "Actual bank timing controls; confirm the real date after opening.", kind: "planned" });
    });

    if (roadmap.savingsSlot.opportunity?.benefit_duration_days) {
      const dates = planningDates(roadmap.savingsSlot.opportunity, roadmap.planningStartDate);
      if (dates.benefitEnd) items.push({ key: `${roadmap.savingsSlot.opportunity.id}-benefit`, date: dates.benefitEnd, title: `${roadmap.savingsSlot.opportunity.institution} promo-rate review`, detail: "Compare the next savings destination before the promotional period ends.", kind: "planned" });
    }

    return items
      .filter((item) => new Date(item.date).getTime() >= Date.now() - 86_400_000)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);
  }, [missions, roadmap]);

  const timelineGroups = useMemo(() => {
    const groups = new Map<string, TimelineItem[]>();
    for (const item of timeline) {
      const key = item.date.slice(0, 7);
      groups.set(key, [...(groups.get(key) || []), item]);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({ key, label: formatMonth(items[0].date), items }));
  }, [timeline]);

  const plannedDdSlots = roadmap.bonusSlots.filter((slot) => slot.monthlyDdAmount > 0);
  const unassignedDd = Math.max(0, roadmap.monthlyDdStream - roadmap.activeMonthlyDd - roadmap.ddUsed);
  const accountedCash = roadmap.reserve + roadmap.activeCash + roadmap.bonusCashUsed + roadmap.savingsSlot.amount;

  return (
    <section className="cash-roadmap-shell">
      <div className="cash-roadmap-head">
        <div>
          <span className="kicker">YOUR CASH & BONUS ROADMAP</span>
          <h2>See where the money goes, where the bonuses come from, and when each move matters.</h2>
          <p>{strategyCopy(roadmap.strategyName)} This is the recommended route from your answers; every offer can be swapped and the map recalculates around your choice.</p>
        </div>
        <div className="roadmap-head-actions">
          <span className="roadmap-strategy-pill"><Route size={14} /> {roadmap.strategyName} roadmap</span>
          <button type="button" className="button ghost compact" onClick={resetRoadmap} disabled={savingChoice}><RefreshCw size={14} /> Reset recommendation</button>
        </div>
      </div>

      <div className="roadmap-capacity-strip">
        <div><small>AVAILABLE TO OPTIMIZE</small><strong>{money.format(roadmap.availableCash)}</strong><span>after reserve + active commitments</span></div>
        <div><small>MONTHLY DD AVAILABLE</small><strong>{money.format(roadmap.availableMonthlyDd)}</strong><span>of {money.format(roadmap.monthlyDdStream)} entered</span></div>
        <div><small>PLANNED BONUS VALUE</small><strong>{money.format(roadmap.projectedBonusValue)}</strong><span>before taxes where applicable</span></div>
        <div><small>EST. INCREMENTAL VALUE</small><strong>{roadmap.projectedIncrementalValue >= 0 ? "+" : ""}{money.format(roadmap.projectedIncrementalValue)}</strong><span>vs your stored cash baseline</span></div>
      </div>

      <div className="roadmap-map" aria-label="Cash and bonus allocation map">
        <div className="roadmap-origin">
          <span className="roadmap-origin-icon"><WalletCards size={20} /></span>
          <div><small>YOUR MONEY</small><strong>{money.format(roadmap.totalCash)}</strong><p>{money.format(roadmap.availableCash)} available for the next moves · {money.format(roadmap.monthlyDdStream)}/mo DD stream</p></div>
        </div>
        <div className="roadmap-map-stem" />

        <div className="roadmap-map-branches">
          <article className="roadmap-lane protect">
            <div className="roadmap-lane-heading"><span>01</span><div><small>PROTECT</small><strong>Keep your reserve untouched</strong></div></div>
            <div className="roadmap-bubble reserve">
              <span className="roadmap-bubble-icon"><ShieldAlert size={18} /></span>
              <small>PROTECTED RESERVE</small>
              <strong>{money.format(roadmap.reserve)}</strong>
              <p>Excluded from bonus requirements and the opportunity budget.</p>
            </div>
          </article>

          <section className="roadmap-lane earn">
            <div className="roadmap-lane-heading"><span>02</span><div><small>EARN</small><strong>Use the strongest realistic bonus lanes</strong></div></div>

            {roadmap.activeCash > 0 ? (
              <div className="roadmap-existing">
                <span>Already tracking</span><strong>{money.format(roadmap.activeCash)}</strong><small>kept in the map before new recommendations</small>
              </div>
            ) : null}

            <div className="roadmap-bonus-stack">
              {roadmap.bonusSlots.length ? roadmap.bonusSlots.map((slot, index) => {
                const selectedIds = new Set(roadmap.bonusSlots.map((item) => item.opportunity.id));
                const choices = bonusAlternatives.filter((result) => result.item.id === slot.opportunity.id || !selectedIds.has(result.item.id));
                const userSelected = (overrides.bonusIds || [])[index] === slot.opportunity.id;
                return (
                  <article className="roadmap-bubble bonus" key={slot.opportunity.id}>
                    <div className="roadmap-bubble-top">
                      <span className="roadmap-bubble-icon"><BadgeDollarSign size={18} /></span>
                      <span className="roadmap-choice-tag">{userSelected ? "Your choice" : `Plan #${index + 1}`}</span>
                    </div>
                    <span className={slot.researchReady ? "roadmap-review-state cleared" : "roadmap-review-state pending"}>{slot.researchReady ? "Research cleared" : "Research pending · review candidate"}</span>
                    <small>{categoryLabel(slot.opportunity).toUpperCase()}</small>
                    <strong>{slot.opportunity.institution}</strong>
                    <b>{slot.opportunity.product_name}</b>
                    <div className="roadmap-bubble-metrics">
                      {slot.cashAmount > 0 ? <span><small>Cash</small><b>{money.format(slot.cashAmount)}</b></span> : null}
                      {slot.monthlyDdAmount > 0 ? <span><small>DD / month</small><b>{money.format(slot.monthlyDdAmount)}</b></span> : null}
                      <span><small>Potential</small><b>{compactOpportunity(slot.opportunity)}</b></span>
                    </div>
                    <label className="roadmap-swap">
                      <span>Swap this recommendation</span>
                      <select value={slot.opportunity.id} onChange={(event) => swapBonus(index, event.target.value)} disabled={savingChoice}>
                        {choices.map((result) => <option key={result.item.id} value={result.item.id}>{roadmapAlternativeLabel(result.item)}</option>)}
                      </select>
                    </label>
                    <AddToPlanButton opportunity={slot.opportunity} alreadyAdded={addedOpportunityIds.includes(slot.opportunity.id)} allowPlanningOnHold />
                  </article>
                );
              }) : (
                <div className="roadmap-no-bonus"><BadgeDollarSign size={19} /><div><strong>No research-cleared bonus fits the current limits yet.</strong><span>Use More Options below to review candidates, or update your cash/DD inputs.</span></div></div>
              )}
            </div>
          </section>

          <article className="roadmap-lane liquid">
            <div className="roadmap-lane-heading"><span>03</span><div><small>STAY LIQUID</small><strong>Put the remaining cash somewhere useful</strong></div></div>
            <div className="roadmap-bubble savings">
              <span className="roadmap-bubble-icon"><Landmark size={18} /></span>
              <small>LIQUID SAVINGS LANE</small>
              <strong>{money.format(roadmap.savingsSlot.amount)}</strong>
              <b>{roadmap.savingsSlot.label}</b>
              <div className="roadmap-bubble-metrics">
                <span><small>Stored APY</small><b>{roadmap.savingsSlot.apy.toFixed(2)}%</b></span>
                <span><small>Role</small><b>Flexible cash</b></span>
              </div>
              <label className="roadmap-swap">
                <span>Change savings destination</span>
                <select value={roadmap.savingsSlot.isCurrentSavings ? "current" : roadmap.savingsSlot.opportunity?.id || "current"} onChange={(event) => swapSavings(event.target.value)} disabled={savingChoice}>
                  <option value="current">Current savings / keep liquid</option>
                  {hysaAlternatives.map((result) => <option key={result.item.id} value={result.item.id}>{result.item.institution} · {result.item.product_name} · {numberValue(result.item.apy).toFixed(2)}%</option>)}
                </select>
              </label>
              {roadmap.savingsSlot.opportunity ? <AddToPlanButton opportunity={roadmap.savingsSlot.opportunity} alreadyAdded={addedOpportunityIds.includes(roadmap.savingsSlot.opportunity.id)} allowPlanningOnHold /> : null}
            </div>
          </article>
        </div>
      </div>

      <div className="roadmap-dd-route">
        <div className="roadmap-dd-head">
          <div><span className="kicker">PAYCHECK ROUTING</span><h3>See where your monthly direct deposit can go.</h3></div>
          <p>This lane uses the paycheck amount you entered. We never stack DD offers beyond the amount your roadmap can support.</p>
        </div>
        <div className="roadmap-dd-track">
          <div className="roadmap-dd-node source"><small>MONTHLY DD STREAM</small><strong>{money.format(roadmap.monthlyDdStream)}</strong></div>
          {roadmap.activeMonthlyDd > 0 ? <><ArrowRight size={17} /><div className="roadmap-dd-node active"><small>ALREADY ROUTED</small><strong>{money.format(roadmap.activeMonthlyDd)}</strong></div></> : null}
          {plannedDdSlots.map((slot) => <div className="roadmap-dd-piece" key={`dd-${slot.opportunity.id}`}><ArrowRight size={17} /><div className="roadmap-dd-node"><small>{slot.opportunity.institution.toUpperCase()}</small><strong>{money.format(slot.monthlyDdAmount)}/mo</strong><span>{slot.opportunity.product_name}</span></div></div>)}
          <div className="roadmap-dd-piece"><ArrowRight size={17} /><div className="roadmap-dd-node remainder"><small>UNASSIGNED / FLEXIBLE</small><strong>{money.format(unassignedDd)}/mo</strong><span>available for bills, checking, or a future lane</span></div></div>
        </div>
      </div>

      <div className="roadmap-allocation-check">
        <CircleDollarSign size={17} />
        <span><strong>{money.format(accountedCash)} of {money.format(roadmap.totalCash)} accounted for.</strong><small>Reserve + active commitments + planned bonus cash + liquid savings.</small></span>
        <b>{roadmap.bonusSlots.length ? `${roadmap.bonusSlots.length} recommended bonus lane${roadmap.bonusSlots.length === 1 ? "" : "s"}` : "No bonus lane activated yet"}</b>
      </div>

      <div className="roadmap-timeline">
        <div className="roadmap-timeline-head">
          <div><span className="kicker">ROADMAP TIMELINE</span><h3>What the next months could look like.</h3></div>
          <p>Purple = projected from the roadmap. Green = a real tracker date from an offer you actually added.</p>
        </div>
        {timelineGroups.length ? (
          <div className="roadmap-month-track">
            {timelineGroups.map((group) => (
              <article className="roadmap-month" key={group.key}>
                <div className="roadmap-month-label">{group.label}</div>
                <span className="roadmap-month-dot" />
                <div className="roadmap-month-events">
                  {group.items.map((item) => <div className={`roadmap-month-event ${item.kind}`} key={item.key}><small>{formatDate(item.date)} · {item.kind === "active" ? "TRACKING" : "PROJECTED"}</small><strong>{item.title}</strong><span>{item.detail}</span></div>)}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="roadmap-empty-timeline"><CalendarClock size={18} /><span><strong>No dated milestones yet.</strong><small>Add an offer and its real dates will appear here.</small></span></div>
        )}
      </div>

      {choiceMessage ? <div className="roadmap-save-message"><Sparkles size={14} /> {choiceMessage}</div> : null}
    </section>
  );
}
