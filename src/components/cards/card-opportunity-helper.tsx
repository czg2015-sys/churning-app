"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CircleHelp, CreditCard, Search, ShieldCheck, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FormattedNumberInput } from "@/components/formatted-number-input";
import { FormattedPercentInput } from "@/components/formatted-percent-input";
import type { FinancialProfile, Opportunity } from "@/lib/types";
import { latestReview, money, numberValue, reviewStatusLabel, verificationAgeDays } from "@/lib/plan-math";
import styles from "@/app/cards/cards.module.css";

const commonCards = [
  "Chase Freedom Unlimited",
  "Chase Freedom Flex",
  "Chase Sapphire Preferred",
  "Chase Sapphire Reserve",
  "Capital One Savor",
  "Capital One Venture",
  "Capital One Venture X",
  "Citi Double Cash",
  "Citi Strata Premier",
  "Discover it Cash Back",
  "American Express Blue Cash Everyday",
  "American Express Blue Cash Preferred",
  "American Express Gold Card",
  "Bank of America Customized Cash Rewards",
  "Wells Fargo Active Cash",
  "Wells Fargo Autograph",
  "Other card",
];

function researchVerified(item: Opportunity) {
  const age = verificationAgeDays(item.last_verified_at);
  const review = latestReview(item);
  const known = (value?: string | null) => Boolean(value && !["unknown", "pending", "unreviewed"].includes(value.toLowerCase()));
  const required = item.category === "credit_card_bonus"
    ? [review?.hard_pull_status, review?.tax_status, review?.close_rule_status]
    : [review?.hard_pull_status, review?.chexsystems_status, review?.ews_status, review?.tax_status, review?.insurance_status, review?.close_rule_status];
  return (item.safety_gate || "").toLowerCase() === "pass" && Number(item.evidence_confidence || 0) >= 80 && age !== null && age <= 7 && Boolean(review) && required.every(known);
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
  if (cash > 0) return cash;
  return numberValue(item.reward_points) * numberValue(item.cash_value_per_point);
}

function travelValue(item: Opportunity) {
  const points = numberValue(item.reward_points);
  const cpp = numberValue(item.travel_value_per_point);
  return points > 0 && cpp > 0 ? points * cpp : 0;
}

