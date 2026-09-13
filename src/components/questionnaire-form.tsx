"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, CircleHelp, Info, LockKeyhole, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FormattedNumberInput } from "@/components/formatted-number-input";
import { FormattedPercentInput } from "@/components/formatted-percent-input";
import type { FinancialProfile } from "@/lib/types";

const defaults: FinancialProfile = {
  total_cash: 20000,
  savings_cash: 18000,
  checking_cash: 2000,
  emergency_reserve: 5000,
  current_hysa_apy: 0,
  biweekly_pay: 0,
  biweekly_essential_spend: 0,
  estimated_tax_rate: null,
  tax_rate_known: false,
  strategy_mode: 2,
  monthly_card_spend: 0,
  current_spend_reward_rate: 0,
  ranking_preference: "balanced",
  annual_extra_goal: 1000,
  recent_bank_openings: 0,
};

const commonBanks = ["Chase", "Bank of America", "Wells Fargo", "Citi", "Capital One", "Discover", "SoFi", "BMO", "U.S. Bank", "PNC", "Ally", "American Express", "Charles Schwab", "Fidelity", "Navy Federal Credit Union", "Golden 1 Credit Union", "SchoolsFirst FCU", "Truist", "TD Bank", "Citizens", "Huntington", "KeyBank", "Regions", "Santander", "Synchrony", "Marcus by Goldman Sachs", "Barclays", "Local credit union", "Other bank"];
const usStates = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],["DC","District of Columbia"]
] as const;

