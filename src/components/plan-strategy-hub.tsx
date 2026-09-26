"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { createClient } from "@/lib/supabase/client";
import { money, numberValue, rankMatches } from "@/lib/plan-math";
import type { FinancialProfile, Mission, Opportunity } from "@/lib/types";

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
  const days = Math.max(30, numberValue(item.direct_deposit_window_days || item.qualification_days || 30));
  return required / Math.max(1, days / 30);
}

function requirementText(item: Opportunity) {
  const dd = numberValue(item.direct_deposit_required);
  const cash = requiredCash(item);
  const spend = Math.max(numberValue(item.purchase_required_spend), Number(item.purchase_count || 0) * numberValue(item.purchase_min_amount));
  if (dd > 0) return `${money.format(dd)} qualifying DD${item.direct_deposit_window_days ? ` in ${item.direct_deposit_window_days} days` : ""}`;
  if (cash > 0) return `${money.format(cash)} cash requirement${item.qualification_days ? ` · ${item.qualification_days} days` : ""}`;
  if (spend > 0) return `${money.format(spend)} normal spend${item.spend_window_days || item.qualification_days ? ` · ${item.spend_window_days || item.qualification_days} days` : ""}`;
  if (Number(item.purchase_count || 0) > 0) return `${item.purchase_count} qualifying purchases`;
  return "No major cash requirement stored";
}

function optionLabel(result: RankedMatch, ranks: RankMaps, profile: FinancialProfile) {
  const profit = profitValue(result, profile);
  return `#${ranks.overall.get(result.item.id)} overall · #${ranks.profit.get(result.item.id)} profit · #${ranks.ease.get(result.item.id)} easy · ${result.item.institution} · ${profit >= 0 ? "+" : ""}${money.format(profit)}`;
}

function selectedStatus(result?: RankedMatch | null) {
  if (!result) return null;
  if (result.safetyPassed) return { text: "Research cleared", className: "clear", icon: <ShieldCheck size={13} /> };
  return { text: result.researchReady ? "Final safety review" : "Research hold", className: "hold", icon: <ShieldAlert size={13} /> };
}

function OpportunityDetail({ result, profile, addedOpportunityIds }: { result: RankedMatch; profile: FinancialProfile; addedOpportunityIds: string[] }) {
  const status = selectedStatus(result)!;
  const profit = profitValue(result, profile);
  return (
    <div className="lane-selected-detail">
      <div className="lane-selected-head">
        <div><small>{result.item.institution}</small><strong>{result.item.product_name}</strong></div>
        <span className={`lane-status ${status.className}`}>{status.icon}{status.text}</span>
      </div>
      <div className="lane-selected-metrics">
        <span><small>Estimated extra</small><b className={profit >= 0 ? "positive" : "negative"}>{profit >= 0 ? "+" : ""}{money.format(profit)}</b></span>
        <span><small>Requirement</small><b>{requirementText(result.item)}</b></span>
        <span><small>Effort</small><b>{Math.round(result.effort)}/5</b></span>
        <span><small>Evidence</small><b>{Math.round(result.confidence)}%</b></span>
      </div>
      <div className="lane-selected-actions">
        <AddToPlanButton opportunity={result.item} alreadyAdded={addedOpportunityIds.includes(result.item.id)} allowPlanningOnHold />
        <a href={result.item.official_url} target="_blank" rel="noreferrer">Official terms <ArrowUpRight size={13} /></a>
      </div>
    </div>
  );
}