function spendFits(item: Opportunity, profile: FinancialProfile) {
  const requirement = numberValue(item.purchase_required_spend);
  if (requirement <= 0) return true;
  const windowDays = Number(item.spend_window_days || item.qualification_days || 90);
  const normalSpend = numberValue(profile.monthly_card_spend) * Math.max(1, windowDays / 30);
  return normalSpend >= requirement;
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
  const [enabled, setEnabled] = useState(Boolean(initialProfile.card_helper_opt_in));
  const [scoreBand, setScoreBand] = useState(initialProfile.credit_score_band || "unknown");
  const [payInFull, setPayInFull] = useState(Boolean(initialProfile.credit_cards_pay_in_full));
  const [noCard, setNoCard] = useState(Boolean(initialProfile.no_credit_card));
  const [monthlySpend, setMonthlySpend] = useState(numberValue(initialProfile.monthly_card_spend));
  const [currentRewardRate, setCurrentRewardRate] = useState(numberValue(initialProfile.current_spend_reward_rate));
  const [cards, setCards] = useState(initialCards);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filteredCards = useMemo(() => commonCards.filter((card) =>
    !cards.includes(card) && card.toLowerCase().includes(search.toLowerCase()),
  ).slice(0, 8), [cards, search]);

  const profileForCards = useMemo(() => ({ ...initialProfile, monthly_card_spend: monthlySpend, current_spend_reward_rate: currentRewardRate }), [initialProfile, monthlySpend, currentRewardRate]);

  const debitMatches = useMemo(() => opportunities
    .filter((item) => item.category === "debit_spend" && researchVerified(item))
    .filter((item) => spendFits(item, profileForCards))
    .sort((a, b) => conservativeValue(b) - conservativeValue(a)), [opportunities, profileForCards]);

  const creditMatches = useMemo(() => opportunities
    .filter((item) => item.category === "credit_card_bonus" && researchVerified(item))
    .filter((item) => spendFits(item, profileForCards))
    .filter((item) => scoreLikelyFits(item, scoreBand))
    .filter((item) => !cards.some((card) => item.product_name.toLowerCase().includes(card.toLowerCase()) || card.toLowerCase().includes(item.product_name.toLowerCase())))
    .sort((a, b) => conservativeValue(b) - conservativeValue(a)), [opportunities, profileForCards, scoreBand, cards]);

  async function savePreferences() {
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error: profileError } = await supabase.from("financial_profiles").update({
      card_helper_opt_in: enabled,
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
    const { error: deleteError } = await supabase.from("account_history").delete().eq("user_id", userId).eq("notes", note);
    if (!deleteError && !noCard && cards.length) {
      const rows = cards.map((productName) => ({
        user_id: userId,
        institution: issuerFromCard(productName),
        product_name: productName,
        account_type: "credit_card",
        outcome: "existing_or_previous",
        notes: note,
      }));
      const { error } = await supabase.from("account_history").insert(rows);
      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }
    }

    setMessage("Saved. Card comparisons now use these preferences.");
    setSaving(false);
  }

  return (
    <main className={styles.page}>
      <div className={`shell ${styles.shell}`}>
        <Link href="/my-plan" className={styles.back}><ArrowLeft size={15} /> Back to My Plan</Link>

        <section className={styles.hero}>
          <div>
            <span className="kicker">OPTIONAL · CARDS & SPENDING</span>
            <h1>See which card or debit offers may fit your normal spending.</h1>
            <p>This tool is optional and separate from your cash plan. It does not recommend borrowing, guarantee approval, or replace your own review of the issuer’s current terms.</p>
          </div>
          <div className={styles.disclosure}><CircleHelp size={18} /><span><strong>Educational comparison only.</strong> Credit-card applications can involve hard inquiries, annual fees, APR, utilization and issuer eligibility rules.</span></div>
        </section>

        <section className={styles.setupCard}>
          <div className={styles.toggleRow}>
            <div><h2>Turn on Cards & Spending</h2><p>Nothing from this section is used unless you choose to use it.</p></div>
            <button type="button" className={enabled ? styles.toggleOn : styles.toggleOff} onClick={() => setEnabled((value) => !value)}>{enabled ? "On" : "Off"}</button>
          </div>

          {enabled ? <>
            <div className={styles.formGrid}>
              <label><span>Estimated credit-score range</span><select value={scoreBand} onChange={(event) => setScoreBand(event.target.value)}><option value="unknown">I don’t know</option><option value="under_650">Under 650</option><option value="650_699">650–699</option><option value="700_749">700–749</option><option value="750_plus">750+</option></select><small>Used only as a fit signal. It never guarantees approval.</small></label>
              <label className={styles.checkbox}><input type="checkbox" checked={payInFull} onChange={(event) => setPayInFull(event.target.checked)} /><span><b>I plan to pay credit-card balances in full.</b><small>If this is unchecked, Churning will not surface credit-card welcome offers.</small></span></label>
              <label className={styles.checkbox}><input type="checkbox" checked={noCard} onChange={(event) => { setNoCard(event.target.checked); if (event.target.checked) setCards([]); }} /><span><b>I don’t currently have a credit card.</b><small>You can still compare debit rewards and researched card offers if you choose.</small></span></label>
              <label><span>Normal monthly card/debit spending</span><FormattedNumberInput name="card_helper_monthly_spend" value={monthlySpend} onValueChange={setMonthlySpend} /><small>We only show spend bonuses that fit purchases you already make.</small></label>
              <label><span>Current everyday cash-back rate</span><FormattedPercentInput name="card_helper_reward_rate" value={currentRewardRate} onValueChange={setCurrentRewardRate} max={20} /><small>Used to compare a new offer against what you already earn.</small></label>
            </div>

            {!noCard ? <div className={styles.cardSearch}>
              <label>Cards you already have or recently had</label>
              <div className={styles.searchBox}><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Chase Sapphire, Capital One Venture..." /></div>
              {cards.length ? <div className={styles.chips}>{cards.map((card) => <button type="button" key={card} onClick={() => setCards((current) => current.filter((item) => item !== card))}>{card}<span>×</span></button>)}</div> : null}
              {search ? <div className={styles.results}>{filteredCards.map((card) => <button type="button" key={card} onClick={() => { setCards((current) => [...current, card]); setSearch(""); }}>+ {card}</button>)}</div> : null}
            </div> : null}

            <button type="button" className="button primary" onClick={savePreferences} disabled={saving}>{saving ? "Saving…" : "Save card preferences"}</button>
            {message ? <p className={styles.message}>{message}</p> : null}
          </> : null}
        </section>

        {enabled ? <>
          <section className={styles.section}>
            <div className={styles.sectionHead}><div><WalletCards size={19} /><span><small>DEBIT & SPENDING</small><h2>Research-verified debit opportunities</h2></span></div><p>Only offers that fit spending you already told us you normally make are shown.</p></div>
            {debitMatches.length ? <div className={styles.grid}>{debitMatches.slice(0, 5).map((item) => <OfferCard key={item.id} item={item} />)}</div> : <EmptyState text="No research-verified debit offers currently fit your profile." />}
          </section>

          {payInFull ? <section className={styles.section}>
            <div className={styles.sectionHead}><div><CreditCard size={19} /><span><small>CREDIT CARD WELCOME OFFERS</small><h2>Optional researched card matches</h2></span></div><p>Shown separately from your cash plan. We do not suggest extra spending to earn a bonus.</p></div>
            {creditMatches.length ? <div className={styles.grid}>{creditMatches.slice(0, 5).map((item) => <OfferCard key={item.id} item={item} credit />)}</div> : <EmptyState text="No research-verified credit-card offers are currently ready for this section. Churning will not invent or publish unreviewed matches." />}
          </section> : <div className={styles.payFullGate}><ShieldCheck size={18} /><span>Credit-card welcome offers stay hidden unless you confirm you plan to pay balances in full.</span></div>}
        </> : null}
      </div>
    </main>
  );
}

