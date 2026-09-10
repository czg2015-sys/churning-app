import Link from "next/link";
import { ArrowRight, BadgeDollarSign, CircleCheck, Landmark, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main>
      <section className="home-hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span /> CASH STRATEGY, MADE CLEAR</div>
          <h1>Know where every dollar should go next.</h1>
          <p className="hero-lede">Compare safe cash opportunities, build a personalized plan, and track every requirement until your money is ready for its next move.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/auth">Build my plan <ArrowRight size={18} /></Link>
            <Link className="button ghost" href="/opportunities">Compare opportunities</Link>
          </div>
          <div className="trust-row">
            <span><ShieldCheck size={17} /> No automatic transfers</span>
            <span><CircleCheck size={17} /> You stay in control</span>
          </div>
        </div>

        <div className="plan-preview" aria-label="Example cash plan preview">
          <div className="preview-top">
            <div><span className="overline">YOUR CASH PLAN</span><strong>$25,000</strong></div>
            <span className="live-pill"><i /> Ready</span>
          </div>
          <div className="allocation-bar" aria-hidden="true"><span /><span /><span /></div>
          <div className="preview-rows">
            <div><span className="preview-icon reserve"><ShieldCheck size={19} /></span><p><b>Emergency reserve</b><small>Always available</small></p><strong>$7,500</strong></div>
            <div><span className="preview-icon yield"><Landmark size={19} /></span><p><b>High-yield savings</b><small>Liquid base earnings</small></p><strong>$12,500</strong></div>
            <div><span className="preview-icon bonus"><BadgeDollarSign size={19} /></span><p><b>Bonus opportunity</b><small>Qualification bucket</small></p><strong>$5,000</strong></div>
          </div>
          <div className="preview-return"><span>Projected extra earnings</span><b>+$612</b><small>vs. leaving cash idle</small></div>
        </div>
      </section>

      <section className="process shell">
        <div className="section-heading"><span>HOW IT WORKS</span><h2>A plan you can actually follow.</h2></div>
        <div className="process-grid">
          <article><b>01</b><h3>Tell us what you have</h3><p>Add your available cash, current APY, paycheck, reserve needs, and comfort level.</p></article>
          <article><b>02</b><h3>Get your best split</h3><p>See how much should stay liquid and which opportunities fit without stretching your budget.</p></article>
          <article><b>03</b><h3>Track the requirements</h3><p>Follow each deposit, hold period, payout date, and safe-close review from one place.</p></article>
        </div>
      </section>
    </main>
  );
}
