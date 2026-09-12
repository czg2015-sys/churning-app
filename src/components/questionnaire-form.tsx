"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, DatabaseZap, LockKeyhole, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GuestWorkspace } from "@/components/guest-workspace";
import type { FinancialProfile, Opportunity } from "@/lib/types";

const defaults: FinancialProfile = {
  total_cash: 20000,
  savings_cash: 20000,
  checking_cash: 0,
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
const noOpportunities: Opportunity[] = [];
const usStates = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],["DC","District of Columbia"]
] as const;

function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function QuestionnaireForm({
  initial,
  guestMode = false,
  opportunities = noOpportunities,
  initialBanks = [],
  initialState = "CA",
}: {
  initial: FinancialProfile | null;
  guestMode?: boolean;
  opportunities?: Opportunity[];
  initialBanks?: string[];
  initialState?: string;
}) {
  const router = useRouter();
  const [guestProfile, setGuestProfile] = useState<FinancialProfile | null>(null);
  const [guestBanks, setGuestBanks] = useState<string[]>([]);
  const [guestState, setGuestState] = useState(initialState);
  const [bankSearch, setBankSearch] = useState("");
  const [bankSelections, setBankSelections] = useState<string[]>(initialBanks);
  const [showGuestPlan, setShowGuestPlan] = useState(false);
  const profile = guestProfile || initial || defaults;
  const [taxKnown, setTaxKnown] = useState(profile.tax_rate_known);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const totalCash = numberValue(form.get("total_cash"));
    const checkingCash = numberValue(form.get("checking_cash"));
    const selectedBanks = form.getAll("bank_history").map(String);
    const stateCode = String(form.get("state_code") || initialState);
    const financialProfile: FinancialProfile = {
      total_cash: totalCash,
      savings_cash: Math.max(0, totalCash - checkingCash),
      checking_cash: checkingCash,
      emergency_reserve: numberValue(form.get("emergency_reserve")),
      current_hysa_apy: numberValue(form.get("current_hysa_apy")),
      biweekly_pay: numberValue(form.get("biweekly_pay")),
      biweekly_essential_spend: numberValue(form.get("biweekly_essential_spend")),
      monthly_card_spend: numberValue(form.get("monthly_card_spend")),
      current_spend_reward_rate: numberValue(form.get("current_spend_reward_rate")),
      annual_extra_goal: numberValue(form.get("annual_extra_goal")),
      recent_bank_openings: numberValue(form.get("recent_bank_openings")),
      estimated_tax_rate: taxKnown ? numberValue(form.get("estimated_tax_rate")) : null,
      tax_rate_known: taxKnown,
      strategy_mode: numberValue(form.get("strategy_mode")),
      ranking_preference: String(form.get("ranking_preference") || "balanced"),
    };

    if (guestMode) {
      setGuestProfile(financialProfile);
      setGuestBanks(selectedBanks);
      setGuestState(stateCode);
      setShowGuestPlan(true);
      setSaving(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const supabase = createClient();
    const { data: claimsData, error: authError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (authError || !userId) {
      router.push("/auth");
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
    router.push("/my-plan");
    router.refresh();
  }

  if (guestMode && showGuestPlan && guestProfile) {
    return (
      <div className="guest-results">
        <div className="guest-mode-bar" role="note">
          <div className="guest-mode-copy"><span className="guest-mode-icon"><DatabaseZap size={18} /></span><div><strong>Practice plan — not saved</strong><p>This plan only exists on this page. Refreshing or leaving clears your numbers and bank selections.</p></div></div>
          <div className="guest-mode-actions"><button className="button ghost compact" type="button" onClick={() => setShowGuestPlan(false)}><RotateCcw size={16} /> Edit numbers</button><Link className="button primary compact" href="/auth">Create account</Link></div>
        </div>
        <GuestWorkspace profile={guestProfile} opportunities={opportunities} usedBanks={guestBanks} stateCode={guestState} />
      </div>
    );
  }

  return (
    <form className="form-card planner-form" onSubmit={submit}>
      {guestMode && <div className="guest-warning" role="note"><span className="guest-warning-icon"><LockKeyhole size={18} /></span><div><strong>You’re planning as a guest</strong><p>Nothing you enter will be saved to an account or database. If you refresh or leave, the plan disappears.</p></div></div>}
      <div className="form-stack">
        <section className="planner-section">
          <div className="form-section-heading"><span>01</span><div><h3>Your available cash</h3><p>Only include money you would feel comfortable moving between insured accounts.</p></div></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="total_cash">Total available cash</label><input id="total_cash" name="total_cash" type="number" min="0" step="100" defaultValue={Number(profile.total_cash)} required /></div>
            <div className="field"><label htmlFor="checking_cash">Keep in checking</label><input id="checking_cash" name="checking_cash" type="number" min="0" step="100" defaultValue={Number(profile.checking_cash)} /></div>
            <div className="field"><label htmlFor="emergency_reserve">Emergency reserve</label><input id="emergency_reserve" name="emergency_reserve" type="number" min="0" step="100" defaultValue={Number(profile.emergency_reserve)} required /></div>
            <div className="field"><label htmlFor="current_hysa_apy">Current savings APY (%)</label><input id="current_hysa_apy" name="current_hysa_apy" type="number" min="0" max="20" step=".01" defaultValue={Number(profile.current_hysa_apy)} /></div>
            <div className="field"><label htmlFor="state_code">Home state</label><select id="state_code" name="state_code" defaultValue={guestMode ? guestState : initialState}>{usStates.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select><small>Used to filter state-limited offers and flag location-specific terms.</small></div>
          </div>
        </section>

        <section className="planner-section">
          <div className="form-section-heading"><span>02</span><div><h3>Your paycheck and spending</h3><p>This keeps the plan inside your normal cash flow.</p></div></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="biweekly_pay">Biweekly paycheck</label><input id="biweekly_pay" name="biweekly_pay" type="number" min="0" step="25" defaultValue={Number(profile.biweekly_pay)} /></div>
            <div className="field"><label htmlFor="biweekly_essential_spend">Biweekly essentials</label><input id="biweekly_essential_spend" name="biweekly_essential_spend" type="number" min="0" step="25" defaultValue={Number(profile.biweekly_essential_spend)} /></div>
            <div className="field"><label htmlFor="monthly_card_spend">Normal monthly card spending</label><input id="monthly_card_spend" name="monthly_card_spend" type="number" min="0" step="25" defaultValue={Number(profile.monthly_card_spend)} /></div>
            <div className="field"><label htmlFor="current_spend_reward_rate">Current rewards rate (%)</label><input id="current_spend_reward_rate" name="current_spend_reward_rate" type="number" min="0" max="20" step=".1" defaultValue={Number(profile.current_spend_reward_rate)} /></div>
          </div>
        </section>

        <section className="planner-section">
          <div className="form-section-heading"><span>03</span><div><h3>Choose your pace</h3><p>Start simple or compare more offers.</p></div></div>
          <div className="strategy-options">
            {[{ id: 1, name: "Passive", copy: "Few moves, easy upkeep" }, { id: 2, name: "Balanced", copy: "Best return for reasonable effort" }, { id: 3, name: "Aggressive", copy: "More offers and more tracking" }].map((item) => (
              <div className="strategy-option" key={item.id}><input id={"strategy-" + item.id} name="strategy_mode" type="radio" value={item.id} defaultChecked={profile.strategy_mode === item.id} /><label htmlFor={"strategy-" + item.id}><b>{item.name}</b><small>{item.copy}</small></label></div>
            ))}
          </div>
          <div className="form-grid" style={{ marginTop: 17 }}>
            <div className="field"><label htmlFor="ranking_preference">What matters most?</label><select id="ranking_preference" name="ranking_preference" defaultValue={profile.ranking_preference}><option value="balanced">Balance profit and ease</option><option value="profit">Highest profit</option><option value="ease">Easiest opportunities</option><option value="liquidity">Keep money most available</option></select></div>
            <div className="field"><label htmlFor="annual_extra_goal">Annual extra earnings goal</label><input id="annual_extra_goal" name="annual_extra_goal" type="number" min="0" step="100" defaultValue={Number(profile.annual_extra_goal)} /></div>
          </div>
        </section>

        <section className="planner-section">
          <div className="form-section-heading"><span>04</span><div><h3>Estimated tax rate</h3><p>Bonuses and interest can be taxable. Leave this off if you do not know.</p></div></div>
          <div className="switch-row"><input id="tax-known" type="checkbox" checked={taxKnown} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setTaxKnown(event.target.checked)} /><label htmlFor="tax-known">I know my estimated combined tax rate</label></div>
          {taxKnown && <div className="field" style={{ marginTop: 14, maxWidth: 260 }}><label htmlFor="estimated_tax_rate">Estimated rate (%)</label><input id="estimated_tax_rate" name="estimated_tax_rate" type="number" min="0" max="60" step="1" defaultValue={Number(profile.estimated_tax_rate || 0)} /></div>}
        </section>

        <section className="planner-section">
          <div className="form-section-heading"><span>05</span><div><h3>Your banking history</h3><p>This helps us flag first-time-customer restrictions and show a better account-velocity signal. It never guarantees approval or denial.</p></div></div>
          <div className="form-grid banking-history-grid">
            <div className="field"><label htmlFor="recent_bank_openings">Deposit accounts opened in the last 12 months</label><input id="recent_bank_openings" name="recent_bank_openings" type="number" min="0" max="30" step="1" defaultValue={Number(profile.recent_bank_openings || 0)} /><small>Include checking and savings accounts, even if they were opened outside Churning.</small></div>
            <div className="banking-signal-note"><strong>Why we ask</strong><p>Banks use their own approval and screening rules. This number is only a planning signal so Churning can warn you when account-opening activity is getting heavier.</p></div>
          </div>
          <div className="bank-selector">
            {bankSelections.map((bank) => <input key={bank} type="hidden" name="bank_history" value={bank} />)}
            <div className="bank-search-field"><input type="search" value={bankSearch} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setBankSearch(event.target.value)} placeholder="Search Chase, SoFi, Golden 1..." aria-label="Search banks" /></div>
            {bankSelections.length > 0 && <div className="selected-bank-chips">{bankSelections.map((bank) => <button type="button" key={bank} onClick={() => setBankSelections((current) => current.filter((item) => item !== bank))}>{bank}<span>×</span></button>)}</div>}
            <div className="bank-search-results">
              {commonBanks.filter((bank) => !bankSelections.includes(bank) && bank.toLowerCase().includes(bankSearch.trim().toLowerCase())).slice(0, bankSearch ? 12 : 8).map((bank) => <button type="button" key={bank} onClick={() => { setBankSelections((current) => [...current, bank]); setBankSearch(""); }}><span>{bank}</span><b>+ Add</b></button>)}
              {bankSearch.trim().length >= 2 && !commonBanks.some((bank) => bank.toLowerCase() === bankSearch.trim().toLowerCase()) && !bankSelections.some((bank) => bank.toLowerCase() === bankSearch.trim().toLowerCase()) && <button className="custom-bank-add" type="button" onClick={() => { setBankSelections((current) => [...current, bankSearch.trim()]); setBankSearch(""); }}><span>Add “{bankSearch.trim()}”</span><b>+ Custom</b></button>}
            </div>
            <p className="bank-selector-help">Add any bank or credit union you currently use or have used for deposit bonuses before. This does not mean you are automatically ineligible; it tells Churning to flag that bank for a stricter eligibility re-check.</p>
          </div>
        </section>
      </div>
      {error && <div className="form-error" style={{ marginTop: 18 }}>{error}</div>}
      <div className="form-actions">{guestMode && <Link className="text-link back-link" href="/"><ArrowLeft size={16} /> Back home</Link>}<button className="button primary" type="submit" disabled={saving}>{saving ? "Building…" : <>{guestMode ? "See my practice plan" : "Build my plan"} <ArrowRight size={18} /></>}</button></div>
    </form>
  );
}