function OfferCard({ item, credit = false }: { item: Opportunity; credit?: boolean }) {
  const review = latestReview(item);
  const cash = conservativeValue(item);
  const travel = travelValue(item);
  const requiredSpend = numberValue(item.purchase_required_spend);
  return <article className={styles.offerCard}>
    <div className={styles.offerTop}><span>{item.institution}</span><b>Research Verified</b></div>
    <h3>{item.product_name}</h3>
    <div className={styles.valueRow}><span><small>{credit && numberValue(item.reward_points) ? "Conservative cash value" : "Potential value"}</small><strong>{money.format(cash)}</strong></span>{travel > 0 ? <span><small>Potential travel value</small><strong>~{money.format(travel)}</strong></span> : null}</div>
    <div className={styles.facts}>
      {requiredSpend > 0 ? <span><small>Normal spend needed</small><b>{money.format(requiredSpend)} / {item.spend_window_days || item.qualification_days || 90} days</b></span> : null}
      {credit ? <span><small>Annual fee</small><b>{money.format(numberValue(item.annual_fee))}</b></span> : null}
      {credit && item.credit_score_band_hint ? <span><small>Research score note</small><b>{item.credit_score_band_hint}</b></span> : null}
      <span><small>Hard inquiry</small><b>{reviewStatusLabel(review?.hard_pull_status)}</b></span>
      <span><small>Last verified</small><b>{verificationAgeDays(item.last_verified_at) ?? "?"}d ago</b></span>
    </div>
    <p className={styles.terms}>{item.eligibility_notes || item.terms_summary || "Review the issuer’s current official terms before applying."}</p>
    <a href={item.official_url} target="_blank" rel="noreferrer">Official terms <ArrowUpRight size={13} /></a>
  </article>;
}

function EmptyState({ text }: { text: string }) {
  return <div className={styles.empty}><ShieldCheck size={20} /><span>{text}</span></div>;
}
