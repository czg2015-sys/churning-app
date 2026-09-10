import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  CircleCheck,
  CreditCard,
  Landmark,
  LockKeyhole,
  MoveUpRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function Home() {
  return (
    <main className="home-page">
      <section className="home-hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span /> CASH OPTIMIZER · YOU STAY IN CONTROL</div>
          <h1>Make your cash work <em>harder.</em></h1>
          <p className="hero-lede">Build a clear strategy across bank bonuses, high-yield savings, and everyday spending—without handing over your money.</p>
          <div className="hero-actions">
            <Link className="button primary hero-primary" href="/guest"><Sparkles size={18} /> Try Guest Mode <ArrowRight size={18} /></Link>
            <Link className="button ghost" href="/auth">Create free account</Link>
          </div>
          <p className="guest-inline-note"><LockKeyhole size={15} /> Guest plans are private, temporary, and never saved.</p>
          <div className="trust-row">
            <span><ShieldCheck size={17} /> No bank connection</span>
            <span><CircleCheck size={17} /> No automatic transfers</span>
            <span><CircleCheck size={17} /> Clear requirements</span>
          </div>
        </div>

        <div className="command-preview" aria-label="Example optimized cash plan">
          <div className="command-glow" />
          <div className="command-window">
            <div className="command-header">
              <div><span className="window-dot" /><span className="overline">PLAN OVERVIEW</span></div>
              <span className="live-pill"><i /> Example</span>
            </div>
            <div className="balance-block">
              <span>Cash assigned</span>
              <strong>$25,000</strong>
              <small><MoveUpRight size={14} /> 100% allocated</small>
            </div>
            <div className="allocation-bar" aria-hidden="true"><span /><span /><span /></div>
            <div className="allocation-key"><span>Reserve 30%</span><span>HYSA 50%</span><span>Bonus 20%</span></div>
            <div className="preview-rows">
              <div><span className="preview-icon reserve"><ShieldCheck size={18} /></span><p><b>Emergency reserve</b><small>Always available</small></p><strong>$7,500</strong></div>
              <div><span className="preview-icon yield"><Landmark size={18} /></span><p><b>High-yield base</b><small>Liquid earnings</small></p><strong>$12,500</strong></div>
              <div><span className="preview-icon bonus"><BadgeDollarSign size={18} /></span><p><b>Bonus bucket</b><small>One offer at a time</small></p><strong>$5,000</strong></div>
            </div>
            <div className="preview-return"><span>Example extra value</span><b>+$612</b><small>estimated annually</small></div>
          </div>
          <div className="signal-card signal-one"><span><Landmark size={16} /></span><div><small>HYSA MATCH</small><b>Strong liquidity</b></div></div>
          <div className="signal-card signal-two"><span><CreditCard size={16} /></span><div><small>SPENDING</small><b>Normal purchases only</b></div></div>
        </div>
      </section>

      <section className="product-strip shell" aria-label="What Churning compares">
        <article><span>01</span><div><h2>Direct deposit</h2><p>Rank bonuses by payoff, effort, and timing.</p></div><Landmark size={21} /></article>
        <article><span>02</span><div><h2>High-yield savings</h2><p>Keep your liquid cash earning competitively.</p></div><ShieldCheck size={21} /></article>
        <article><span>03</span><div><h2>Everyday spending</h2><p>Find value without changing how you spend.</p></div><CreditCard size={21} /></article>
      </section>

      <section className="process shell" id="how-it-works">
        <div className="section-heading"><span>HOW IT WORKS</span><h2>From scattered offers to one clear move.</h2></div>
        <div className="process-grid">
          <article><b>01</b><h3>Add the basics</h3><p>Enter the cash, reserve, paycheck, and spending numbers that shape your options.</p></article>
          <article><b>02</b><h3>See your best split</h3><p>Compare a liquid reserve, savings base, and bonus bucket in one view.</p></article>
          <article><b>03</b><h3>Stay in control</h3><p>Review every requirement yourself before opening or moving anything.</p></article>
        </div>
      </section>
    </main>
  );
}
