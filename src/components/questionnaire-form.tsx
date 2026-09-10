"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FinancialProfile } from "@/lib/types";

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
};

function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function QuestionnaireForm({ initial }: { initial: FinancialProfile | null }) {
  const router = useRouter();
  const profile = initial || defaults;
  const [taxKnown, setTaxKnown] = useState(profile.tax_rate_known);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const { data: claimsData, error: authError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (authError || !userId) {
      router.push("/auth");
      return;
    }

    const totalCash = numberValue(form.get("total_cash"));
    const checkingCash = numberValue(form.get("checking_cash"));
    const payload = {
      user_id: userId,
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
      estimated_tax_rate: taxKnown ? numberValue(form.get("estimated_tax_rate")) : null,
      tax_rate_known: taxKnown,
      strategy_mode: numberValue(form.get("strategy_mode")),
      ranking_preference: String(form.get("ranking_preference") || "balanced"),
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await supabase.from("profiles").upsert(
      { user_id: userId, state_code: "CA", updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    const { error: financeError } = await supabase.from("financial_profiles").upsert(payload, { onConflict: "user_id" });

    if (profileError || financeError) {
      setError(profileError?.message || financeError?.message || "We couldn’t save your plan.");
      setSaving(false);
      return;
    }
    router.push("/my-plan");
    router.refresh();
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <div className="form-stack">
        <section>
          <div className="form-section">
            <h3>Your available cash</h3>
            <p>Only include money you would feel comfortable moving between insured accounts.</p>
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="total_cash">Total available cash</label><input id="total_cash" name="total_cash" type="number" min="0" step="100" defaultValue={Number(profile.total_cash)} required /></div>
            <div className="field"><label htmlFor="checking_cash">Keep in checking</label><input id="checking_cash" name="checking_cash" type="number" min="0" step="100" defaultValue={Number(profile.checking_cash)} /></div>
            <div className="field"><label htmlFor="emergency_reserve">Emergency reserve</label><input id="emergency_reserve" name="emergency_reserve" type="number" min="0" step="100" defaultValue={Number(profile.emergency_reserve)} required /></div>
            <div className="field"><label htmlFor="current_hysa_apy">Current savings APY (%)</label><input id="current_hysa_apy" name="current_hysa_apy" type="number" min="0" max="20" step=".01" defaultValue={Number(profile.current_hysa_apy)} /></div>
          </div>
        </section>

        <section className="form-section">
          <h3>Your paycheck and spending</h3>
          <p>This helps us avoid recommending offers that your normal cash flow cannot support.</p>
          <div className="form-grid">
            <div className="field"><label htmlFor="biweekly_pay">Biweekly paycheck</label><input id="biweekly_pay" name="biweekly_pay" type="number" min="0" step="25" defaultValue={Number(profile.biweekly_pay)} /></div>
            <div className="field"><label htmlFor="biweekly_essential_spend">Biweekly essentials</label><input id="biweekly_essential_spend" name="biweekly_essential_spend" type="number" min="0" step="25" defaultValue={Number(profile.biweekly_essential_spend)} /></div>
            <div className="field"><label htmlFor="monthly_card_spend">Normal monthly card spending</label><input id="monthly_card_spend" name="monthly_card_spend" type="number" min="0" step="25" defaultValue={Number(profile.monthly_card_spend)} /></div>
            <div className="field"><label htmlFor="current_spend_reward_rate">Current rewards rate (%)</label><input id="current_spend_reward_rate" name="current_spend_reward_rate" type="number" min="0" max="20" step=".1" defaultValue={Number(profile.current_spend_reward_rate)} /></div>
          </div>
        </section>

        <section className="form-section">
          <h3>How active should your plan be?</h3>
          <p>You can change this later.</p>
          <div className="strategy-options">
            {[{ id: 1, name: "Passive", copy: "Few moves, easy upkeep" }, { id: 2, name: "Balanced", copy: "Best return for reasonable effort" }, { id: 3, name: "Aggressive", copy: "More offers and more tracking" }].map((item) => (
              <div className="strategy-option" key={item.id}>
                <input id={"strategy-" + item.id} name="strategy_mode" type="radio" value={item.id} defaultChecked={profile.strategy_mode === item.id} />
                <label htmlFor={"strategy-" + item.id}><b>{item.name}</b><small>{item.copy}</small></label>
              </div>
            ))}
          </div>
          <div className="form-grid" style={{ marginTop: 17 }}>
            <div className="field">
              <label htmlFor="ranking_preference">What matters most?</label>
              <select id="ranking_preference" name="ranking_preference" defaultValue={profile.ranking_preference}>
                <option value="balanced">Balance profit and ease</option>
                <option value="profit">Highest profit</option>
                <option value="ease">Easiest opportunities</option>
                <option value="liquidity">Keep money most available</option>
              </select>
            </div>
            <div className="field"><label htmlFor="annual_extra_goal">Annual extra earnings goal</label><input id="annual_extra_goal" name="annual_extra_goal" type="number" min="0" step="100" defaultValue={Number(profile.annual_extra_goal)} /></div>
          </div>
        </section>

        <section className="form-section">
          <h3>Estimated tax rate</h3>
          <p>Bonuses and interest can be taxable. This helps show a more realistic estimate.</p>
          <div className="switch-row"><input id="tax-known" type="checkbox" checked={taxKnown} onChange={(event) => setTaxKnown(event.target.checked)} /><label htmlFor="tax-known">I know my estimated combined tax rate</label></div>
          {taxKnown && <div className="field" style={{ marginTop: 14, maxWidth: 260 }}><label htmlFor="estimated_tax_rate">Estimated rate (%)</label><input id="estimated_tax_rate" name="estimated_tax_rate" type="number" min="0" max="60" step="1" defaultValue={Number(profile.estimated_tax_rate || 0)} /></div>}
        </section>
      </div>
      {error && <div className="form-error" style={{ marginTop: 18 }}>{error}</div>}
      <div className="form-actions"><button className="button primary" type="submit" disabled={saving}>{saving ? "Saving…" : <>Build my plan <ArrowRight size={18} /></>}</button></div>
    </form>
  );
}
