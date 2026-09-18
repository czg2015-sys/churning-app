"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
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
  if (bonus > 0) return `${money.format(bonus)} potential bonus`;
  if (numberValue(item.apy) > 0) return `${numberValue(item.apy).toFixed(2)}% APY`;
  return categoryLabel(item);
}

function roadmapAlternativeLabel(item: Opportunity) {
  return `${categoryLabel(item)} · ${item.institution} · ${item.product_name}`;
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
    () => new Set(missions.filter((mission) => !["completed", "closed"].includes(mission.status)).map((mission) => mission.opportunity_id).filter(Boolean)),
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

    for (const mission of missions.filter((mission) => !["completed", "closed"].includes(mission.status))) {
      if (mission.qualification_deadline) items.push({ key: `${mission.id}-q`, date: mission.qualification_deadline, title: `${mission.institution} qualification review`, detail: mission.next_action || "Check actual account activity against the stored requirements.", kind: "active" });
      if (mission.payout_due_date) items.push({ key: `${mission.id}-p`, date: mission.payout_due_date, title: `${mission.institution} payout check`, detail: "Check whether the expected reward posted before marking it received.", kind: "active" });
      if (mission.benefit_end_date) items.push({ key: `${mission.id}-b`, date: mission.benefit_end_date, title: `${mission.institution} benefit review`, detail: "Review the next move before the stored promotional benefit ends.", kind: "active" });
    }

    roadmap.bonusSlots.forEach((slot) => {
      const dates = planningDates(slot.opportunity, roadmap.planningStartDate);
      items.push({
        key: `${slot.opportunity.id}-start`,
        date: dates.start,
        title: `Plan ${slot.opportunity.institution}`,
        detail: slot.monthlyDdAmount > 0
          ? `Planning lane: route about ${money.format(slot.monthlyDdAmount)}/month of DD if you choose this offer.`
          : slot.cashAmount > 0
            ? `Planning lane: about ${money.format(slot.cashAmount)} would be committed to this offer.`
            : "Planning lane: review the requirements before adding it.",
        kind: "planned",
      });
      if (dates.qualification) items.push({ key: `${slot.opportunity.id}-qual`, date: dates.qualification, title: `${slot.opportunity.institution} qualification target`, detail: "Planning date only until you confirm the real opening/trigger date.", kind: "planned" });
      if (dates.payout) items.push({ key: `${slot.opportunity.id}-pay`, date: dates.payout, title: `${slot.opportunity.institution} estimated payout review`, detail: "Actual bank timing controls; confirm the real date after opening.", kind: "planned" });
    });

    if (roadmap.savingsSlot.opportunity?.benefit_duration_days) {
      const dates = planningDates(roadmap.savingsSlot.opportunity, roadmap.planningStartDate);
      if (dates.benefitEnd) items.push({ key: `${roadmap.savingsSlot.opportunity.id}-benefit`, date: dates.benefitEnd, title: `${roadmap.savingsSlot.opportunity.institution} promotional-rate review`, detail: "Compare the next savings destination before the promotional period ends.", kind: "planned" });
    }

    return items
      .filter((item) => new Date(item.date).getTime() >= Date.now() - 86_400_000)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 9);
  }, [missions, roadmap]);

  return (
    <section className="cash-roadmap-shell">
      <div className="cash-roadmap-head">
        <div>
          <span className="kicker">YOUR CASH & BONUS ROADMAP</span>
          <h2>Here is the route we would start with from your answers.</h2>
          <p>Your {roadmap.strategyName.toLowerCase()} strategy controls how much cash and direct deposit we commit at once. You can swap any planning option, and the rest of the roadmap recalculates around that choice.</p>
        </div>
        <div className="roadmap-head-actions">
          <span className="roadmap-strategy-pill"><Route size={14} /> {roadmap.strategyName} roadmap</span>
          <button type="button" className="button ghost compact" onClick={resetRoadmap} disabled={savingChoice}><RefreshCw size={14} /> Reset to recommended</button>
        </div>
      </div>

      <div className="roadmap-capacity-strip">
        <div><small>AVAILABLE TO OPTIMIZE</small><strong>{money.format(roadmap.availableCash)}</strong><span>after reserve + active commitments</span></div>
        <div><small>MONTHLY DD AVAILABLE</small><strong>{money.format(roadmap.availableMonthlyDd)}</strong><span>of {money.format(roadmap.monthlyDdStream)} entered</span></div>
        <div><small>PLANNED BONUS VALUE</small><strong>{money.format(roadmap.projectedBonusValue)}</strong><span>before taxes where applicable</span></div>
        <div><small>EST. INCREMENTAL VALUE</small><strong>{roadmap.projectedIncrementalValue >= 0 ? "+" : ""}{money.format(roadmap.projectedIncrementalValue)}</strong><span>vs your stored cash baseline</span></div>
      </div>

      <div className="roadmap-flow" aria-label="Recommended allocation roadmap">
        <article className="roadmap-node source">
          <span className="roadmap-node-icon"><WalletCards size={19} /></span>
          <small>STARTING CASH</small>
          <strong>{money.format(roadmap.totalCash)}</strong>
          <p>Your full liquid-cash picture from the questionnaire.</p>
        </article>
        <ArrowRight className="roadmap-arrow" size={18} />

        <article className="roadmap-node reserve">
          <span className="roadmap-node-icon"><ShieldAlert size={19} /></span>
          <small>PROTECTED RESERVE</small>
          <strong>{money.format(roadmap.reserve)}</strong>
          <p>Left outside the opportunity budget.</p>
        </article>

        {roadmap.activeCash > 0 ? (
          <>
            <ArrowRight className="roadmap-arrow" size={18} />
            <article className="roadmap-node active">
              <span className="roadmap-node-icon"><CheckCircle2 size={19} /></span>
              <small>ALREADY TRACKING</small>
              <strong>{money.format(roadmap.activeCash)}</strong>
              <p>Cash already committed to active rewards.</p>
            </article>
          </>
        ) : null}

        {roadmap.bonusSlots.map((slot, index) => (
          <div className="roadmap-flow-piece" key={slot.opportunity.id}>
            <ArrowRight className="roadmap-arrow" size={18} />
            <article className="roadmap-node bonus">
              <div className="roadmap-node-top">
                <span className="roadmap-node-icon"><BadgeDollarSign size={19} /></span>
                <span className={slot.researchReady ? "roadmap-research cleared" : "roadmap-research pending"}>{slot.researchReady ? "Research cleared" : "Planning · research pending"}</span>
              </div>
              <small>{categoryLabel(slot.opportunity).toUpperCase()}</small>
              <strong>{slot.opportunity.institution}</strong>
              <b>{slot.opportunity.product_name}</b>
              <div className="roadmap-node-numbers">
                {slot.cashAmount > 0 ? <span><small>Cash</small><b>{money.format(slot.cashAmount)}</b></span> : null}
                {slot.monthlyDdAmount > 0 ? <span><small>DD / month</small><b>{money.format(slot.monthlyDdAmount)}</b></span> : null}
                <span><small>Value</small><b>{compactOpportunity(slot.opportunity)}</b></span>
              </div>
              <label className="roadmap-swap">
                <span>Change this part</span>
                <select value={slot.opportunity.id} onChange={(event) => swapBonus(index, event.target.value)} disabled={savingChoice}>
                  {bonusAlternatives.map((result) => <option key={result.item.id} value={result.item.id}>{roadmapAlternativeLabel(result.item)}</option>)}
                </select>
              </label>
              <AddToPlanButton
                opportunity={slot.opportunity}
                alreadyAdded={addedOpportunityIds.includes(slot.opportunity.id)}
                allowPlanningOnHold
              />
            </article>
          </div>
        ))}

        <div className="roadmap-flow-piece">
          <ArrowRight className="roadmap-arrow" size={18} />
          <article className="roadmap-node savings">
            <div className="roadmap-node-top"><span className="roadmap-node-icon"><Landmark size={19} /></span><span className="roadmap-research liquid">Liquid remainder</span></div>
            <small>REMAINING CASH</small>
            <strong>{money.format(roadmap.savingsSlot.amount)}</strong>
            <b>{roadmap.savingsSlot.label}</b>
            <div className="roadmap-node-numbers">
              <span><small>Stored APY</small><b>{roadmap.savingsSlot.apy.toFixed(2)}%</b></span>
              <span><small>Purpose</small><b>Stay liquid</b></span>
            </div>
            <label className="roadmap-swap">
              <span>Choose savings destination</span>
              <select
                value={roadmap.savingsSlot.isCurrentSavings ? "current" : roadmap.savingsSlot.opportunity?.id || "current"}
                onChange={(event) => swapSavings(event.target.value)}
                disabled={savingChoice}
              >
                <option value="current">Current savings / keep liquid</option>
                {hysaAlternatives.map((result) => <option key={result.item.id} value={result.item.id}>{result.item.institution} · {result.item.product_name} · {numberValue(result.item.apy).toFixed(2)}%</option>)}
              </select>
            </label>
            {roadmap.savingsSlot.opportunity ? (
              <AddToPlanButton
                opportunity={roadmap.savingsSlot.opportunity}
                alreadyAdded={addedOpportunityIds.includes(roadmap.savingsSlot.opportunity.id)}
                allowPlanningOnHold
              />
            ) : null}
          </article>
        </div>
      </div>

      <div className="roadmap-allocation-check">
        <CircleDollarSign size={17} />
        <span>
          <strong>{money.format(roadmap.reserve + roadmap.activeCash + roadmap.bonusCashUsed + roadmap.savingsSlot.amount)} of {money.format(roadmap.totalCash)} accounted for.</strong>
          <small>Reserve + active commitments + planned bonus cash + liquid remainder.</small>
        </span>
        {roadmap.warningCount ? <b>{roadmap.warningCount} planning item{roadmap.warningCount === 1 ? "" : "s"} still need research clearance</b> : <b>All planning items research-cleared</b>}
      </div>

      <div className="roadmap-timeline">
        <div className="roadmap-timeline-head">
          <div><span className="kicker">ROADMAP TIMELINE</span><h3>Track the plan through real months.</h3></div>
          <p>Planned dates become actual tracker dates after you confirm when an account was opened, funded, or first received DD.</p>
        </div>
        {timeline.length ? (
          <div className="roadmap-timeline-list">
            {timeline.map((item) => (
              <article key={item.key}>
                <div className="roadmap-time-date"><small>{formatMonth(item.date)}</small><strong>{formatDate(item.date)}</strong></div>
                <span className={`roadmap-time-dot ${item.kind}`} />
                <div><strong>{item.title}</strong><span>{item.detail}</span></div>
              </article>
            ))}
          </div>
        ) : (
          <div className="roadmap-empty-timeline"><CalendarClock size={18} /><span><strong>Your roadmap has no dated milestones yet.</strong><small>Add or start an offer and its real dates will appear here.</small></span></div>
        )}
      </div>

      {choiceMessage ? <div className="roadmap-save-message"><Sparkles size={14} /> {choiceMessage}</div> : null}
    </section>
  );
}
