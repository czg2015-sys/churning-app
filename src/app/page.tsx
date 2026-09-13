import Image from "next/image";
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
  TrendingUp,
  WalletCards,
} from "lucide-react";

export default function Home() {
  return (
    <main className="home-page">
      <section className="home-hero shell refreshed-home-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span /> SAVINGS STRATEGY ENGINE · YOU STAY IN CONTROL</div>
          <h1>Are you fully taking advantage of <em>your savings?</em></h1>
          <p className="hero-lede">Churning compares bank bonuses, high-yield savings, and cash rewards against what your money earns today—then helps you track every requirement, payout, fee, and next step.</p>
          <div className="hero-actions">
            <Link className="button primary hero-primary" href="/guest"><Sparkles size={18} /> See what you could be earning <ArrowRight size={18} /></Link>
            <Link className="button ghost" href="/auth">Create free account</Link>
          </div>
          <p className="guest-inline-note"><LockKeyhole size={15} /> Try the full planning flow without creating an account.</p>
          <div className="trust-row">
            <span><ShieldCheck size={17} /> Research status published</span>
            <span><CircleCheck size={17} /> No automatic transfers</span>
            <span><CircleCheck size={17} /> 7-day freshness standard</span>
          </div>
        </div>

        <div className="profile-demo-wrap" aria-label="Illustrative Churning member example">
          <div className="profile-demo-card">
            <div className="profile-demo-head">
              <Image src="/jordan-carter.png" alt="Synthetic demo profile portrait" width={64} height={64} className="profile-demo-avatar" priority />
              <div><span>ILLUSTRATIVE MEMBER</span><h2>Jordan Carter</h2><p>Balanced pace · $18,000 cash being tracked</p></div>
              <span className="live-pill"><i /> Demo</span>
            </div>
            <div className="profile-demo-summary">
              <div><small>Estimated gross cash value this year</small><strong>$827</strong><span>before taxes · illustrative</span></div>
              <div><small>Active opportunities</small><strong>2</strong><span>plus high-yield savings</span></div>
            </div>
            <div className="demo-mission-list">
              <article>
                <div className="demo-mission-title"><span><Landmark size={17} /></span><div><small>CHASE TOTAL CHECKING</small><b>$400 checking bonus</b></div><strong>$400</strong></div>
                <div className="demo-progress-copy"><span>Time window</span><b>45 of 90 days</b></div><div className="demo-progress"><i style={{ width: "50%" }} /></div>
                <div className="demo-progress-copy"><span>Qualifying direct deposit</span><b>$600 of $1,000</b></div><div className="demo-progress green"><i style={{ width: "60%" }} /></div>
              </article>
              <article>
                <div className="demo-mission-title"><span><WalletCards size={17} /></span><div><small>CHASE SAVINGS</small><b>$200 savings promotion</b></div><strong>$200</strong></div>
                <div className="demo-progress-copy"><span>90-day balance hold</span><b>48 of 90 days</b></div><div className="demo-progress"><i style={{ width: "53%" }} /></div>
                <div className="demo-progress-copy"><span>Required new money</span><b>$10,000 of $10,000</b></div><div className="demo-progress green"><i style={{ width: "100%" }} /></div>
              </article>
              <article className="demo-savings-row">
                <div className="demo-mission-title"><span><TrendingUp size={17} /></span><div><small>HIGH-YIELD SAVINGS</small><b>$8,000 at 4.10% APY</b></div><strong>+$328/yr</strong></div>
              </article>
            </div>
            <div className="demo-math-note"><BadgeCheck size={15} /><span>The $827 illustration combines $328 in annual HYSA interest + $400 checking bonus + roughly $99 incremental value from the $200 savings bonus after giving up about $101 of 4.10% APY for 90 days. Public offer terms can change.</span></div>
          </div>
          <div className="signal-card signal-one"><span><ShieldCheck size={16} /></span><div><small>RESEARCH</small><b>Risk fields visible</b></div></div>
          <div className="signal-card signal-two"><span><BadgeDollarSign size={16} /></span><div><small>BASELINE</small><b>Compare against what you earn now</b></div></div>
        </div>
      </section>

      <section className="home-proof shell">
        <div><strong>One profile</strong><span>Cash, reserve, paycheck, spending, pace, and bank history.</span></div>
        <div><strong>Top matches first</strong><span>See your strongest three opportunities before the longer list.</span></div>
        <div><strong>Track what actually matters</strong><span>Requirements, payout timing, fees, and safe-close review dates.</span></div>
      </section>

      <section className="process shell new-how-it-works" id="how-it-works">
        <div className="section-heading split-heading"><div><span>HOW CHURNING WORKS</span><h2>A clearer way to make your cash work harder.</h2></div><p>We built the flow around one question: <strong>is the next move actually better for you than doing nothing?</strong> Rate alone is not enough, and a big bonus is not enough.</p></div>
        <div className="process-flow">
          <article><div className="process-number">01</div><div className="process-icon"><WalletCards size={22} /></div><h3>Show us your starting point</h3><p>Tell us where your cash sits, what you want untouched, what your pay can support, and what you already earn on savings.</p><span>We calculate your usable cash automatically.</span></article>
          <article><div className="process-number">02</div><div className="process-icon"><Sparkles size={22} /></div><h3>Get your strongest matches</h3><p>Your results open on a dedicated recommendations page with the top three first, followed by additional opportunities that fit your profile.</p><span>Value · effort · liquidity · eligibility · research</span></article>
          <article><div className="process-number">03</div><div className="process-icon"><CalendarClock size={22} /></div><h3>Track the real requirements</h3><p>Once you add an opportunity, time progress and requirement progress stay separate so a passing deadline never looks like qualification.</p><span>DD · balances · transactions · payout</span></article>
          <article><div className="process-number">04</div><div className="process-icon"><ShieldCheck size={22} /></div><h3>Know what happens after payout</h3><p>See monthly fees, waiver rules, closing restrictions, research notes, and a safe-close review date before you decide whether to keep the account.</p><span>Completed earnings build your history.</span></article>
        </div>
      </section>

      <section className="home-research shell">
        <div className="research-home-copy"><span className="kicker">MORE THAN A RATE TABLE</span><h2>We publish the research behind the match.</h2><p>Every opportunity can carry known information about credit inquiry behavior, ChexSystems, Early Warning Services, tax treatment, deposit insurance, fees, eligibility, and closing rules. Research older than seven days is treated as stale by the ranking layer until it is refreshed.</p></div>
        <div className="research-home-grid">
          <div><strong>Hard inquiry</strong><span>Known credit-pull behavior</span></div><div><strong>ChexSystems / EWS</strong><span>Deposit-screening research</span></div><div><strong>Tax treatment</strong><span>Known reporting status</span></div><div><strong>Close rules</strong><span>Hold periods, fees, and clawbacks</span></div>
        </div>
      </section>

      <section className="home-final-cta shell">
        <div><span className="kicker">START WITH YOUR REAL BASELINE</span><h2>Find out whether your cash has a better next move.</h2><p>Guest Mode uses the same planning questions and ranking logic. No account required to see the experience.</p></div>
        <Link className="button primary" href="/guest">Build a guest plan <ArrowRight size={18} /></Link>
      </section>
    </main>
  );
}
