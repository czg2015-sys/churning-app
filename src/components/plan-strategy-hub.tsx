"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeDollarSign,
  Banknote,
  CalendarDays,
  CreditCard,
  Landmark,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { AccountTrackerHub } from "@/components/account-tracker-hub";
import { createClient } from "@/lib/supabase/client";
import { money, numberValue, rankMatches } from "@/lib/plan-math";
import { planningDates } from "@/lib/roadmap";
import type { FinancialProfile, Mission, Opportunity, TrackedCashAccount } from "@/lib/types";

type RankedMatch = ReturnType<typeof rankMatches>[number];
type SortMode = "overall" | "profit" | "ease" | "liquidity";
type SavedSelections = {
  ddIds?: string[];
  hysaId?: string | null;
  savingsBonusId?: string | null;
  spendingId?: string | null;
  keepCurrentSavings?: boolean;
  sortMode?: SortMode;
  bonusIds?: string[];
};

type RankMaps = {
  overall: Map<string, number>;
  profit: Map<string, number>;
  ease: Map<string, number>;
  liquidity: Map<string, number>;
};

function normalizedSelections(raw: FinancialProfile["roadmap_selected_opportunity_ids"]): SavedSelections {
  if (!raw) return {};
  if (Array.isArray(raw)) return { bonusIds: raw.filter((id): id is string => typeof id === "string") };
  if (typeof raw !== "object") return {};
  return {
    ddIds: Array.isArray(raw.ddIds) ? raw.ddIds.filter((id): id is string => typeof id === "string") : undefined,
    hysaId: typeof raw.hysaId === "string" ? raw.hysaId : null,
    savingsBonusId: typeof raw.savingsBonusId === "string" ? raw.savingsBonusId : null,
    spendingId: typeof raw.spendingId === "string" ? raw.spendingId : null,
    keepCurrentSavings: Boolean(raw.keepCurrentSavings),
    sortMode: ["overall", "profit", "ease", "liquidity"].includes(String(raw.sortMode)) ? raw.sortMode as SortMode : undefined,
    bonusIds: Array.isArray(raw.bonusIds) ? raw.bonusIds.filter((id): id is string => typeof id === "string") : undefined,
  };
}

function profitValue(result: RankedMatch, profile: FinancialProfile) {
  return profile.tax_rate_known ? result.estimatedAfterTaxAdvantage : result.grossAdvantage;
}

function easeValue(result: RankedMatch) {
  return (6 - Math.min(5, Math.max(1, result.effort))) * 18
    + result.liquidity * 0.35
    + result.cashFit * 0.12
    + result.ddFit * 0.12
    + result.spendFit * 0.08
    + (result.safetyPassed ? 12 : 0);
}

function sortResults(items: RankedMatch[], mode: SortMode, profile: FinancialProfile) {
  return [...items].sort((a, b) => {
    if (mode === "profit") return profitValue(b, profile) - profitValue(a, profile) || b.score - a.score;
    if (mode === "ease") return easeValue(b) - easeValue(a) || b.score - a.score;
    if (mode === "liquidity") return b.liquidity - a.liquidity || easeValue(b) - easeValue(a);
    return b.score - a.score;
  });
}

function rankMaps(items: RankedMatch[], profile: FinancialProfile): RankMaps {
  const mapFor = (mode: SortMode) => new Map(sortResults(items, mode, profile).map((result, index) => [result.item.id, index + 1]));
  return { overall: mapFor("overall"), profit: mapFor("profit"), ease: mapFor("ease"), liquidity: mapFor("liquidity") };
}

function requiredCash(item: Opportunity) {
  return Math.max(numberValue(item.required_balance), numberValue(item.min_opening_deposit));
}

function monthlyDdNeed(item: Opportunity) {
  const explicit = numberValue(item.reward_monthly_dd_threshold);
  if (explicit > 0) return explicit;
  const required = numberValue(item.direct_deposit_required);
  if (required <= 0) return 0;
  const days = Math.max(1, numberValue(item.direct_deposit_window_days || item.qualification_days || 90));
  const conservativeChecks = Math.max(1, Math.floor(days / 14));
  if (numberValue(item.dd_deposit_count) > conservativeChecks) return Number.POSITIVE_INFINITY;
  const perCheckNeed = Math.max(numberValue(item.dd_min_each), required / conservativeChecks);
  const monthlyFromChecks = perCheckNeed * 26 / 12;
  return Math.max(monthlyFromChecks, required / (days / 30), numberValue(item.reward_monthly_dd_threshold));
}