function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "0").replace(/,/g, "").replace(/%/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dollars(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function QuestionnaireForm({
  initial,
  guestMode = false,
  initialBanks = [],
  initialState = "CA",
}: {
  initial: FinancialProfile | null;
  guestMode?: boolean;
  initialBanks?: string[];
  initialState?: string;
}) {
  const router = useRouter();
  const profile = initial || defaults;
  const [savingsCash, setSavingsCash] = useState(Number(profile.savings_cash || 0));
  const [checkingCash, setCheckingCash] = useState(Number(profile.checking_cash || 0));
  const [emergencyReserve, setEmergencyReserve] = useState(Number(profile.emergency_reserve || 0));
  const [hasCurrentSavingsYield, setHasCurrentSavingsYield] = useState(Number(profile.current_hysa_apy || 0) > 0);
  const [cardSpendKnown, setCardSpendKnown] = useState(Number(profile.monthly_card_spend || 0) > 0);
  const [taxKnown, setTaxKnown] = useState(profile.tax_rate_known);
  const [bankSearch, setBankSearch] = useState("");
  const [bankSelections, setBankSelections] = useState<string[]>(initialBanks);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalCash = savingsCash + checkingCash;
  const availableAfterReserve = Math.max(0, totalCash - emergencyReserve);
  const reserveWarning = emergencyReserve > totalCash;
  const filteredBanks = useMemo(() => commonBanks
    .filter((bank) => !bankSelections.includes(bank) && bank.toLowerCase().includes(bankSearch.trim().toLowerCase()))
    .slice(0, bankSearch ? 12 : 8), [bankSearch, bankSelections]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    if (reserveWarning) {
      setError("Your emergency reserve cannot be larger than the cash you entered.");
      setSaving(false);
      return;
    }

    const form = new FormData(event.currentTarget);
    const selectedBanks = form.getAll("bank_history").map(String);
    const stateCode = String(form.get("state_code") || initialState);
    const financialProfile: FinancialProfile = {
      total_cash: totalCash,
      savings_cash: savingsCash,
      checking_cash: checkingCash,
      emergency_reserve: emergencyReserve,
      current_hysa_apy: hasCurrentSavingsYield ? numberValue(form.get("current_hysa_apy")) : 0,
      biweekly_pay: numberValue(form.get("biweekly_pay")),
      biweekly_essential_spend: numberValue(form.get("biweekly_essential_spend")),
      monthly_card_spend: cardSpendKnown ? numberValue(form.get("monthly_card_spend")) : 0,
      current_spend_reward_rate: cardSpendKnown ? numberValue(form.get("current_spend_reward_rate")) : 0,
      annual_extra_goal: numberValue(form.get("annual_extra_goal")),
      recent_bank_openings: numberValue(form.get("recent_bank_openings")),
      estimated_tax_rate: taxKnown ? numberValue(form.get("estimated_tax_rate")) : null,
      tax_rate_known: taxKnown,
      strategy_mode: numberValue(form.get("strategy_mode")),
      ranking_preference: String(form.get("ranking_preference") || "balanced"),
    };

    if (guestMode) {
      sessionStorage.setItem("churning_guest_profile", JSON.stringify({
        profile: financialProfile,
        banks: selectedBanks,
        stateCode,
        createdAt: new Date().toISOString(),
      }));
      router.push("/guest/recommendations");
      return;
    }

    const supabase = createClient();
    const { data: claimsData, error: authError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (authError || !userId) {
      router.push("/auth?next=/questionnaire");
      return;
    }

    const payload = {
      ...financialProfile,
      estimated_tax_rate: financialProfile.tax_rate_known ? numberValue(form.get("estimated_tax_rate")) : 0,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    const { error: profileError } = await supabase.from("profiles").upsert(
      { user_id: userId, state_code: stateCode, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    const { error: financeError } = await supabase.from("financial_profiles").upsert(payload, { onConflict: "user_id" });

    if (profileError || financeError) {
      setError(profileError?.message || financeError?.message || "We couldn’t save your plan.");
      setSaving(false);
      return;
    }

    const { error: historyDeleteError } = await supabase.from("account_history").delete().eq("user_id", userId).eq("notes", "Reported during onboarding");
    const bankHistoryError = !historyDeleteError && selectedBanks.length
      ? (await supabase.from("account_history").insert(selectedBanks.map((institution) => ({ user_id: userId, institution, notes: "Reported during onboarding", outcome: "existing_or_previous" })))).error
      : historyDeleteError;

    if (bankHistoryError) {
      setError(`Your profile saved, but bank history could not be updated: ${bankHistoryError.message}`);
      setSaving(false);
      return;
    }

    router.push("/recommendations");
    router.refresh();
  }

  return (
    <form className="form-card planner-form" onSubmit={submit}>
      <div className="questionnaire-guidance">
        <div><BadgeCheck size={18} /><span><strong>More accurate answers = better matches.</strong><small>Estimates are okay. Skip optional questions when you truly do not know.</small></span></div>
        <div><Info size={16} /><span>Churning provides educational comparisons and tracking tools, not financial, tax, or legal advice.</span></div>
      </div>

      {guestMode && <div className="guest-warning" role="note"><span className="guest-warning-icon"><LockKeyhole size={18} /></span><div><strong>Explore without creating an account</strong><p>Your answers are used only to build this guest plan in your current browser session. Create an account later if you want to save and track progress.</p></div></div>}

      <div className="form-stack">
        <section className="planner-section">
          <div className="form-section-heading"><span>01</span><div><h3>Where is your cash today?</h3><p>Enter the liquid cash you keep outside long-term investments. We calculate the total automatically and keep your reserve outside the opportunity budget.</p></div></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="savings_cash">Cash currently in savings</label><FormattedNumberInput id="savings_cash" name="savings_cash" value={savingsCash} onValueChange={setSavingsCash} required /><small>Include savings and money-market cash you could move.</small></div>
            <div className="field"><label htmlFor="checking_cash">Cash currently in checking</label><FormattedNumberInput id="checking_cash" name="checking_cash" value={checkingCash} onValueChange={setCheckingCash} /><small>Do not include money you need before your next paycheck.</small></div>
            <div className="field"><label htmlFor="emergency_reserve">Cash you want left completely untouched</label><FormattedNumberInput id="emergency_reserve" name="emergency_reserve" value={emergencyReserve} onValueChange={setEmergencyReserve} required /><small>Your reserve stays outside the opportunity budget.</small></div>
            <div className="field"><label htmlFor="state_code">Home state</label><select id="state_code" name="state_code" defaultValue={initialState}>{usStates.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select><small>Used only to filter state-limited offers and terms.</small></div>
          </div>

          <div className={`cash-auto-summary ${reserveWarning ? "warning" : ""}`}>
            <div><small>Total liquid cash</small><strong>{dollars(totalCash)}</strong></div>
            <div><small>Protected reserve</small><strong>{dollars(Math.min(emergencyReserve, totalCash))}</strong></div>
            <div><small>Cash available after reserve</small><strong>{dollars(availableAfterReserve)}</strong></div>
          </div>

          <div className="optional-toggle-block">
            <div><strong>Are you currently earning interest on your savings?</strong><small>This gives us your real baseline so we can compare whether an offer is actually better.</small></div>
            <div className="choice-pills"><button type="button" className={hasCurrentSavingsYield ? "active" : ""} onClick={() => setHasCurrentSavingsYield(true)}>Yes</button><button type="button" className={!hasCurrentSavingsYield ? "active" : ""} onClick={() => setHasCurrentSavingsYield(false)}>No / not sure</button></div>
          </div>
          {hasCurrentSavingsYield && <div className="field inline-compact-field"><label htmlFor="current_hysa_apy">Current savings APY</label><FormattedPercentInput id="current_hysa_apy" name="current_hysa_apy" max={20} defaultValue={Number(profile.current_hysa_apy || 0)} placeholder="4.10" /><small>Use the APY shown by your bank, not the monthly interest amount.</small></div>}
        </section>

        <section className="planner-section">
          <div className="form-section-heading"><span>02</span><div><h3>Your paycheck and normal spending</h3><p>This helps us avoid recommending direct-deposit or spending requirements that do not fit your real cash flow.</p></div></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="biweekly_pay">About how much is each biweekly take-home paycheck?</label><FormattedNumberInput id="biweekly_pay" name="biweekly_pay" defaultValue={Number(profile.biweekly_pay)} placeholder="1,500" /><small>Enter what usually lands in your account after payroll deductions.</small></div>
            <div className="field"><label htmlFor="biweekly_essential_spend">About how much of each two-week paycheck goes to essentials?</label><FormattedNumberInput id="biweekly_essential_spend" name="biweekly_essential_spend" defaultValue={Number(profile.biweekly_essential_spend)} placeholder="900" /><small>Think rent, food, gas, bills, and other normal needs.</small></div>
          </div>

          <div className="optional-toggle-block">
            <div><strong>Do you want card spending included in your matches?</strong><small>Optional. This can help surface debit or spending rewards that fit purchases you already make.</small></div>
            <div className="choice-pills"><button type="button" className={cardSpendKnown ? "active" : ""} onClick={() => setCardSpendKnown(true)}>Yes</button><button type="button" className={!cardSpendKnown ? "active" : ""} onClick={() => setCardSpendKnown(false)}>N/A</button></div>
          </div>
          {cardSpendKnown && <div className="form-grid compact-top-gap">
            <div className="field"><label htmlFor="monthly_card_spend">Normal monthly card spending</label><FormattedNumberInput id="monthly_card_spend" name="monthly_card_spend" defaultValue={Number(profile.monthly_card_spend)} placeholder="800" /></div>
            <div className="field"><label htmlFor="current_spend_reward_rate">Current debit or card cash-back rate</label><FormattedPercentInput id="current_spend_reward_rate" name="current_spend_reward_rate" max={20} defaultValue={Number(profile.current_spend_reward_rate)} placeholder="1.5" /><small>Enter the percentage you normally earn on everyday purchases.</small></div>
          </div>}
        </section>

        <section className="planner-section">
          <div className="form-section-heading"><span>03</span><div><h3>How hands-on do you want to be?</h3><p>Your pace controls how many opportunities we surface at once. You can change it anytime.</p></div></div>
          <div className="strategy-options detailed">
            {[
              { id: 1, name: "Simple", badge: "LOW UPKEEP", copy: "Usually one active move at a time. Prioritizes liquidity, easy requirements, and fewer accounts to manage." },
              { id: 2, name: "Balanced", badge: "RECOMMENDED", copy: "A practical mix of return and effort. Usually one primary opportunity plus a strong savings home for idle cash." },
              { id: 3, name: "Active", badge: "MORE TRACKING", copy: "Surfaces more simultaneous opportunities, including multiple direct-deposit lanes when your income can realistically support them." },
            ].map((item) => (
              <div className="strategy-option" key={item.id}><input id={`strategy-${item.id}`} name="strategy_mode" type="radio" value={item.id} defaultChecked={profile.strategy_mode === item.id} /><label htmlFor={`strategy-${item.id}`}><span className="strategy-badge">{item.badge}</span><b>{item.name}</b><small>{item.copy}</small></label></div>
            ))}
          </div>
          <div className="form-grid" style={{ marginTop: 17 }}>
            <div className="field"><label htmlFor="ranking_preference">What should we prioritize first?</label><select id="ranking_preference" name="ranking_preference" defaultValue={profile.ranking_preference}><option value="balanced">Best overall fit</option><option value="profit">Highest estimated value</option><option value="ease">Simplest requirements</option><option value="liquidity">Keep cash most accessible</option></select><small>Balanced considers value, effort, liquidity, and fit together.</small></div>
            <div className="field"><label htmlFor="annual_extra_goal">Extra annual cash earnings goal</label><FormattedNumberInput id="annual_extra_goal" name="annual_extra_goal" defaultValue={Number(profile.annual_extra_goal)} placeholder="1,000" /><small>Optional target for bonuses + incremental interest.</small></div>
          </div>
        </section>

        <section className="planner-section">
          <div className="form-section-heading"><span>04</span><div><h3>Optional tax estimate</h3><p>We use this only to estimate what a bonus or interest may be worth after taxes. If you do not know it, skip it and we will show pre-tax comparisons.</p></div></div>
          <div className="switch-row"><input id="tax-known" type="checkbox" checked={taxKnown} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setTaxKnown(event.target.checked)} /><label htmlFor="tax-known">I know my approximate combined tax rate</label></div>
          {taxKnown && <div className="field" style={{ marginTop: 14, maxWidth: 300 }}><label htmlFor="estimated_tax_rate">Approximate combined tax rate</label><FormattedPercentInput id="estimated_tax_rate" name="estimated_tax_rate" max={60} defaultValue={Number(profile.estimated_tax_rate || 0)} placeholder="22" /></div>}
          <div className="explain-inline"><CircleHelp size={16} /><span>Example: a 22% estimate means we would show a $400 taxable bonus as roughly $312 after estimated taxes. Your actual tax treatment can differ.</span></div>
        </section>

        <section className="planner-section">
          <div className="form-section-heading"><span>05</span><div><h3>Your banking history</h3><p>This helps flag new-customer restrictions and account-opening intensity. It does not guarantee approval or denial.</p></div></div>
          <div className="form-grid banking-history-grid">
            <div className="field"><label htmlFor="recent_bank_openings">Checking or savings accounts opened in the last 12 months</label><FormattedNumberInput id="recent_bank_openings" name="recent_bank_openings" defaultValue={Number(profile.recent_bank_openings || 0)} /><small>Include accounts opened outside Churning too.</small></div>
            <div className="banking-signal-note"><strong>Why we ask</strong><p>Banks use different screening and eligibility rules. Churning treats this as a planning signal and publishes known ChexSystems/EWS/inquiry research when available.</p></div>
          </div>
          <div className="bank-selector">
            {bankSelections.map((bank) => <input key={bank} type="hidden" name="bank_history" value={bank} />)}
            <div className="bank-search-field"><input type="search" value={bankSearch} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setBankSearch(event.target.value)} placeholder="Search Chase, SoFi, Golden 1..." aria-label="Search banks" /></div>
            {bankSelections.length > 0 && <div className="selected-bank-chips">{bankSelections.map((bank) => <button type="button" key={bank} onClick={() => setBankSelections((current) => current.filter((item) => item !== bank))}>{bank}<span>×</span></button>)}</div>}
            <div className="bank-search-results">
              {filteredBanks.map((bank) => <button type="button" key={bank} onClick={() => { setBankSelections((current) => [...current, bank]); setBankSearch(""); }}><span>{bank}</span><b>+ Add</b></button>)}
              {bankSearch.trim().length >= 2 && !commonBanks.some((bank) => bank.toLowerCase() === bankSearch.trim().toLowerCase()) && !bankSelections.some((bank) => bank.toLowerCase() === bankSearch.trim().toLowerCase()) && <button className="custom-bank-add" type="button" onClick={() => { setBankSelections((current) => [...current, bankSearch.trim()]); setBankSearch(""); }}><span>Add “{bankSearch.trim()}”</span><b>+ Custom</b></button>}
            </div>
            <p className="bank-selector-help">Add institutions you currently use or have used for deposit bonuses before. We use this to trigger a stricter eligibility check—not to automatically disqualify you.</p>
          </div>
        </section>
      </div>

      {error && <div className="form-error" style={{ marginTop: 18 }}>{error}</div>}
      <div className="form-actions">{guestMode && <Link className="text-link back-link" href="/"><ArrowLeft size={16} /> Back home</Link>}<button className="button primary" type="submit" disabled={saving}>{saving ? "Building your matches…" : <><Sparkles size={17} /> See my recommendations <ArrowRight size={18} /></>}</button></div>
    </form>
  );
}