export function PlanStrategyHub({
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
  const stored = useMemo(() => normalizedSelections(profile.roadmap_selected_opportunity_ids), [profile.roadmap_selected_opportunity_ids]);
  const ranked = useMemo(() => rankMatches(opportunities, profile, usedBanks, stateCode), [opportunities, profile, usedBanks, stateCode]);
  const initialSort = stored.sortMode || (profile.ranking_preference === "profit" ? "profit" : profile.ranking_preference === "ease" ? "ease" : profile.ranking_preference === "liquidity" ? "liquidity" : "overall");
  const [sortMode, setSortMode] = useState<SortMode>(initialSort);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const ddBase = useMemo(() => ranked.filter((result) => result.item.category === "checking_bonus" && numberValue(result.item.direct_deposit_required) > 0 && result.ddFit >= 70), [ranked]);
  const hysaBase = useMemo(() => ranked.filter((result) => result.item.category === "hysa" && result.cashFit >= 85), [ranked]);
  const bonusBase = useMemo(() => ranked.filter((result) => result.item.category === "savings_bonus" && result.cashFit >= 85), [ranked]);
  const spendingBase = useMemo(() => ranked.filter((result) => result.item.category === "debit_spend" && result.spendFit >= 75), [ranked]);

  const ddSorted = useMemo(() => sortResults(ddBase, sortMode, profile), [ddBase, sortMode, profile]);
  const hysaSorted = useMemo(() => sortResults(hysaBase, sortMode, profile), [hysaBase, sortMode, profile]);
  const bonusSorted = useMemo(() => sortResults(bonusBase, sortMode, profile), [bonusBase, sortMode, profile]);
  const spendingSorted = useMemo(() => sortResults(spendingBase, sortMode, profile), [spendingBase, sortMode, profile]);

  const ddRanks = useMemo(() => rankMaps(ddBase, profile), [ddBase, profile]);
  const hysaRanks = useMemo(() => rankMaps(hysaBase, profile), [hysaBase, profile]);
  const bonusRanks = useMemo(() => rankMaps(bonusBase, profile), [bonusBase, profile]);
  const spendingRanks = useMemo(() => rankMaps(spendingBase, profile), [spendingBase, profile]);

  const monthlyDdCapacity = Math.max(0, numberValue(profile.biweekly_pay)) * (26 / 12);
  const ddLaneLimit = profile.employer_multiple_dd === true && ddBase.length > 1 ? 2 : 1;

  const defaultDdIds = useMemo(() => {
    const preferred = ddSorted.filter((result) => result.safetyPassed);
    const pool = preferred.length ? preferred : ddSorted;
    const picks: string[] = [];
    let usedMonthly = 0;
    for (const result of pool) {
      if (picks.length >= ddLaneLimit) break;
      if (picks.some((id) => ddBase.find((candidate) => candidate.item.id === id)?.item.institution === result.item.institution)) continue;
      const need = monthlyDdNeed(result.item);
      if (need > 0 && usedMonthly + need > monthlyDdCapacity + 0.01) continue;
      picks.push(result.item.id);
      usedMonthly += need;
    }
    return picks;
  }, [ddSorted, ddLaneLimit, ddBase, monthlyDdCapacity]);

  const bestHysa = hysaSorted.find((result) => result.safetyPassed && profitValue(result, profile) > 0);
  const bestBonus = bonusSorted.find((result) => result.safetyPassed);
  const bestSpending = spendingSorted.find((result) => result.safetyPassed);

  const [ddIds, setDdIds] = useState<string[]>(() => (stored.ddIds?.length ? stored.ddIds.slice(0, ddLaneLimit) : defaultDdIds));
  const [hysaId, setHysaId] = useState<string>(() => stored.keepCurrentSavings ? "current" : stored.hysaId || bestHysa?.item.id || "current");
  const [bonusId, setBonusId] = useState<string>(() => stored.savingsBonusId || bestBonus?.item.id || "none");
  const [spendingId, setSpendingId] = useState<string>(() => stored.spendingId || bestSpending?.item.id || "none");

  const byId = useMemo(() => new Map(ranked.map((result) => [result.item.id, result])), [ranked]);
  const selectedDd = ddIds.map((id) => byId.get(id)).filter((result): result is RankedMatch => Boolean(result));
  const selectedHysa = hysaId === "current" ? null : byId.get(hysaId) || null;
  const selectedBonus = bonusId === "none" ? null : byId.get(bonusId) || null;
  const selectedSpending = spendingId === "none" ? null : byId.get(spendingId) || null;

  const activeCash = missions
    .filter((mission) => !["complete", "cancelled"].includes(mission.status))
    .reduce((sum, mission) => sum + numberValue(mission.amount_committed), 0);
  const totalCash = Math.max(0, numberValue(profile.total_cash));
  const reserve = Math.min(totalCash, numberValue(profile.emergency_reserve));
  const availableCash = Math.max(0, totalCash - reserve - activeCash);
  const bonusCash = selectedBonus ? Math.min(availableCash, requiredCash(selectedBonus.item)) : 0;
  const savingsCash = Math.max(0, availableCash - bonusCash);
  const plannedDd = selectedDd.reduce((sum, result) => sum + monthlyDdNeed(result.item), 0);

  const selectedUnique = Array.from(new Map([...selectedDd, selectedBonus, selectedSpending].filter((item): item is RankedMatch => Boolean(item)).map((item) => [item.item.id, item])).values());
  const nonSavingsExtra = selectedUnique.reduce((sum, result) => sum + profitValue(result, profile), 0);
  const hysaDays = selectedHysa ? Math.max(1, numberValue(selectedHysa.item.benefit_duration_days) || 365) : 365;
  const hysaRateDelta = selectedHysa ? (numberValue(selectedHysa.item.apy) - numberValue(profile.current_hysa_apy)) / 100 : 0;
  const grossHysaExtra = savingsCash * hysaRateDelta * (hysaDays / 365);
  const taxMultiplier = profile.tax_rate_known ? 1 - Math.max(0, numberValue(profile.estimated_tax_rate)) / 100 : 1;
  const hysaExtra = grossHysaExtra * taxMultiplier;
  const projectedExtra = nonSavingsExtra + hysaExtra;

  const selectedForSafety = [...selectedDd, selectedHysa, selectedBonus, selectedSpending].filter((item): item is RankedMatch => Boolean(item));
  const holdCount = selectedForSafety.filter((result) => !result.safetyPassed).length;
  const spendingFits = spendingBase.length > 0 && numberValue(profile.monthly_card_spend) > 0;
  const currentApy = numberValue(profile.current_hysa_apy);

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
    setMessage(error ? "Could not save that plan change." : "Plan saved.");
    setSaving(false);
  }

  function currentSaved(next?: Partial<SavedSelections>): SavedSelections {
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
    void persist(currentSaved({ sortMode: next }));
  }

  function updateDd(index: number, value: string) {
    const next = [...ddIds];
    if (value === "none") next.splice(index, 1);
    else next[index] = value;
    const clean = next.filter(Boolean).slice(0, ddLaneLimit);
    setDdIds(clean);
    void persist(currentSaved({ ddIds: clean }));
  }

  function updateHysa(value: string) {
    setHysaId(value);
    void persist(currentSaved({ hysaId: value === "current" ? null : value, keepCurrentSavings: value === "current" }));
  }

  function updateBonus(value: string) {
    setBonusId(value);
    void persist(currentSaved({ savingsBonusId: value === "none" ? null : value }));
  }

  function updateSpending(value: string) {
    setSpendingId(value);
    void persist(currentSaved({ spendingId: value === "none" ? null : value }));
  }

  const planSentence = [
    `Keep ${money.format(reserve)} protected`,
    selectedBonus && bonusCash > 0 ? `reserve ${money.format(bonusCash)} for ${selectedBonus.item.institution}'s cash-bonus requirement` : null,
    `keep ${money.format(savingsCash)} ${selectedHysa ? `in ${selectedHysa.item.institution}` : `in your current savings${currentApy > 0 ? ` at ${currentApy.toFixed(2)}%` : ""}`}`,
    selectedDd.length ? `route about ${money.format(plannedDd)}/month across ${selectedDd.length} DD lane${selectedDd.length === 1 ? "" : "s"}` : null,
    selectedSpending ? `use ${selectedSpending.item.institution} only for normal spending you already planned` : null,
  ].filter(Boolean).join("; ");

  return (
    <section className="plan-hub">
      <div className="plan-hub-hero">
        <div className="plan-hub-copy">
          <span className="kicker">YOUR PERSONAL CASH PLAN</span>
          <h1>One plan. Four clear money lanes.</h1>
          <p>{planSentence}. {holdCount ? `${holdCount} selected lane${holdCount === 1 ? " is" : "s are"} still on research hold, so treat this as planning—not permission to open yet.` : "Every selected offer currently passes the stored research gate."}</p>
        </div>
        <div className="plan-hub-return">
          <small>{profile.tax_rate_known ? "EST. AFTER-TAX EXTRA" : "EST. PRE-TAX EXTRA"}</small>
          <strong className={projectedExtra >= 0 ? "positive" : "negative"}>{projectedExtra >= 0 ? "+" : ""}{money.format(projectedExtra)}</strong>
          <span>vs keeping the same cash at your stored baseline</span>
        </div>
      </div>

      <div className="plan-hub-stats">
        <div><small>TOTAL CASH</small><strong>{money.format(totalCash)}</strong><span>entered in your profile</span></div>
        <div><small>PROTECTED</small><strong>{money.format(reserve)}</strong><span>not used for offers</span></div>
        <div><small>CASH BONUS LANE</small><strong>{money.format(bonusCash)}</strong><span>{selectedBonus ? selectedBonus.item.institution : "none selected"}</span></div>
        <div><small>LIQUID SAVINGS</small><strong>{money.format(savingsCash)}</strong><span>{selectedHysa ? selectedHysa.item.institution : "current savings"}</span></div>
        <div><small>DD PLANNED</small><strong>{money.format(plannedDd)}/mo</strong><span>of {money.format(monthlyDdCapacity)}/mo capacity</span></div>
      </div>

      <div className="plan-rank-toolbar">
        <div><Sparkles size={16} /><span><strong>How should Churning rank your options?</strong><small>Your questionnaire preference is the starting point. Change it here anytime.</small></span></div>
        <select value={sortMode} onChange={(event) => updateSort(event.target.value as SortMode)} disabled={saving}>
          <option value="overall">Best overall fit</option>
          <option value="profit">Highest estimated profit</option>
          <option value="ease">Easiest to complete</option>
          <option value="liquidity">Best access to cash</option>
        </select>
      </div>

      <div className="plan-lane-grid">
        <section className="plan-lane-card dd-lane">
          <div className="plan-lane-title"><span className="plan-lane-icon"><Banknote size={19} /></span><div><small>01 · DIRECT DEPOSIT</small><h2>Put each paycheck line to work.</h2><p>Ranked using the DD amount you entered, the offer window, effort, research quality, and your selected ranking style.</p></div></div>
          <div className="dd-capacity-bar"><span style={{ width: `${Math.min(100, monthlyDdCapacity > 0 ? (plannedDd / monthlyDdCapacity) * 100 : 0)}%` }} /><small>{money.format(plannedDd)}/mo planned of {money.format(monthlyDdCapacity)}/mo available</small></div>
          {Array.from({ length: ddLaneLimit }).map((_, index) => {
            const selected = selectedDd[index] || null;
            const otherSelected = ddIds.filter((_, i) => i !== index);
            return (
              <div className="dd-line" key={index}>
                <label><span>Direct Deposit Line {index + 1}</span><select value={selected?.item.id || "none"} onChange={(event) => updateDd(index, event.target.value)} disabled={saving}><option value="none">No DD offer selected</option>{ddSorted.map((result) => <option key={result.item.id} value={result.item.id} disabled={otherSelected.includes(result.item.id)}>{optionLabel(result, ddRanks, profile)}</option>)}</select></label>
                {selected ? <OpportunityDetail result={selected} profile={profile} addedOpportunityIds={addedOpportunityIds} /> : <div className="lane-empty">No DD lane selected. Your cash plan still works without one.</div>}
              </div>
            );
          })}
          {profile.employer_multiple_dd !== true && ddBase.length > 1 ? <div className="lane-note"><ShieldAlert size={14} /><span>Only one DD lane is shown because your profile does not confirm that payroll can split deposits across multiple accounts.</span></div> : null}
        </section>

        <section className="plan-lane-card savings-lane">
          <div className="plan-lane-title"><span className="plan-lane-icon"><Landmark size={19} /></span><div><small>02 · SAVINGS / HYSA</small><h2>Give idle cash the best home.</h2><p>We compare every stored HYSA against the APY you already earn. A new account does not win just because its headline rate looks high.</p></div></div>
          <label className="lane-select"><span>Savings destination</span><select value={hysaId} onChange={(event) => updateHysa(event.target.value)} disabled={saving}><option value="current">Current savings · {currentApy.toFixed(2)}% APY · keep it simple</option>{hysaSorted.map((result) => <option key={result.item.id} value={result.item.id}>{optionLabel(result, hysaRanks, profile)} · {numberValue(result.item.apy).toFixed(2)}% APY</option>)}</select></label>
          {selectedHysa ? <OpportunityDetail result={selectedHysa} profile={profile} addedOpportunityIds={addedOpportunityIds} /> : <div className="current-savings-card"><WalletCards size={18} /><span><small>CURRENT BASELINE</small><strong>{money.format(savingsCash)} stays liquid at {currentApy.toFixed(2)}% APY</strong><p>Churning will not recommend a lower-yield account just because it is new. Switch only when the incremental value and requirements make sense.</p></span></div>}
        </section>

        <section className="plan-lane-card bonus-lane">
          <div className="plan-lane-title"><span className="plan-lane-icon"><BadgeDollarSign size={19} /></span><div><small>03 · CASH BONUS</small><h2>Use cash only when the bonus beats the HYSA opportunity cost.</h2><p>The optimizer subtracts the interest you give up while money is tied to a balance or hold requirement.</p></div></div>
          <label className="lane-select"><span>Cash-funded bonus</span><select value={bonusId} onChange={(event) => updateBonus(event.target.value)} disabled={saving}><option value="none">No cash bonus · keep the money in savings</option>{bonusSorted.map((result) => <option key={result.item.id} value={result.item.id}>{optionLabel(result, bonusRanks, profile)} · needs {money.format(requiredCash(result.item))}</option>)}</select></label>
          {selectedBonus ? <OpportunityDetail result={selectedBonus} profile={profile} addedOpportunityIds={addedOpportunityIds} /> : <div className="lane-empty">No cash-funded bonus is currently selected. The full amount stays in your savings lane.</div>}
        </section>

        {spendingFits ? (
          <section className="plan-lane-card spending-lane">
            <div className="plan-lane-title"><span className="plan-lane-icon"><CreditCard size={19} /></span><div><small>04 · OPTIONAL SPENDING</small><h2>Earn from purchases you were already going to make.</h2><p>This lane is only shown because you entered normal monthly spending that can fit at least one stored debit-spend opportunity.</p></div></div>
            <label className="lane-select"><span>Spending option</span><select value={spendingId} onChange={(event) => updateSpending(event.target.value)} disabled={saving}><option value="none">Skip spending rewards</option>{spendingSorted.map((result) => <option key={result.item.id} value={result.item.id}>{optionLabel(result, spendingRanks, profile)}</option>)}</select></label>
            {selectedSpending ? <OpportunityDetail result={selectedSpending} profile={profile} addedOpportunityIds={addedOpportunityIds} /> : <div className="lane-empty">Optional. Do not spend extra money just to earn a bank reward.</div>}
          </section>
        ) : null}
      </div>

      <div className={`plan-safety-footer ${holdCount ? "hold" : "clear"}`}>
        {holdCount ? <ShieldAlert size={17} /> : <CheckCircle2 size={17} />}
        <span><strong>{holdCount ? "Planning is ready; action is not." : "Selected lanes pass the stored research gate."}</strong><small>{holdCount ? "A HOLD option can stay visible for comparison, but Churning should not treat it as cleared until the missing inquiry, Chex/EWS, tax, insurance, or close-rule research is resolved." : "Still re-check current official terms immediately before opening or moving money."}</small></span>
      </div>
      {message ? <div className="plan-save-message">{message}</div> : null}
    </section>
  );
}