function hysaExtra(result: RankedMatch, amount: number, profile: FinancialProfile) {
  const days = Math.max(1, numberValue(result.item.benefit_duration_days) || 365);
  const rateDelta = (numberValue(result.item.apy) - numberValue(profile.current_hysa_apy)) / 100;
  const gross = amount * rateDelta * (days / 365);
  const taxMultiplier = profile.tax_rate_known ? 1 - Math.max(0, numberValue(profile.estimated_tax_rate)) / 100 : 1;
  return gross * taxMultiplier;
}

function estimatedExtra(result: RankedMatch, profile: FinancialProfile, hysaAmount?: number) {
  return result.item.category === "hysa" && hysaAmount !== undefined ? hysaExtra(result, hysaAmount, profile) : profitValue(result, profile);
}

function rankPrefix(mode: SortMode) {
  if (mode === "profit") return "profit";
  if (mode === "ease") return "easy";
  if (mode === "liquidity") return "liquid";
  return "overall";
}

function optionLabel(result: RankedMatch, ranks: RankMaps, profile: FinancialProfile, mode: SortMode, amount?: number) {
  const rank = mode === "profit" ? ranks.profit.get(result.item.id) : mode === "ease" ? ranks.ease.get(result.item.id) : mode === "liquidity" ? ranks.liquidity.get(result.item.id) : ranks.overall.get(result.item.id);
  const extra = estimatedExtra(result, profile, amount);
  return `#${rank} ${rankPrefix(mode)} · ${result.item.institution} · ${extra >= 0 ? "+" : ""}${money.format(extra)}`;
}

function shortRequirement(item: Opportunity) {
  const dd = numberValue(item.direct_deposit_required);
  const cash = requiredCash(item);
  const spend = Math.max(numberValue(item.purchase_required_spend), Number(item.purchase_count || 0) * numberValue(item.purchase_min_amount));
  if (dd > 0) return `${money.format(dd)} DD${item.direct_deposit_window_days ? ` / ${item.direct_deposit_window_days}d` : ""}`;
  if (cash > 0) return `${money.format(cash)} cash${item.qualification_days ? ` / ${item.qualification_days}d` : ""}`;
  if (spend > 0) return `${money.format(spend)} normal spend`;
  if (Number(item.purchase_count || 0) > 0) return `${item.purchase_count} purchases`;
  return "simple requirement";
}

function statusText(result: RankedMatch) {
  return result.safetyPassed ? "Cleared" : "Needs review";
}

function statusClass(result: RankedMatch) {
  return result.safetyPassed ? "clear" : "hold";
}

function SimplePick({
  result,
  profile,
  amount,
  amountLabel,
  ranks,
  addedOpportunityIds,
}: {
  result: RankedMatch;
  profile: FinancialProfile;
  amount: number;
  amountLabel: string;
  ranks: RankMaps;
  addedOpportunityIds: string[];
}) {
  const extra = estimatedExtra(result, profile, result.item.category === "hysa" ? amount : undefined);
  return (
    <div className="simple-pick">
      <div className="simple-pick-main">
        <span><small>{result.item.institution}</small><strong>{result.item.product_name}</strong></span>
        <b>{amountLabel}</b>
      </div>
      <div className="simple-pick-tags">
        <span>#{ranks.overall.get(result.item.id)} overall</span>
        <span>#{ranks.profit.get(result.item.id)} profit</span>
        <span>#{ranks.ease.get(result.item.id)} easiest</span>
        <span className={statusClass(result)}>{result.safetyPassed ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}{statusText(result)}</span>
      </div>
      <div className="simple-pick-foot">
        <span><b>{extra >= 0 ? "+" : ""}{money.format(extra)}</b> est. extra · {shortRequirement(result.item)}</span>
        <div>
          <AddToPlanButton opportunity={result.item} alreadyAdded={addedOpportunityIds.includes(result.item.id)} allowPlanningOnHold compact />
          <a href={result.item.official_url} target="_blank" rel="noreferrer">Terms <ArrowUpRight size={12} /></a>
        </div>
      </div>
    </div>
  );
}

function readableDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

