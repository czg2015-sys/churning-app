"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CreditCard, Search, ShieldCheck, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { FormattedNumberInput } from "@/components/formatted-number-input";
import { FormattedPercentInput } from "@/components/formatted-percent-input";
import type { FinancialProfile, Opportunity } from "@/lib/types";
import { latestReview, money, numberValue, reviewStatusLabel, verificationAgeDays } from "@/lib/plan-math";
import styles from "@/app/cards/cards.module.css";

const commonCards = [
  "Chase Freedom Unlimited", "Chase Freedom Flex", "Chase Sapphire Preferred", "Chase Sapphire Reserve",
  "Capital One Savor", "Capital One Venture", "Capital One Venture X", "Citi Double Cash", "Citi Strata Premier",
  "Discover it Cash Back", "Discover it Student Cash Back", "American Express Blue Cash Everyday",
  "American Express Blue Cash Preferred", "American Express Gold Card", "Bank of America Customized Cash Rewards",
  "Wells Fargo Active Cash", "Wells Fargo Autograph", "Other card",
];

function researchStatus(item: Opportunity) {
  const age = verificationAgeDays(item.last_verified_at);
  const review = latestReview(item);
  const fresh = age !== null && age <= 7;
  const gate = (item.safety_gate || "").toLowerCase();
  const cleared = ["pass", "green"].includes(gate) && Number(item.evidence_confidence || 0) >= 80 && fresh;
  if (cleared) return { label: "Research Verified", cleared: true };
  if (review) return { label: "Needs review", cleared: false };
  return { label: "Research pending", cleared: false };
}

function scoreLikelyFits(item: Opportunity, scoreBand: string) {
  if (scoreBand === "unknown" || !item.credit_score_band_hint) return true;
  const hint = item.credit_score_band_hint.toLowerCase();
  const rank: Record<string, number> = { under_650: 1, "650_699": 2, "700_749": 3, "750_plus": 4 };
  const current = rank[scoreBand] || 0;
  if (/excellent|750\+|750 or higher/.test(hint)) return current >= 4;
  if (/good|700\+|700 or higher/.test(hint)) return current >= 3;
  if (/fair|650\+|650 or higher/.test(hint)) return current >= 2;
  return true;
}

function issuerFromCard(name: string) {
  const issuers = ["American Express", "Bank of America", "Capital One", "Wells Fargo", "Chase", "Citi", "Discover"];
  return issuers.find((issuer) => name.toLowerCase().startsWith(issuer.toLowerCase())) || name.split(" ")[0];
}

function conservativeValue(item: Opportunity) {
  const cash = numberValue(item.bonus_amount);
  return cash > 0 ? cash : numberValue(item.reward_points) * numberValue(item.cash_value_per_point);
}

function requiredSpend(item: Opportunity) {
  const explicit = numberValue(item.purchase_required_spend);
  if (explicit > 0) return explicit;
  const count = Math.max(0, Number(item.purchase_count || 0));
  const min = numberValue(item.purchase_min_amount);
  return count > 0 && min > 0 ? count * min : 0;
}

function normalSpendFits(item: Opportunity, monthlySpend: number) {
  const needed = requiredSpend(item);
  if (needed <= 0) return true;
  const days = Number(item.spend_window_days || item.qualification_days || 90);
  return monthlySpend * Math.max(1, days / 30) >= needed;
}

