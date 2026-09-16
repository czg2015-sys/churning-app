"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CardsOptInPrompt({ answered, enabled }: { answered: boolean; enabled: boolean }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(answered && !enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (hidden || enabled) return null;

  async function choose(value: boolean) {
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (!userId) {
      router.push("/auth");
      return;
    }

    const { error: updateError } = await supabase
      .from("financial_profiles")
      .update({
        card_helper_opt_in: value,
        card_helper_prompt_answered: true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    if (value) {
      router.push("/cards");
      router.refresh();
      return;
    }

    setHidden(true);
    setSaving(false);
    router.refresh();
  }

  return (
    <aside className="optional-card-helper">
      <div>
        <span className="optional-card-icon"><CreditCard size={18} /></span>
        <div>
          <strong>Want help with debit or credit-card offers?</strong>
          <p>This is optional and separate from your cash plan. If you choose yes, we’ll ask a few spending and card questions before showing matches.</p>
        </div>
      </div>
      <div className="plan-topbar-actions">
        <button className="button ghost compact" type="button" onClick={() => choose(false)} disabled={saving}>No</button>
        <button className="button primary compact" type="button" onClick={() => choose(true)} disabled={saving}>{saving ? "Saving…" : "Yes"}</button>
      </div>
      {error ? <small className="add-plan-error">{error}</small> : null}
    </aside>
  );
}
