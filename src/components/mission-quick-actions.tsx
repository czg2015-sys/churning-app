"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { money, numberValue } from "@/lib/plan-math";
import type { Mission } from "@/lib/types";

export function MissionQuickActions({ mission, onDone }: { mission: Mission; onDone?: () => void }) {
  const router = useRouter();
  const [action, setAction] = useState<"complete" | "leave" | null>(null);
  const [receivedAmount, setReceivedAmount] = useState(String(numberValue(mission.expected_bonus)));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!action || !confirmed || busy) return;
    if (action === "complete" && !mission.opened_at) {
      setError("Confirm the real account opening date before marking this reward complete.");
      return;
    }
    if (action === "complete" && numberValue(mission.expected_bonus) > 0 && (!Number.isFinite(Number(receivedAmount)) || Number(receivedAmount) <= 0)) {
      setError("Enter the amount you actually received from the bank.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: claims } = await supabase.auth.getClaims();
      const uid = claims?.claims?.sub;
      if (!uid || uid !== mission.user_id) throw new Error("Sign in to update your reward.");
      const now = new Date().toISOString();
      if (action === "leave") {
        const { data, error: updateError } = await supabase.from("missions").update({
          status: "cancelled",
          next_action: "Stopped tracking. Churning has not closed your actual bank account.",
          updated_at: now,
        }).eq("id", mission.id).eq("user_id", uid).not("status", "in", '("complete","cancelled")').select("id");
        if (updateError) throw updateError;
        if (!data?.length) throw new Error("This reward was already completed or removed. Refresh your plan.");
      } else {
        const { data: missionRow, error: rowError } = await supabase.from("missions")
          .select("id,status").eq("id", mission.id).eq("user_id", uid).single();
        if (rowError || !missionRow || ["complete","cancelled"].includes(missionRow.status)) throw new Error("This reward is no longer active.");
        const actual = Math.max(0, Number(receivedAmount));
        const { error: stepError } = await supabase.from("mission_steps").update({
          is_complete: true,
          completed_at: now,
          updated_at: now,
        }).eq("mission_id", mission.id).eq("user_id", uid);
        if (stepError) throw stepError;
        const payout = mission.mission_steps?.find(s => s.step_type === "bonus_received");
        if (payout) {
          const { error: payoutError } = await supabase.from("mission_steps").update({ current_amount: actual, is_complete: true, completed_at: now, updated_at: now })
            .eq("id", payout.id).eq("user_id", uid);
          if (payoutError) throw payoutError;
        }
        const { error: updateError } = await supabase.from("missions").update({
          status: "complete",
          next_action: "Fully completed and reward recorded. Check bank closing terms separately before closing any account.",
          updated_at: now,
        }).eq("id", mission.id).eq("user_id", uid);
        if (updateError) throw updateError;
        const notes = "Completed through Churning reward tracker · mission:" + mission.id;
        const { data: old } = await supabase.from("account_history").select("id").eq("user_id", uid).eq("notes", notes).maybeSingle();
        const historyRecord = {
          institution: mission.institution,
          product_name: mission.title,
          opened_at: mission.opened_at || null,
          bonus_received: actual > 0,
          bonus_received_at: actual > 0 ? now : null,
          bonus_amount: actual,
          notes,
          outcome: "open",
          updated_at: now,
        };
        const result = old?.id
          ? await supabase.from("account_history").update(historyRecord).eq("id", old.id).eq("user_id", uid)
          : await supabase.from("account_history").insert({ user_id: uid, ...historyRecord });
        if (result.error) throw new Error("Marked complete, but could not save bank-history details: " + result.error.message);
      }
      setAction(null);
      setConfirmed(false);
      onDone?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this reward.");
    } finally {
      setBusy(false);
    }
  }

  if (["complete", "cancelled"].includes(mission.status)) return null;
  return (
    <div className="cash-mission-actions">
      <div className="cash-mission-action-buttons">
        <button type="button" className="cash-mission-finished" onClick={() => { setAction(action === "complete" ? null : "complete"); setConfirmed(false); setError(""); }}><CheckCircle2 size={15}/> Fully completed</button>
        <button type="button" className="cash-mission-leave" onClick={() => { setAction(action === "leave" ? null : "leave"); setConfirmed(false); setError(""); }}><XCircle size={15}/> Leave reward</button>
      </div>
      {action ? <div className="cash-mission-confirm">
        <strong>{action === "complete" ? "Confirm the reward is fully completed" : "Stop tracking this reward?"}</strong>
        <p>{action === "complete" ? "Only do this after the bank has paid the reward and your requirements are satisfied. We'll move it to History." : "This removes it from your active plan and frees up its saved cash/paycheck commitment. It does NOT close a real bank account. The stopped reward remains in History."}</p>
        {action === "complete" && numberValue(mission.expected_bonus) > 0 ? <label>Actual reward received ($)<input type="number" min="0" step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} /></label> : null}
        <label className="cash-mission-checkbox"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> {action === "complete" ? "I received the reward and finished the bank's requirements." : "I understand this only stops tracking in Churning."}</label>
        <div className="cash-mission-confirm-buttons"><button type="button" disabled={!confirmed || busy || (action === "complete" && !mission.opened_at)} onClick={() => void save()}>{busy ? "Saving…" : action === "complete" ? "Confirm completed" : "Leave reward"}</button><button type="button" onClick={() => setAction(null)}>Keep tracking</button></div>
        {action === "complete" && !mission.opened_at ? <small>First confirm the account opening date in the tracker below.</small> : null}
      </div> : null}
      {error ? <p className="cash-mission-action-error">{error}</p> : null}
    </div>
  );
}