export function CardOpportunityHelper({
  userId,
  initialProfile,
  initialCards,
  opportunities,
}: {
  userId: string;
  initialProfile: FinancialProfile;
  initialCards: string[];
  opportunities: Opportunity[];
}) {
  const [scoreBand, setScoreBand] = useState(initialProfile.credit_score_band || "unknown");
  const [payInFull, setPayInFull] = useState(Boolean(initialProfile.credit_cards_pay_in_full));
  const [noCard, setNoCard] = useState(Boolean(initialProfile.no_credit_card));
  const [monthlySpend, setMonthlySpend] = useState(numberValue(initialProfile.monthly_card_spend));
  const [currentRewardRate, setCurrentRewardRate] = useState(numberValue(initialProfile.current_spend_reward_rate));
  const [cards, setCards] = useState(initialCards);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filteredCards = useMemo(() => commonCards.filter((card) => !cards.includes(card) && card.toLowerCase().includes(search.toLowerCase())).slice(0, 8), [cards, search]);

  const debitMatches = useMemo(() => opportunities
    .filter((item) => item.category === "debit_spend")
    .sort((a, b) => conservativeValue(b) - conservativeValue(a)), [opportunities]);

  const creditMatches = useMemo(() => opportunities
    .filter((item) => item.category === "credit_card_bonus")
    .filter((item) => scoreLikelyFits(item, scoreBand))
    .filter((item) => !cards.some((card) => item.product_name.toLowerCase().includes(card.toLowerCase()) || card.toLowerCase().includes(item.product_name.toLowerCase())))
    .sort((a, b) => conservativeValue(b) - conservativeValue(a)), [opportunities, scoreBand, cards]);

  async function savePreferences() {
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error: profileError } = await supabase.from("financial_profiles").update({
      card_helper_opt_in: true,
      card_helper_prompt_answered: true,
      credit_score_band: scoreBand === "unknown" ? null : scoreBand,
      credit_cards_pay_in_full: payInFull,
      no_credit_card: noCard,
      monthly_card_spend: monthlySpend,
      current_spend_reward_rate: currentRewardRate,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    if (profileError) {
      setMessage(profileError.message);
      setSaving(false);
      return;
    }

    const note = "Reported in Cards & Spending helper";
    await supabase.from("account_history").delete().eq("user_id", userId).eq("notes", note);
    if (!noCard && cards.length) {
      const rows = cards.map((productName) => ({ user_id: userId, institution: issuerFromCard(productName), product_name: productName, account_type: "credit_card", outcome: "existing_or_previous", notes: note }));
      const { error } = await supabase.from("account_history").insert(rows);
      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }
    }

    setMessage("Saved. The offer cards below now use these preferences.");
    setSaving(false);
  }

  return (
    <main className={styles.page}>
      <div className={`shell ${styles.shell}`}>
        <Link href="/my-plan" className={styles.back}><ArrowLeft size={15} /> Back to My Plan</Link>

        <section className={styles.hero}>
          <div><span className="kicker">OPTIONAL · CARDS & SPENDING</span><h1>Compare debit rewards and credit-card welcome offers.</h1><p>This section stays separate from your cash plan. It only uses spending you already expect to make, and it never guarantees approval.</p></div>
          <div className={styles.disclosure}><ShieldCheck size={18} /><span><strong>You decide whether to apply.</strong> Credit-card applications can involve a credit inquiry, APR, utilization, issuer rules, and fees.</span></div>
        </section>

        <section className={styles.setupCard}>
          <div className={styles.toggleRow}><div><h2>Quick fit questions</h2><p>These help us flag which offers fit normal spending instead of encouraging extra purchases.</p></div></div>
          <div className={styles.formGrid}>
            <label><span>Estimated credit-score range</span><select value={scoreBand} onChange={(event) => setScoreBand(event.target.value)}><option value="unknown">I don’t know</option><option value="under_650">Under 650</option><option value="650_699">650–699</option><option value="700_749">700–749</option><option value="750_plus">750+</option></select><small>Fit signal only. The issuer decides approval.</small></label>
            <label className={styles.checkbox}><input type="checkbox" checked={payInFull} onChange={(event) => setPayInFull(event.target.checked)} /><span><b>I plan to pay credit-card balances in full.</b><small>Credit welcome offers stay hidden until this is checked.</small></span></label>
            <label className={styles.checkbox}><input type="checkbox" checked={noCard} onChange={(event) => { setNoCard(event.target.checked); if (event.target.checked) setCards([]); }} /><span><b>I don’t currently have a credit card.</b><small>You can still compare debit rewards and eligible starter-card offers.</small></span></label>
            <label><span>Normal monthly card/debit spending</span><FormattedNumberInput name="card_helper_monthly_spend" value={monthlySpend} onValueChange={setMonthlySpend} /><small>Used to mark whether the bonus fits spending you already make.</small></label>
            <label><span>Current everyday cash-back rate</span><FormattedPercentInput name="card_helper_reward_rate" value={currentRewardRate} onValueChange={setCurrentRewardRate} max={20} /><small>Used as your existing rewards baseline.</small></label>
          </div>

          {!noCard ? <div className={styles.cardSearch}><label>Cards you already have or recently had</label><div className={styles.searchBox}><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Chase Freedom, Capital One Savor..." /></div>{cards.length ? <div className={styles.chips}>{cards.map((card) => <button type="button" key={card} onClick={() => setCards((current) => current.filter((item) => item !== card))}>{card}<span>×</span></button>)}</div> : null}{search ? <div className={styles.results}>{filteredCards.map((card) => <button type="button" key={card} onClick={() => { setCards((current) => [...current, card]); setSearch(""); }}>+ {card}</button>)}</div> : null}</div> : null}

          <button type="button" className="button primary" onClick={savePreferences} disabled={saving}>{saving ? "Saving…" : "Save preferences"}</button>
          {message ? <p className={styles.message}>{message}</p> : null}
        </section>

        <OfferSection title="Debit & spending rewards" subtitle="Top live debit offers. A warning appears when your entered spending is not enough for a stored requirement." icon={<WalletCards size={19} />} items={debitMatches} monthlySpend={monthlySpend} />

        {payInFull
          ? <OfferSection title="Credit-card welcome offers" subtitle="Shown separately from cash recommendations. We never suggest spending more than you normally would just to earn a bonus." icon={<CreditCard size={19} />} items={creditMatches} monthlySpend={monthlySpend} credit />
          : <div className={styles.payFullGate}><ShieldCheck size={18} /><span>Check “I plan to pay credit-card balances in full” above to show credit-card welcome offers.</span></div>}
      </div>
    </main>
  );
}

function OfferSection({ title, subtitle, icon, items, monthlySpend, credit = false }: { title: string; subtitle: string; icon: React.ReactNode; items: Opportunity[]; monthlySpend: number; credit?: boolean }) {
  const [showMore, setShowMore] = useState(false);
  const visible = showMore ? items : items.slice(0, 3);
  return <section className={styles.section}>
    <div className={styles.sectionHead}><div>{icon}<span><small>{credit ? "CREDIT" : "DEBIT"}</small><h2>{title}</h2></span></div><p>{subtitle}</p></div>
    {visible.length ? <div className={styles.grid}>{visible.map((item) => <OfferCard key={item.id} item={item} monthlySpend={monthlySpend} credit={credit} />)}</div> : <EmptyState text="No live offers currently match this section." />}
    {items.length > 3 ? <button className="button ghost compact" type="button" onClick={() => setShowMore((value) => !value)}>{showMore ? "Show top 3" : `See more (${items.length - 3})`}</button> : null}
  </section>;
}

function OfferCard({ item, monthlySpend, credit = false }: { item: Opportunity; monthlySpend: number; credit?: boolean }) {
  const review = latestReview(item);
  const status = researchStatus(item);
  const cash = conservativeValue(item);
  const needed = requiredSpend(item);
  const fits = normalSpendFits(item, monthlySpend);
  return <article className={styles.offerCard}>
    <div className={styles.offerTop}><span>{item.institution}</span><b>{status.label}</b></div>
    <h3>{item.product_name}</h3>
    <div className={styles.valueRow}><span><small>Potential value</small><strong>{money.format(cash)}</strong></span>{credit ? <span><small>Annual fee</small><strong>{money.format(numberValue(item.annual_fee))}</strong></span> : null}</div>
    <div className={styles.facts}>
      {needed > 0 ? <span><small>Stored spend requirement</small><b>{money.format(needed)} / {item.spend_window_days || item.qualification_days || 90} days</b></span> : null}
      <span><small>Normal-spend fit</small><b>{fits ? "Fits entered spend" : "Needs more spend than entered"}</b></span>
      <span><small>Hard inquiry research</small><b>{reviewStatusLabel(review?.hard_pull_status)}</b></span>
      <span><small>Checked</small><b>{verificationAgeDays(item.last_verified_at) ?? "?"}d ago</b></span>
    </div>
    <p className={styles.terms}>{item.terms_summary || item.eligibility_notes || "Review current issuer terms before acting."}</p>
    <div className="match-actions">
      <AddToPlanButton opportunity={item} allowPlanningOnHold compact />
      <a href={item.official_url} target="_blank" rel="noreferrer">Official terms <ArrowUpRight size={13} /></a>
    </div>
  </article>;
}

function EmptyState({ text }: { text: string }) {
  return <div className={styles.empty}><ShieldCheck size={20} /><span>{text}</span></div>;
}
