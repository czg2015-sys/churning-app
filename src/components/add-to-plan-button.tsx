"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Opportunity } from "@/lib/types";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export function AddToPlanButton({ opportunity, compact = false }: { opportunity: Opportunity; compact?: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  async function addToPlan() {
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (!userId) {
      router.push("/auth?next=/opportunities");
      return;
    }

    const today = new Date();
    const qualificationDays = Number(opportunity.qualification_days || opportunity.direct_deposit_window_days || 0);
    const payoutDays = Number(opportunity.payout_days || 0);
    const minAgeDays = Number(opportunity.min_account_age_days || 0);
    const qualificationDate = qualificationDays ? addDays(today, qualificationDays) : null;
    const payoutDate = qualificationDays || payoutDays ? addDays(today, qualificationDays + payoutDays) : null;
    const minAgeDate = minAgeDays ? addDays(today, minAgeDays) : null;
    const safeCloseDays = Math.max(minAgeDays, qualificationDays + payoutDays);
    const safeCloseDate = safeCloseDays ? addDays(today, safeCloseDays) : null;

    const { data: existing } = await supabase
      .from("missions")
      .select("id")
      .eq("user_id", userId)
      .eq("opportunity_id", opportunity.id)
      .in("status", ["planned", "active", "qualified", "payout_pending"])
      .maybeSingle();

    if (existing) {
      setAdded(true);
      setSaving(false);
      return;
    }

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .insert({
        user_id: userId,
        opportunity_id: opportunity.id,
        institution: opportunity.institution,
        title: opportunity.product_name,
        amount_committed: Number(opportunity.required_balance || opportunity.min_opening_deposit || 0),
        expected_bonus: Number(opportunity.bonus_amount || 0),
        expected_interest: 0,
        opened_at: today.toISOString().slice(0, 10),
        qualification_deadline: qualificationDate,
        payout_due_date: payoutDate,
        minimum_account_age_date: minAgeDate,
        safe_close_review_date: safeCloseDate,
        status: "active",
        quick_access_url: opportunity.official_url,
        next_action: Number(opportunity.direct_deposit_required || 0)
          ? `Complete ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(opportunity.direct_deposit_required))} in qualifying direct deposits.`
          : Number(opportunity.required_balance || 0)
            ? `Maintain the required balance through the qualification window.`
            : "Review the offer terms and complete the qualification requirements.",
      })
      .select("id")
      .single();

    if (missionError || !mission) {
      setError(missionError?.message || "Could not add this offer yet.");
      setSaving(false);
      return;
    }

    const steps = [
      { label: "Account opened", step_type: "opened", step_order: 1, is_complete: true, completed_at: new Date().toISOString() },
    ];
    if (Number(opportunity.direct_deposit_required || 0) > 0) {
      steps.push({ label: "Direct deposit requirement", step_type: "direct_deposit", step_order: 2, is_complete: false, completed_at: null as never });
    }
    if (Number(opportunity.required_balance || 0) > 0) {
      steps.push({ label: "Balance hold requirement", step_type: "balance_hold", step_order: 3, is_complete: false, completed_at: null as never });
    }
    steps.push({ label: "Reward received", step_type: "reward_received", step_order: 4, is_complete: false, completed_at: null as never });

    await supabase.from("mission_steps").insert(steps.map((step) => ({ ...step, mission_id: mission.id, user_id: userId })));
    setAdded(true);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className={compact ? "add-plan-wrap compact" : "add-plan-wrap"}>
      <button className={added ? "button ghost compact" : "button primary compact"} type="button" onClick={addToPlan} disabled={saving || added}>
        {added ? <><Check size={16} /> Added to My Plan</> : <><Plus size={16} /> {saving ? "Adding…" : "Add to My Plan"}</>}
      </button>
      {error && <small className="add-plan-error">{error}</small>}
    </div>
  );
}