export function PlanStrategyHub({
  profile,
  opportunities,
  missions,
  accounts = [],
  usedBanks,
  stateCode,
  addedOpportunityIds,
}: {
  profile: FinancialProfile;
  opportunities: Opportunity[];
  missions: Mission[];
  accounts?: TrackedCashAccount[];
  usedBanks: string[];
  stateCode?: string | null;
  addedOpportunityIds: string[];
}) {
  const stored = useMemo(() => normalizedSelections(profile.roadmap_selected_opportunity_ids), [profile.roadmap_selected_opportunity_ids]);
  const todayLocal = (() => { const now = new Date(); return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-"); })();
  const expiredHysa = accounts.find((account) => account.status === "active" && account.account_kind === "hysa"
    && account.promotional_end_date && account.promotional_end_date.slice(0, 10) <= todayLocal);
  const baselineNeedsConfirmation = Boolean(expiredHysa && expiredHysa.confirmed_post_promo_apy == null);
  const accountConfirmedApy = expiredHysa && expiredHysa.confirmed_post_promo_apy != null
    ? numberValue(expiredHysa.confirmed_post_promo_apy) : null;
  const effectiveProfile = useMemo(() =>
    accountConfirmedApy == null ? profile : { ...profile, current_hysa_apy: accountConfirmedApy },
    [profile, accountConfirmedApy]);
  const ranked = useMemo(() => rankMatches(opportunities, effectiveProfile, usedBanks, stateCode), [opportunities, effectiveProfile, usedBanks, stateCode]);
  const initialSort = stored.sortMode || (profile.ranking_preference === "profit" ? "profit" : profile.ranking_preference === "ease" ? "ease" : profile.ranking_preference === "liquidity" ? "liquidity" : "overall");
  const [sortMode, setSortMode] = useState<SortMode>(initialSort);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const ddBase = useMemo(() => ranked.filter((result) => result.item.category === "checking_bonus" && numberValue(result.item.direct_deposit_required) > 0 && result.ddFit >= 70), [ranked]);
  const hysaBase = useMemo(() => ranked.filter((result) => result.item.category === "hysa" && result.cashFit >= 85), [ranked]);
  const bonusBase = useMemo(() => ranked.filter((result) => result.item.category === "savings_bonus" && result.cashFit >= 85), [ranked]);
  const spendingBase = useMemo(() => ranked.filter((result) => result.item.category === "debit_spend" && result.spendFit >= 75), [ranked]);

  const ddSorted = useMemo(() => sortResults(ddBase, sortMode, profile), [ddBase, sortMode, profile]);
  const bonusSorted = useMemo(() => sortResults(bonusBase, sortMode, profile), [bonusBase, sortMode, profile]);
  const spendingSorted = useMemo(() => sortResults(spendingBase, sortMode, profile), [spendingBase, sortMode, profile]);
  const ddRanks = useMemo(() => rankMaps(ddBase, profile), [ddBase, profile]);
  const hysaRanks = useMemo(() => rankMaps(hysaBase, profile), [hysaBase, profile]);
  const bonusRanks = useMemo(() => rankMaps(bonusBase, profile), [bonusBase, profile]);
  const spendingRanks = useMemo(() => rankMaps(spendingBase, profile), [spendingBase, profile]);

  const activeDdCommitted = missions.filter((mission) => !["complete", "cancelled"].includes(mission.status))
    .reduce((sum, mission) => sum + (mission.opportunity ? monthlyDdNeed(mission.opportunity) : 0), 0);
  const grossMonthlyDd = Math.max(0, numberValue(profile.biweekly_pay)) * 26 / 12;
  const monthlyDdCapacity = Math.max(0, grossMonthlyDd - activeDdCommitted);
  const ddSourceCount = Math.max(1, Math.min(3, Math.floor(numberValue(profile.dd_source_count || 1))));
  const canSplitPayroll = profile.employer_multiple_dd === true;
  const rawSourceCaps = Array.isArray(profile.dd_source_amounts) && profile.dd_source_amounts.length >= ddSourceCount
    ? profile.dd_source_amounts.slice(0, ddSourceCount).map((amount) => Math.max(0, numberValue(amount)) * 26 / 12)
    : Array.from({ length: ddSourceCount }, () => grossMonthlyDd / ddSourceCount);
  const sourceCaps = rawSourceCaps.map((amount, index) => Math.max(0, amount - (index === 0 ? activeDdCommitted : 0)));
  const ddLaneLimit = Math.min(3, Math.max(1, ddSourceCount === 1 ? (canSplitPayroll ? 2 : 1) : (canSplitPayroll ? 3 : ddSourceCount)));
  function ddRoomAt(index: number, ids: string[]) {
    const alreadyUsed = ids.reduce((sum, id) => {
      const result = ddBase.find((row) => row.item.id === id);
      return sum + (result ? monthlyDdNeed(result.item) : 0);
    }, 0);
    if (!canSplitPayroll && ddSourceCount > 1) return Math.min(sourceCaps[index] || 0, Math.max(0, monthlyDdCapacity - alreadyUsed));
    return Math.max(0, monthlyDdCapacity - alreadyUsed);
  }

  const activeCash = missions
    .filter((mission) => !["complete", "cancelled"].includes(mission.status))
    .reduce((sum, mission) => sum + numberValue(mission.amount_committed), 0);
  const totalCash = Math.max(0, numberValue(profile.total_cash));
  const reserve = Math.min(totalCash, numberValue(profile.emergency_reserve));
  const baseAvailableCash = Math.max(0, totalCash - reserve - activeCash);

  function buildDdPlan(seed: string[] = []) {
    const picks: string[] = [];
    let usedMonthly = 0;

    for (const id of seed) {
      const result = ddBase.find((candidate) => candidate.item.id === id);
      if (!result) continue;
      const need = monthlyDdNeed(result.item);
      if (!Number.isFinite(need) || need > ddRoomAt(picks.length, picks) + .01) continue;
      if (picks.some((pick) => ddBase.find((candidate) => candidate.item.id === pick)?.item.institution === result.item.institution)) continue;
      picks.push(id);
      usedMonthly += need;
      if (picks.length >= ddLaneLimit) return picks;
    }

    const preferred = ddSorted.filter((result) => result.safetyPassed);
    const pool = preferred.length ? [...preferred, ...ddSorted.filter((result) => !result.safetyPassed)] : ddSorted;
    for (const result of pool) {
      if (picks.length >= ddLaneLimit) break;
      if (picks.includes(result.item.id)) continue;
      if (picks.some((pick) => ddBase.find((candidate) => candidate.item.id === pick)?.item.institution === result.item.institution)) continue;
      const need = monthlyDdNeed(result.item);
      if (!Number.isFinite(need) || need > ddRoomAt(picks.length, picks) + .01) continue;
      picks.push(result.item.id);
      usedMonthly += need;
    }
    return picks;
  }

  function bestBonusId() {
    const safe = bonusSorted.find((result) => result.safetyPassed && requiredCash(result.item) <= baseAvailableCash + 0.01);
    const planning = bonusSorted.find((result) => requiredCash(result.item) <= baseAvailableCash + 0.01);
    return (safe || planning)?.item.id || "none";
  }

  function bestSpendingId() {
    if (numberValue(profile.monthly_card_spend) <= 0) return "none";
    return (spendingSorted.find((result) => result.safetyPassed) || spendingSorted[0])?.item.id || "none";
  }

  const initialDd = Array.isArray(stored.ddIds) ? buildDdPlan(stored.ddIds.slice(0, ddLaneLimit)) : buildDdPlan();
  const initialBonus = stored.savingsBonusId || bestBonusId();
  const initialSpending = stored.spendingId || bestSpendingId();

  const [ddIds, setDdIds] = useState<string[]>(initialDd);
  const [bonusId, setBonusId] = useState<string>(initialBonus);
  const [spendingId, setSpendingId] = useState<string>(initialSpending);

  const byId = useMemo(() => new Map(ranked.map((result) => [result.item.id, result])), [ranked]);
  const selectedDd = ddIds.map((id) => byId.get(id)).filter((result): result is RankedMatch => Boolean(result));
  const selectedBonus = bonusId === "none" ? null : byId.get(bonusId) || null;
  const selectedSpending = spendingId === "none" ? null : byId.get(spendingId) || null;
  const bonusCash = selectedBonus ? Math.min(baseAvailableCash, requiredCash(selectedBonus.item)) : 0;
  const savingsCash = Math.max(0, baseAvailableCash - bonusCash);

  const hysaSorted = useMemo(() => {
    const sorted = [...hysaBase];
    return sorted.sort((a, b) => {
      if (sortMode === "profit") return hysaExtra(b, savingsCash, effectiveProfile) - hysaExtra(a, savingsCash, effectiveProfile);
      if (sortMode === "ease") return easeValue(b) - easeValue(a);
      if (sortMode === "liquidity") return b.liquidity - a.liquidity;
      return (b.score + Math.max(-50, Math.min(100, hysaExtra(b, savingsCash, effectiveProfile) * .08)))
        - (a.score + Math.max(-50, Math.min(100, hysaExtra(a, savingsCash, effectiveProfile) * .08)));
    });
  }, [hysaBase, sortMode, savingsCash, effectiveProfile]);

  const bestHysa = hysaSorted.find((result) => result.safetyPassed && hysaExtra(result, savingsCash, effectiveProfile) > 0)
    || hysaSorted.find((result) => hysaExtra(result, savingsCash, effectiveProfile) > 0);

  const initialHysa = stored.keepCurrentSavings ? "current" : stored.hysaId || bestHysa?.item.id || "current";
  const [hysaId, setHysaId] = useState<string>(initialHysa);
  const selectedHysa = hysaId === "current" ? null : byId.get(hysaId) || null;

  const plannedDd = selectedDd.reduce((sum, result) => sum + monthlyDdNeed(result.item), 0);
  const spendingFits = spendingBase.length > 0 && numberValue(profile.monthly_card_spend) > 0;
  const currentApy = numberValue(effectiveProfile.current_hysa_apy);

  const selectedUnique = Array.from(new Map([...selectedDd, selectedBonus, selectedSpending].filter((item): item is RankedMatch => Boolean(item)).map((item) => [item.item.id, item])).values());
  const nonSavingsExtra = selectedUnique.reduce((sum, result) => sum + profitValue(result, effectiveProfile), 0);
  const projectedExtra = nonSavingsExtra + (selectedHysa ? hysaExtra(selectedHysa, savingsCash, effectiveProfile) : 0);
  const selectedForSafety = [...selectedDd, selectedHysa, selectedBonus, selectedSpending].filter((item): item is RankedMatch => Boolean(item));
  const holdCount = selectedForSafety.filter((result) => !result.safetyPassed).length;

  async function persist(next: SavedSelections) {
    setSaving(true);
    setMessage("");
    const supabase = createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (!userId) {
      setSaving(false);
      return;
    }
    const legacyBonusIds = [...(next.ddIds || []), next.savingsBonusId, next.spendingId].filter((id): id is string => Boolean(id && id !== "none"));
    const payload: SavedSelections = { ...next, bonusIds: legacyBonusIds };
    const { error } = await supabase.from("financial_profiles").update({
      roadmap_selected_opportunity_ids: payload,
      roadmap_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    setMessage(error ? "Could not save that change." : "Saved");
    setSaving(false);
  }

  function savedPayload(next?: Partial<SavedSelections>): SavedSelections {
    return {
      ddIds,
      hysaId: hysaId === "current" ? null : hysaId,
      keepCurrentSavings: hysaId === "current",
      savingsBonusId: bonusId === "none" ? null : bonusId,
      spendingId: spendingId === "none" ? null : spendingId,
      sortMode,
      ...next,
    };
  }

  function updateSort(next: SortMode) {
    setSortMode(next);
    void persist(savedPayload({ sortMode: next }));
  }

  function updateDd(index: number, value: string) {
    let next: string[];
    if (value === "none") {
      next = index === 0 ? [] : ddIds.slice(0, index);
    } else {
      const prefix = [...ddIds.slice(0, index), value];
      next = buildDdPlan(prefix);
    }
    setDdIds(next);
    void persist(savedPayload({ ddIds: next }));
  }

  function updateHysa(value: string) {
    setHysaId(value);
    void persist(savedPayload({ hysaId: value === "current" ? null : value, keepCurrentSavings: value === "current" }));
  }

  function updateBonus(value: string) {
    setBonusId(value);
    const chosen = value === "none" ? null : byId.get(value) || null;
    const nextBonusCash = chosen ? Math.min(baseAvailableCash, requiredCash(chosen.item)) : 0;
    const nextSavingsCash = Math.max(0, baseAvailableCash - nextBonusCash);
    let nextHysa = hysaId;
    if (nextHysa !== "current") {
      const currentChoice = byId.get(nextHysa);
      if (!currentChoice || requiredCash(currentChoice.item) > nextSavingsCash + 0.01 || hysaExtra(currentChoice, nextSavingsCash, effectiveProfile) <= 0) nextHysa = "current";
    }
    setHysaId(nextHysa);
    void persist(savedPayload({
      savingsBonusId: value === "none" ? null : value,
      hysaId: nextHysa === "current" ? null : nextHysa,
      keepCurrentSavings: nextHysa === "current",
    }));
  }

  function updateSpending(value: string) {
    setSpendingId(value);
    void persist(savedPayload({ spendingId: value === "none" ? null : value }));
  }

  function refreshRecommendations() {
    const nextDd = buildDdPlan();
    const nextBonus = bestBonusId();
    const bonusResult = nextBonus === "none" ? null : byId.get(nextBonus) || null;
    const nextBonusCash = bonusResult ? Math.min(baseAvailableCash, requiredCash(bonusResult.item)) : 0;
    const nextSavingsCash = Math.max(0, baseAvailableCash - nextBonusCash);
    const nextHysa = hysaSorted.find((result) => result.safetyPassed && hysaExtra(result, nextSavingsCash, effectiveProfile) > 0)
      || hysaSorted.find((result) => hysaExtra(result, nextSavingsCash, effectiveProfile) > 0);
    const nextSpending = bestSpendingId();
    const nextHysaId = nextHysa?.item.id || "current";

    setDdIds(nextDd);
    setBonusId(nextBonus);
    setHysaId(nextHysaId);
    setSpendingId(nextSpending);
    void persist({
      ddIds: nextDd,
      hysaId: nextHysaId === "current" ? null : nextHysaId,
      keepCurrentSavings: nextHysaId === "current",
      savingsBonusId: nextBonus === "none" ? null : nextBonus,
      spendingId: nextSpending === "none" ? null : nextSpending,
      sortMode,
    });
  }

  const timeline = useMemo(() => {
    type Event = { date: string; title: string; kind: "active" | "planned" | "expired"; notes: string };
    const events: Event[] = [];
    const add = (date: string | null | undefined, title: string, kind: Event["kind"], notes: string) => {
      if (date) events.push({ date: date.slice(0, 10), title, kind, notes });
    };

    for (const account of accounts.filter((item) => item.status === "active" && item.promotional_end_date)) {
      const end = account.promotional_end_date!.slice(0, 10);
      if (end <= todayLocal && account.confirmed_post_promo_apy == null) {
        add(end, account.institution + " · benefit ended", "expired", "Update your APY and review where to keep this money");
      } else if (end > todayLocal) {
        add(end, account.institution + " · promotional rate ends", "active", "Confirm the new rate and compare alternatives");
      }
    }
    for (const mission of missions.filter((item) => !["complete", "cancelled"].includes(item.status))) {
      const name = mission.institution + " · " + mission.title.split(" — ")[0];
      add(mission.benefit_end_date, name + " rate ends", "active", "Review your benefit before it expires");
      add(mission.qualification_deadline, name + " qualify", "active", "Confirm requirements against posted activity");
      add(mission.payout_due_date, name + " payout check", "active", "Check for the actual reward");
      add(mission.safe_close_review_date, name + " keep/close review", "active", "Review terms before deciding to close");
    }
    const selected = [...selectedDd, selectedBonus, selectedSpending, selectedHysa].filter((item): item is RankedMatch => Boolean(item));
    const activeIds = new Set(missions.map((mission) => mission.opportunity_id).filter(Boolean));
    for (const result of selected) {
      if (activeIds.has(result.item.id)) continue;
      const dates = planningDates(result.item, todayLocal);
      add(dates.qualification, result.item.institution + " · estimated qualification", "planned", "Only applies if you open the offer");
      add(dates.payout, result.item.institution + " · estimated payout", "planned", "Verify the offer's real timeline");
      add(dates.benefitEnd, result.item.institution + " · rate review", "planned", "Re-check your APY after the promotion");
    }
    const unique = Array.from(new Map(events.map((event) => [event.date + ":" + event.title, event])).values());
    return unique.filter((event) => event.kind === "expired" || event.date >= todayLocal)
      .sort((a, b) => (a.kind === "expired" ? -1 : 0) - (b.kind === "expired" ? -1 : 0) || a.date.localeCompare(b.date))
      .slice(0, 9);
  }, [missions, accounts, selectedDd, selectedBonus, selectedSpending, selectedHysa, todayLocal]);

  return (
    <section className="plan-hub plan-hub-simple">
      <div className="plan-hub-hero simple">
        <div className="plan-hub-copy">
          <span className="kicker">YOUR MONEY PLAN</span>
          <h1>Here’s the plan.</h1>
          <p>{money.format(totalCash)} tracked in your plan · {money.format(savingsCash)} planned in savings · {money.format(plannedDd)}/mo for new DD.</p>
          {baselineNeedsConfirmation ? <p className="cash-rate-alert"><ShieldAlert size={14}/> {expiredHysa?.institution} promotion ended {readableDate(expiredHysa.promotional_end_date!)}. Confirm your current APY before trusting interest comparisons.</p> : null}
        </div>
        <div className="plan-hub-return">
          <small>{profile.tax_rate_known ? "EST. AFTER-TAX EXTRA" : "EST. PRE-TAX EXTRA"}</small>
          <strong className={projectedExtra >= 0 ? "positive" : "negative"}>{baselineNeedsConfirmation ? "APY pending" : (projectedExtra >= 0 ? "+" : "") + money.format(projectedExtra)}</strong>
          <span>{baselineNeedsConfirmation ? "Confirm post-promo rate first" : holdCount ? `${holdCount} pick${holdCount === 1 ? "" : "s"} need review` : "selected picks cleared"}</span>
        </div>
      </div>

      <div className="plan-hub-stats compact">
        <div><small>TOTAL CASH</small><strong>{money.format(totalCash)}</strong></div>
        <div><small>ACTIVE OFFERS</small><strong>{missions.filter((mission) => !["complete", "cancelled"].includes(mission.status)).length + accounts.filter((account) => account.status === "active").length}</strong></div>
        <div><small>READY TO USE</small><strong>{money.format(baseAvailableCash)}</strong></div>
        <div><small>NEXT ACTION</small><strong>{timeline.some((event) => event.kind === "expired") ? "Review APY" : timeline.find((event) => event.date >= todayLocal) ? readableDate(timeline.find((event) => event.date >= todayLocal)!.date) : "N/A"}</strong></div>
      </div>

      <AccountTrackerHub missions={missions} accounts={accounts} opportunities={opportunities} />

      <div className="simple-roadmap-head">
        <div><span className="kicker">RECOMMENDED ROADMAP</span><h2>Pick one. The next recommendation updates.</h2><p>Start with Churning’s recommendation, or use any dropdown to choose another option.</p></div>
        <div className="simple-roadmap-actions">
          <select value={sortMode} onChange={(event) => updateSort(event.target.value as SortMode)} disabled={saving}>
            <option value="overall">Best overall</option>
            <option value="profit">Most profit</option>
            <option value="ease">Easiest</option>
            <option value="liquidity">Most liquid</option>
          </select>
          <button type="button" onClick={refreshRecommendations} disabled={saving}><RefreshCw size={14} /> Refresh recommendations</button>
        </div>
      </div>

      <div className="simple-roadmap-grid">
        <section className="simple-roadmap-card dd">
          <div className="simple-roadmap-card-head"><span><Banknote size={18} /></span><div><small>DIRECT DEPOSIT</small><h3>{selectedDd.length ? money.format(plannedDd) + "/mo" : "Skip"}</h3><p>{ddSourceCount} paycheck source{ddSourceCount === 1 ? "" : "s"} · {canSplitPayroll ? "splitting enabled" : "no splitting assumed"}</p></div></div>
          {Array.from({ length: ddLaneLimit }).map((_, index) => {
            const selected = selectedDd[index] || null;
            const availableForThisLine = ddRoomAt(index, ddIds.slice(0, index));
            const otherIds = ddIds.slice(0, index);
            const otherInstitutions = new Set(otherIds.map((id) => ddBase.find((candidate) => candidate.item.id === id)?.item.institution));
            const options = ddSorted.filter((result) => {
              if (selected?.item.id === result.item.id) return true;
              if (otherInstitutions.has(result.item.institution)) return false;
              return monthlyDdNeed(result.item) <= availableForThisLine + 0.01;
            });
            return (
              <div className="simple-dd-line" key={index}>
                <label><span>DD line {index + 1} · {money.format(availableForThisLine)}/mo available · real payroll only</span><select value={selected?.item.id || "none"} onChange={(event) => updateDd(index, event.target.value)} disabled={saving}><option value="none">No DD offer</option>{options.map((result) => <option key={result.item.id} value={result.item.id}>{optionLabel(result, ddRanks, effectiveProfile, sortMode)}</option>)}</select></label>
                {selected ? <SimplePick result={selected} profile={effectiveProfile} amount={monthlyDdNeed(selected.item)} amountLabel={money.format(monthlyDdNeed(selected.item)) + "/mo (" + money.format(Math.ceil(monthlyDdNeed(selected.item) * 12 / 26)) + "/paycheck)"} ranks={ddRanks} addedOpportunityIds={addedOpportunityIds} /> : null}
              </div>
            );
          })}
        </section>

        <section className="simple-roadmap-card">
          <div className="simple-roadmap-card-head"><span><Landmark size={18} /></span><div><small>SAVINGS / HYSA</small><h3>{money.format(savingsCash)}</h3><p>Keep this liquid</p></div></div>
          <label className="simple-roadmap-select"><span>Recommended home</span><select value={hysaId} onChange={(event) => updateHysa(event.target.value)} disabled={saving}><option value="current">Current savings · {baselineNeedsConfirmation ? "APY needs update" : currentApy.toFixed(2) + "% APY"}</option>{hysaSorted.map((result) => <option key={result.item.id} value={result.item.id}>{optionLabel(result, hysaRanks, effectiveProfile, sortMode, savingsCash)} · {numberValue(result.item.apy).toFixed(2)}%</option>)}</select></label>
          {selectedHysa ? <SimplePick result={selectedHysa} profile={effectiveProfile} amount={savingsCash} amountLabel={money.format(savingsCash)} ranks={hysaRanks} addedOpportunityIds={addedOpportunityIds} /> : <div className="simple-current"><WalletCards size={16} /><span><strong>Keep current savings</strong><small>{money.format(savingsCash)} · {baselineNeedsConfirmation ? "Confirm your new APY after the promo" : "current " + currentApy.toFixed(2) + "% APY"}.</small></span></div>}
        </section>

        <section className="simple-roadmap-card">
          <div className="simple-roadmap-card-head"><span><BadgeDollarSign size={18} /></span><div><small>CASH BONUS</small><h3>{selectedBonus ? money.format(bonusCash) : "$0"}</h3><p>{selectedBonus ? "cash assigned" : "keep it in savings"}</p></div></div>
          <label className="simple-roadmap-select"><span>Recommended bonus</span><select value={bonusId} onChange={(event) => updateBonus(event.target.value)} disabled={saving}><option value="none">Skip cash bonus</option>{bonusSorted.filter((result) => requiredCash(result.item) <= baseAvailableCash + .01).map((result) => <option key={result.item.id} value={result.item.id}>{optionLabel(result, bonusRanks, effectiveProfile, sortMode)} · needs {money.format(requiredCash(result.item))}</option>)}</select></label>
          {selectedBonus ? <SimplePick result={selectedBonus} profile={effectiveProfile} amount={bonusCash} amountLabel={money.format(bonusCash)} ranks={bonusRanks} addedOpportunityIds={addedOpportunityIds} /> : null}
        </section>

        {spendingFits ? (
          <section className="simple-roadmap-card">
            <div className="simple-roadmap-card-head"><span><CreditCard size={18} /></span><div><small>OPTIONAL SPENDING</small><h3>{money.format(numberValue(profile.monthly_card_spend))}/mo</h3><p>normal spending only</p></div></div>
            <label className="simple-roadmap-select"><span>Recommended spending reward</span><select value={spendingId} onChange={(event) => updateSpending(event.target.value)} disabled={saving}><option value="none">Skip spending rewards</option>{spendingSorted.map((result) => <option key={result.item.id} value={result.item.id}>{optionLabel(result, spendingRanks, effectiveProfile, sortMode)}</option>)}</select></label>
            {selectedSpending ? <SimplePick result={selectedSpending} profile={effectiveProfile} amount={numberValue(profile.monthly_card_spend)} amountLabel={money.format(numberValue(profile.monthly_card_spend)) + "/mo"} ranks={spendingRanks} addedOpportunityIds={addedOpportunityIds} /> : null}
          </section>
        ) : null}
      </div>

      <div className="simple-plan-note">
        <Sparkles size={15} />
        <span><strong>Why the numbers move:</strong><small>If you pick a cash bonus, that cash comes out of the HYSA lane. If you pick a DD offer, the next DD recommendation is rebuilt from the paycheck capacity left over.</small></span>
      </div>

      <section className="simple-timeline">
        <div className="simple-timeline-head"><CalendarDays size={16} /><span><strong>Your money timeline</strong><small>Account dates first. Future recommendations are estimates until activated.</small></span></div>
        {timeline.length ? <ol className="cash-roadmap-map">{timeline.map((event, index) =>
          <li className={`cash-roadmap-step ${event.kind}`} key={`${event.date}-${event.title}-${index}`}>
            <div className="cash-roadmap-date">{readableDate(event.date)}</div>
            <span className="cash-roadmap-dot" />
            <div className="cash-roadmap-content"><strong>{event.title}</strong><small>{event.notes}</small></div>
            <em>{event.kind === "expired" ? "ACTION NEEDED" : event.kind === "active" ? "ACTIVE" : "PROJECTED"}</em>
          </li>
        )}</ol> : <div className="simple-timeline-empty">Add an account or select an opportunity to see your deadlines here.</div>}
      </section>

      <div className={`plan-safety-footer ${holdCount ? "hold" : "clear"}`}>
        {holdCount ? <ShieldAlert size={17} /> : <ShieldCheck size={17} />}
        <span><strong>{holdCount ? "Some picks still need review." : "Selected picks pass the stored research gate."}</strong><small>{holdCount ? "You can compare them, but do not treat HOLD as permission to open yet." : "Re-check the official terms before moving money."}</small></span>
      </div>
      {message ? <div className="plan-save-message">{message}</div> : null}
    </section>
  );
}
