"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, CheckCircle2, ChevronRight, Plus, Save, ShieldAlert, Wallet, X } from "lucide-react";
import { RewardTracker } from "@/components/reward-tracker";
import { money, numberValue } from "@/lib/plan-math";
import { createClient } from "@/lib/supabase/client";
import type { FinancialProfile, Mission, Opportunity, TrackedCashAccount } from "@/lib/types";

function localDate() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function formatDate(date?: string | null) {
  if (!date) return "N/A";
  const parsed = new Date(date.slice(0, 10) + "T12:00:00");
  if (!Number.isFinite(parsed.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function missionProgress(mission: Mission) {
  const steps = mission.mission_steps || [];
  if (!steps.length) return 0;
  return Math.round(100 * steps.filter((step) => step.is_complete).length / steps.length);
}

function nextMissionDate(mission: Mission) {
  return [mission.qualification_deadline, mission.payout_due_date, mission.safe_close_review_date]
    .filter((value): value is string => Boolean(value && value >= localDate())).sort()[0]
    || mission.safe_close_review_date || mission.payout_due_date || mission.qualification_deadline || null;
}

function isEnded(account: TrackedCashAccount) {
  return Boolean(account.promotional_end_date && account.promotional_end_date.slice(0, 10) <= localDate());
}

function accountRate(account: TrackedCashAccount) {
  if (isEnded(account)) {
    const confirmed = account.confirmed_post_promo_apy;
    return confirmed != null ? Number(confirmed).toFixed(2) + "% confirmed" : "New APY needs confirmation";
  }
  const known = account.promotional_apy ?? account.current_apy;
  return known != null ? Number(known).toFixed(2) + "% APY" : "APY not entered";
}

function sortKey(date?: string | null, ended = false) {
  return ended ? "0000-00-00" : (date || "9999-12-31").slice(0, 10);
}

function accountBadge(opportunity?: Opportunity | null, urgent = false) {
  if (urgent) return { text: "Rotate", tone: "red", reason: "The promotional benefit ended. Review the current rate and alternatives." };
  const fee = numberValue(opportunity?.monthly_fee);
  if (fee <= 0) return { text: "$0 fee", tone: "green", reason: "No stored monthly maintenance fee." };
  if (opportunity?.fee_waiver_summary) return { text: "Fee check", tone: "amber", reason: `${money.format(fee)}/mo stored fee. A waiver may apply; review the current conditions.` };
  return { text: "Review close", tone: "red", reason: `${money.format(fee)}/mo stored fee. Review the safe-close date after the reward posts.` };
}

export function AccountTrackerHub({
  missions,
  accounts,
  opportunities,
  profile,
}: {
  missions: Mission[];
  accounts: TrackedCashAccount[];
  opportunities: Opportunity[];
  profile: FinancialProfile;
}) {
  const router = useRouter();
  const [localAccounts, setLocalAccounts] = useState(accounts);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [offerId, setOfferId] = useState("");
  const [institution, setInstitution] = useState("");
  const [productName, setProductName] = useState("");
  const [kind, setKind] = useState<TrackedCashAccount["account_kind"]>("hysa");
  const [balance, setBalance] = useState("");
  const [rate, setRate] = useState("");
  const [promoStart, setPromoStart] = useState("");
  const [promoEnd, setPromoEnd] = useState("");
  const [publishedRate, setPublishedRate] = useState("");
  const [publishedRateAsOf, setPublishedRateAsOf] = useState("");
  const [emails, setEmails] = useState(false);
  const [editBalance, setEditBalance] = useState("");
  const [editApy, setEditApy] = useState("");
  const [editDD, setEditDD] = useState("");
  const [useAsSavingsBaseline, setUseAsSavingsBaseline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedAccount = localAccounts.find((account) => account.id === selectedAccountId) || null;
  const selectedMission = missions.find((mission) => mission.id === selectedMissionId) || null;
  const liveMissions = missions.filter((mission) => !["complete", "cancelled"].includes(mission.status));
  const activeAccounts = localAccounts.filter((account) => account.status === "active");
  const catalog = opportunities.filter((item) => ["hysa", "checking_bonus", "savings_bonus"].includes(item.category));
  const opportunityById = useMemo(() => new Map(opportunities.map((item) => [item.id, item])), [opportunities]);
  const hasTrackedHysa = activeAccounts.some((account) => account.account_kind === "hysa");

  const cards = useMemo(() => {
    const tracked = activeAccounts.map((account) => {
      const urgent = isEnded(account) && account.confirmed_post_promo_apy == null;
      const badge = accountBadge(account.opportunity_id ? opportunityById.get(account.opportunity_id) : null, urgent);
      return {
        key: "acct:" + account.id,
        kind: "account" as const,
        id: account.id,
        institution: account.institution,
        name: account.product_name,
        date: account.promotional_end_date || null,
        urgent,
        value: account.balance ? money.format(numberValue(account.balance)) : "Balance N/A",
        subtitle: isEnded(account) ? "Benefit ended " + formatDate(account.promotional_end_date) + " · " + accountRate(account) : accountRate(account) + (account.promotional_end_date ? " · ends " + formatDate(account.promotional_end_date) : " · no end date"),
        progress: null as number | null,
        badgeText: badge.text,
        badgeTone: badge.tone,
        badgeReason: badge.reason,
        priority: account.account_kind === "hysa" ? (urgent ? 0 : 1) : 2,
      };
    });
    const baseline = !hasTrackedHysa && numberValue(profile.savings_cash) > 0 ? [{
      key: "baseline:savings",
      kind: "baseline" as const,
      id: "baseline:savings",
      institution: "Current savings",
      name: "Savings / HYSA",
      date: null,
      urgent: false,
      value: money.format(numberValue(profile.savings_cash)),
      subtitle: numberValue(profile.current_hysa_apy).toFixed(2) + "% APY · expiration N/A",
      progress: null as number | null,
      badgeText: "Add dates",
      badgeTone: "amber",
      badgeReason: "Track the bank and promotion dates so Churning can warn you when the rate changes.",
      priority: 1,
    }] : [];
    const active = liveMissions.map((mission) => {
      const badge = accountBadge(mission.opportunity || null, false);
      return {
        key: "mission:" + mission.id,
        kind: "mission" as const,
        id: mission.id,
        institution: mission.institution,
        name: mission.title,
        date: nextMissionDate(mission),
        urgent: false,
        value: money.format(numberValue(mission.expected_bonus) + numberValue(mission.expected_interest)),
        subtitle: formatDate(nextMissionDate(mission)) + " next check",
        progress: missionProgress(mission),
        badgeText: badge.text,
        badgeTone: badge.tone,
        badgeReason: badge.reason,
        priority: 2,
      };
    });
    return [...tracked, ...baseline, ...active].sort((a, b) => a.priority - b.priority || sortKey(a.date, a.urgent).localeCompare(sortKey(b.date, b.urgent)));
  }, [localAccounts, missions, hasTrackedHysa, opportunityById, profile.savings_cash, profile.current_hysa_apy]);

  function onPromotionStart(value: string) {
    setPromoStart(value);
    const chosen = catalog.find((item) => item.id === offerId);
    if (value && chosen?.benefit_duration_days) {
      const d = new Date(value + "T12:00:00");
      d.setDate(d.getDate() + Number(chosen.benefit_duration_days));
      setPromoEnd([d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"));
    }
  }

  function pickOffer(id: string) {
    setOfferId(id);
    const selected = catalog.find((item) => item.id === id);
    if (!selected) return;
    setInstitution(selected.institution);
    setProductName(selected.product_name);
    setKind(selected.category === "hysa" ? "hysa" : selected.category === "savings_bonus" ? "savings_bonus" : "checking");
    setRate(selected.apy && numberValue(selected.apy) > 0 ? String(selected.apy) : "");
    setPublishedRate(selected.standard_apy_after_benefit != null ? String(selected.standard_apy_after_benefit) : "");
    setPublishedRateAsOf(selected.institution === "CIT Bank" ? "2026-07-01" : "");
    if (promoStart && selected.benefit_duration_days) {
      const d = new Date(promoStart + "T12:00:00");
      d.setDate(d.getDate() + Number(selected.benefit_duration_days));
      setPromoEnd([d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"));
    }
  }

  async function userId() {
    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    return data?.claims?.sub || null;
  }

  async function addAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const uid = await userId();
    if (!uid || !institution.trim() || !productName.trim()) {
      setError("Enter a bank and product name, and sign in first.");
      setSaving(false);
      return;
    }
    const selected = catalog.find((item) => item.id === offerId);
    const entry = {
      user_id: uid,
      opportunity_id: selected?.id || null,
      institution: institution.trim(),
      product_name: productName.trim(),
      account_kind: kind,
      balance: Number(balance) || 0,
      current_apy: !promoEnd && rate !== "" ? Number(rate) : null,
      promotional_apy: promoEnd && rate !== "" ? Number(rate) : null,
      promotional_start_date: promoStart || null,
      promotional_end_date: promoEnd || null,
      published_standard_apy: publishedRate === "" ? null : Number(publishedRate),
      published_rate_asof: publishedRateAsOf || null,
      email_reminders_enabled: emails,
      status: "active",
    };
    const { data, error: dbError } = await createClient().from("tracked_cash_accounts").insert(entry).select("*").single();
    if (dbError || !data) {
      setError(dbError?.message || "Account could not be saved.");
    } else {
      setLocalAccounts((current) => [...current, data as TrackedCashAccount]);
      setAdding(false);
      setOfferId("");
      setInstitution("");
      setProductName("");
      setBalance("");
      setPromoStart("");
      setPromoEnd("");
      setRate("");
      setPublishedRate("");
      setPublishedRateAsOf("");
      setEmails(false);
      router.refresh();
    }
    setSaving(false);
  }

  function openBaselineSavings() {
    setError("");
    setOfferId("");
    setInstitution("");
    setProductName("Savings account");
    setKind("hysa");
    setBalance(String(numberValue(profile.savings_cash) || ""));
    setRate(numberValue(profile.current_hysa_apy) > 0 ? String(profile.current_hysa_apy) : "");
    setPromoStart("");
    setPromoEnd("");
    setPublishedRate("");
    setPublishedRateAsOf("");
    setAdding(true);
  }

  function openAccount(id: string) {
    const a = localAccounts.find((item) => item.id === id);
    if (!a) return;
    setError("");
    setEditBalance(String(a.balance || ""));
    setEditApy(a.confirmed_post_promo_apy != null ? String(a.confirmed_post_promo_apy) : a.current_apy != null ? String(a.current_apy) : "");
    setEditDD("");
    setUseAsSavingsBaseline(false);
    setSelectedAccountId(id);
  }

  async function updateAccount(patch: Record<string, unknown>, applyToPlanTotal = false) {
    if (!selectedAccount) return;
    setSaving(true);
    setError("");
    const uid = await userId();
    if (!uid) { setSaving(false); setError("Please sign in again."); return; }
    const { data, error: dbError } = await createClient().from("tracked_cash_accounts").update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", selectedAccount.id).eq("user_id", uid).select("*").single();
    if (dbError || !data) setError(dbError?.message || "Could not save.");
    else {
      setLocalAccounts((current) => current.map((item) => item.id === selectedAccount.id ? data as TrackedCashAccount : item));
      if (applyToPlanTotal && typeof patch.balance === "number") {
        const supabase = createClient();
        const { data: financial } = await supabase.from("financial_profiles").select("checking_cash,savings_cash").eq("user_id", uid).maybeSingle();
        if (financial) {
          const savings = ["hysa", "savings_bonus"].includes(selectedAccount.account_kind)
            ? patch.balance : numberValue(financial.savings_cash);
          const checking = ["checking", "direct_deposit"].includes(selectedAccount.account_kind)
            ? patch.balance : numberValue(financial.checking_cash);
          const { error: profileError } = await supabase.from("financial_profiles")
            .update({ savings_cash: savings, checking_cash: checking, total_cash: savings + checking, updated_at: new Date().toISOString() })
            .eq("user_id", uid);
          if (profileError) setError("Account balance saved, but My Plan totals could not update: " + profileError.message);
        }
      }
      router.refresh();
    }
    setSaving(false);
  }

  async function updateMissionDD(mission: Mission, amount: number) {
    if (!(amount > 0)) return;
    setSaving(true);
    setError("");
    const uid = await userId();
    if (!uid) { setSaving(false); return; }

    const required = numberValue(mission.opportunity?.direct_deposit_required);
    const existing = (mission.mission_steps || []).find((item) => item.step_type === "direct_deposit");
    let dbError: { message?: string } | null = null;

    if (existing) {
      const updatedAmount = numberValue(existing.current_amount) + amount;
      const target = numberValue(existing.target_amount) || required;
      const completed = target > 0 && updatedAmount >= target;
      const result = await createClient().from("mission_steps").update({
        current_amount: updatedAmount,
        target_amount: target || null,
        is_complete: completed,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id).eq("user_id", uid);
      dbError = result.error;
    } else {
      const order = Math.max(0, ...(mission.mission_steps || []).map((item) => Number(item.step_order) || 0)) + 1;
      const completed = required > 0 && amount >= required;
      const result = await createClient().from("mission_steps").insert({
        mission_id: mission.id,
        user_id: uid,
        label: required > 0 ? `Qualifying direct deposit · ${money.format(required)} target` : "Qualifying direct deposit",
        step_type: "direct_deposit",
        step_order: order,
        target_amount: required || null,
        current_amount: amount,
        is_complete: completed,
        completed_at: completed ? new Date().toISOString() : null,
      });
      dbError = result.error;
    }

    setError(dbError?.message || "");
    setEditDD("");
    setSaving(false);
    if (!dbError) router.refresh();
  }

  const drawerOpen = selectedAccount || selectedMission || adding;
  return (
    <>
      <section className="cash-accounts-hub">
        <div className="cash-accounts-header">
          <div><small>YOUR ACCOUNTS</small><strong>{cards.length ? cards.length + " tracked" : "No accounts yet"}</strong></div>
          <button type="button" onClick={() => { setAdding(true); setError(""); }}><Plus size={14} /> Add account</button>
        </div>
        {cards.length ? <div className="cash-accounts-cards">{cards.slice(0, 8).map((card) => (
          <button type="button" className={"cash-owned-card" + (card.urgent ? " urgent" : "")} key={card.key}
            onClick={() => card.kind === "account" ? openAccount(card.id) : card.kind === "baseline" ? openBaselineSavings() : setSelectedMissionId(card.id)}>
            <div className="cash-owned-top"><span><small>{card.institution}</small><strong>{card.name}</strong></span><b>{card.value}</b></div>
            <div className="cash-owned-badge-row"><span className={`cash-lifecycle-badge ${card.badgeTone}`} title={card.badgeReason}>{card.badgeText}</span></div>
            {card.progress != null ? <div className="cash-owned-progress"><span style={{ width: card.progress + "%" }} /></div> : null}
            <div className="cash-owned-bottom"><span>{card.urgent ? <ShieldAlert size={13} /> : <CheckCircle2 size={13} />}{card.subtitle}</span><em>{card.kind === "baseline" ? "Track details" : "Update"} <ChevronRight size={14} /></em></div>
          </button>
        ))}</div> : <div className="cash-owned-empty">N/A · Add a savings or checking account, or choose a roadmap recommendation below.</div>}
      </section>

      {drawerOpen ? (
        <div className="mission-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) { setAdding(false); setSelectedAccountId(null); setSelectedMissionId(null); } }}>
          <aside className="mission-drawer" role="dialog" aria-modal="true" aria-label="Account details">
            <div className="mission-drawer-head">
              <div><small>YOUR ACCOUNT</small><strong>{adding ? "Track an account" : selectedAccount ? selectedAccount.institution + " · " + selectedAccount.product_name : selectedMission?.institution + " · Tracker"}</strong></div>
              <button type="button" onClick={() => { setAdding(false); setSelectedAccountId(null); setSelectedMissionId(null); }} aria-label="Close panel"><X size={17}/></button>
            </div>
            <div className="mission-drawer-body">
              {adding ? <form className="cash-account-form" onSubmit={addAccount}>
                <p>Enter what you actually have. Churning cannot see your bank, so your dates and balance are user-reported.</p>
                <label>Research offer (optional)<select value={offerId} onChange={(e) => pickOffer(e.target.value)}><option value="">Enter a different account</option>{catalog.map((item) => <option key={item.id} value={item.id}>{item.institution} — {item.product_name}</option>)}</select></label>
                <label>Bank<input required maxLength={120} value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="CIT Bank"/></label>
                <label>Account name<input required maxLength={160} value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Platinum Savings"/></label>
                <label>Account type<select value={kind} onChange={(e) => setKind(e.target.value as TrackedCashAccount["account_kind"])}><option value="hysa">HYSA</option><option value="checking">Checking</option><option value="direct_deposit">Direct deposit</option><option value="savings_bonus">Savings bonus</option><option value="other">Other</option></select></label>
                <label>Current balance ($)<input type="number" min={0} step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0"/></label>
                <label>APY while promo is active (%)<input type="number" min={0} max={100} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="4.10"/></label>
                <div className="cash-account-two"><label>Promo started (optional)<input type="date" value={promoStart} onChange={(e) => onPromotionStart(e.target.value)}/></label><label>YOUR promo ends<input type="date" value={promoEnd} onChange={(e) => setPromoEnd(e.target.value)}/><small>Auto-estimated from offer length when available; confirm against your own opening terms.</small></label></div>
                <label>Published standard APY after promo (%) <input type="number" min={0} max={100} step="0.01" value={publishedRate} onChange={(e) => setPublishedRate(e.target.value)} placeholder="Only if published by the bank"/></label>
                {publishedRate !== "" ? <label>Published rate as of<input type="date" value={publishedRateAsOf} onChange={(e) => setPublishedRateAsOf(e.target.value)}/></label> : null}
                <label className="cash-account-checkbox"><input type="checkbox" checked={emails} onChange={(e) => setEmails(e.target.checked)}/> Request email reminders when available</label>
                <small>Published rates are variable. An estimate never replaces the APY you confirm in your account. Email delivery depends on the configured reminder service.</small>
                {error ? <p className="cash-account-error">{error}</p> : null}
                <button type="submit" className="button primary" disabled={saving}><Save size={14}/>{saving ? "Saving…" : "Track account"}</button>
              </form> : null}
              {selectedAccount ? <div className="cash-account-edit">
                {isEnded(selectedAccount) ? <div className="cash-account-ended"><ShieldAlert size={17}/><span><strong>Promotion ended {formatDate(selectedAccount.promotional_end_date)}</strong><small>Confirm the APY you now earn. Do not assume your old boosted rate is still active.</small></span></div> : null}
                <div className="cash-account-details">
                  <div><small>Tracked balance</small><strong>{money.format(numberValue(selectedAccount.balance))}</strong></div>
                  <div><small>Rate</small><strong>{accountRate(selectedAccount)}</strong></div>
                  {selectedAccount.promotional_end_date ? <div><small>Promo end</small><strong>{formatDate(selectedAccount.promotional_end_date)}</strong></div> : null}
                  {selectedAccount.published_standard_apy != null ? <div><small>Bank's published standard rate</small><strong>{Number(selectedAccount.published_standard_apy).toFixed(2)}% (as of {formatDate(selectedAccount.published_rate_asof)})</strong></div> : null}
                </div>
                <label>Update current balance ($)<input type="number" min={0} step="0.01" value={editBalance} onChange={(e) => setEditBalance(e.target.value)}/></label>
                <label className="cash-account-checkbox"><input type="checkbox" checked={useAsSavingsBaseline} onChange={(e) => setUseAsSavingsBaseline(e.target.checked)} /><span>Also replace my overall {["hysa", "savings_bonus"].includes(selectedAccount.account_kind) ? "savings" : "checking"} total in My Plan with this balance (only if this is my full balance for that category)</span></label>
                <button disabled={saving || editBalance === ""} onClick={() => void updateAccount({ balance: Number(editBalance) }, useAsSavingsBaseline)}><Save size={14}/> Update balance</button>
                <label>{isEnded(selectedAccount) ? "Confirm actual rate after promotion (%)" : "Update your account APY (%)"}<input type="number" min={0} max={100} step="0.01" value={editApy} onChange={(e) => setEditApy(e.target.value)} placeholder="Rate shown by your bank"/></label>
                <button disabled={saving || editApy === ""} onClick={() => void updateAccount(isEnded(selectedAccount)
                  ? { confirmed_post_promo_apy: Number(editApy), current_apy: Number(editApy), apy_last_confirmed_at: new Date().toISOString() }
                  : { current_apy: Number(editApy), apy_last_confirmed_at: new Date().toISOString() })}><Save size={14}/> Confirm APY</button>
                <label className="cash-account-checkbox"><input type="checkbox" checked={Boolean(selectedAccount.email_reminders_enabled)} onChange={(e) => void updateAccount({ email_reminders_enabled: e.target.checked })}/> Opt in to email reminders (if service is configured)</label>
                {selectedAccount.account_kind === "direct_deposit" ? <><label>New qualifying deposit received ($)<input type="number" min={0} step="0.01" value={editDD} onChange={(e) => setEditDD(e.target.value)}/></label><button disabled={saving || !(Number(editDD) > 0)} onClick={() => void updateAccount({ dd_received_total: numberValue(selectedAccount.dd_received_total) + Number(editDD), dd_last_received_date: localDate() }).then(() => setEditDD(""))}>+ Record deposit</button><small>Total entered: {money.format(numberValue(selectedAccount.dd_received_total))} · Confirm qualification in your bank's transaction history.</small></> : null}
                <button className="cash-account-archive" disabled={saving} onClick={() => void updateAccount({ status: "archived" }).then(() => setSelectedAccountId(null))}>Archive this account</button>
                {error ? <p className="cash-account-error">{error}</p> : null}
              </div> : null}
              {selectedMission ? <div className="cash-mission-wrapper">
                <div className="cash-mission-quick"><strong>Manual updates</strong><p>We cannot see actual bank transactions. Enter new amounts after checking your account.</p>
                  <label>Qualifying DD received ($)<input type="number" min={0} step="0.01" value={editDD} onChange={(e) => setEditDD(e.target.value)} placeholder="Amount that just posted"/></label>
                  <button type="button" disabled={saving || !(Number(editDD) > 0)} onClick={() => void updateMissionDD(selectedMission, Number(editDD))}>+ Record DD</button>
                  {error ? <p className="cash-account-error">{error}</p> : null}
                </div>
                <RewardTracker missions={[selectedMission]}/>
              </div> : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
