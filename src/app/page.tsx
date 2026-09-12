import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BadgeDollarSign,
  CalendarClock,
  CircleCheck,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

export default function Home() {
  return (
    <main className="home-page">
      <section className="home-hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span /> CASH STRATEGY OS · YOU STAY IN CONTROL</div>
          <h1>Turn idle cash into a <em>tracked strategy.</em></h1>
          <p className="hero-lede">Churning ranks cash opportunities against your real baseline, then tracks every requirement, payout window, fee, and safe-close review from one command center.</p>
          <div className="hero-actions">
            <Link className="button primary hero-primary" href="/guest"><Sparkles size={18} /> Build a practice plan <ArrowRight size={18} /></Link>
            <Link className="button ghost" href="/auth">Create free account</Link>
          </div>
          <p className="guest-inline-note"><LockKeyhole size={15} /> Guest Mode writes nothing to your account or database.</p>
          <div className="trust-row">
            <span><ShieldCheck size={17} /> Safety floor before ranking</span>
            <span><CircleCheck size={17} /> No automatic transfers</span>
            <span><CircleCheck size={17} /> Manual reward confirmation</span>
          </div>
        </div>

        <div className="command-preview" aria-label="Example Churning reward tracker">
          <div className="command-glow" />
          <div className="command-window advanced-preview">
            <div className="command-header"><div><span className="window-dot" /><span className="overline">REWARD MISSION CONTROL</span></div><span className="live-pill"><i /> Example</span></div>
            <div className="preview-mission-head"><div><small>CHASE</small><strong>Checking reward</strong></div><b>$400</b></div>
            <div className="preview-dual-progress">
              <div><span><b>TIME WINDOW</b><small>45 of 90 days</small></span><strong>50%</strong><i><em style={{ width: "50%" }} /></i></div>
              <div><span><b>REQUIREMENTS</b><small>2 of 4 confirmed</small></span><strong>50%</strong><i className="green"><em style={{ width: "50%" }} /></i></div>
            </div>
            <div className="preview-rows mission-rows">
              <div><span className="preview-icon yield"><CircleCheck size={18} /></span><p><b>Account opened</b><small>Confirmed Sep 3</small></p><strong>Done</strong></div>
              <div><span className="preview-icon bonus"><Landmark size={18} /></span><p><b>Direct deposit</b><small>$600 of $1,000 recorded</small></p><strong>60%</strong></div>
              <div><span className="preview-icon reserve"><CalendarClock size={18} /></span><p><b>Safe-close review</b><small>Calculated from stored terms</small></p><strong>Dec 17</strong></div>
            </div>
            <div className="preview-return"><span>Reward is not counted as earned until you confirm payout</span><b><BadgeCheck size={17} /> Manual</b></div>
          </div>
          <div className="signal-card signal-one"><span><ShieldCheck size={16} /></span><div><small>SAFETY GATE</small><b>80/100 floor</b></div></div>
          <div className="signal-card signal-two"><span><BadgeDollarSign size={16} /></span><div><small>BASELINE</small><b>Compare vs your HYSA</b></div></div>
        </div>
      </section>

      <section className="product-strip shell" aria-label="Churning core workflow">
        <article><span>01</span><div><h2>Rank the next move</h2><p>Cash fit, paycheck capacity, liquidity, effort, confidence, and bank history.</p></div><Sparkles size={21} /></article>
        <article><span>02</span><div><h2>Track the real requirements</h2><p>Separate the time window from what you actually completed.</p></div><CalendarClock size={21} /></article>
        <article><span>03</span><div><h2>Know when to review the exit</h2><p>Fees, payout timing, safe-close review, and completed earnings history.</p></div><WalletCards size={21} /></article>
      </section>

      <section className="process shell" id="how-it-works">
        <div className="section-heading"><span>THE CHURNING LOOP</span><h2>Recommendation → reward → history → next move.</h2></div>
        <div className="process-grid">
          <article><b>01</b><h3>Build your baseline</h3><p>Enter the cash, reserve, current APY, paycheck, spending, tax estimate, and banks you already use.</p></article>
          <article><b>02</b><h3>Add one realistic move</h3><p>Choose from safety-cleared recommendations and enter the actual opening date, committed cash, and deposit plan.</p></article>
          <article><b>03</b><h3>Track until it is real</h3><p>Only confirmed payouts become lifetime earnings. Then review whether the account should stay open.</p></article>
        </div>
      </section>
    </main>
  );
}
