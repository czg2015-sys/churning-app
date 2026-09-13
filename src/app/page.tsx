import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  CircleCheck,
  Clock3,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TimerReset,
  WalletCards,
} from "lucide-react";

function HomeDashboardExample() {
  return (
    <div className="home-dashboard-example" aria-label="Illustrative Churning dashboard example">
      <div className="home-example-profile">
        <Image src="/jordan-carter.png" alt="Synthetic illustrative member portrait" width={56} height={56} className="profile-demo-avatar" priority />
        <div><span>ILLUSTRATIVE MEMBER</span><h2>Jordan Carter</h2><p>Balanced strategy · tracking two active rewards</p></div>
      </div>

      <div className="home-example-command">
        <div className="home-example-total">
          <small>TOTAL LIQUID CASH TRACKED</small>
          <strong>$18,000</strong>
          <span>cash outside long-term investments</span>
        </div>
        <div className="home-example-metrics">
          <div><small>Protected reserve</small><strong>$5,000</strong></div>
          <div><small>Active expected</small><strong>$600</strong></div>
          <div className="positive"><small>Est. cash value this year</small><strong>$827</strong></div>
        </div>
      </div>

      <div className="home-example-tracker-label"><span>REWARD MISSION CONTROL</span><b>Same tracker members use in My Plan</b></div>
      <div className="home-example-missions">
        <article className="reward-card compact-example-card">
          <div className="reward-card-top">
            <div><span className="reward-bank">CHASE TOTAL CHECKING</span><h3>$400 checking bonus</h3></div>
            <div className="reward-value"><small>Expected reward</small><strong>$400</strong></div>
          </div>
          <div className="reward-progress-row"><div className="reward-progress-copy"><strong>50% of time window</strong><span>45 of 90 days · 45 days left</span></div><span className="reward-status">ACTIVE</span></div>
          <div className="reward-progress-track"><span style={{ width: "50%" }} /></div>
          <div className="reward-progress-row requirement-preview"><div className="reward-progress-copy"><strong>60% of DD requirement</strong><span>$600 recorded of $1,000 target</span></div><CheckCircle2 size={17} /></div>
          <div className="reward-progress-track requirement-track"><span style={{ width: "60%" }} /></div>
          <div className="reward-quick-grid home-quick-grid">
            <div><Clock3 size={15} /><span><small>Qualify by</small><b>90-day window</b></span></div>
            <div><TimerReset size={15} /><span><small>Close review</small><b>After payout + terms review</b></span></div>
          </div>
        </article>

        <article className="reward-card compact-example-card">
          <div className="reward-card-top">
            <div><span className="reward-bank">CHASE SAVINGS</span><h3>$200 savings promotion</h3></div>
            <div className="reward-value"><small>Expected reward</small><strong>$200</strong></div>
          </div>
          <div className="reward-progress-row"><div className="reward-progress-copy"><strong>53% of hold period</strong><span>48 of 90 days · 42 days left</span></div><span className="reward-status">ACTIVE</span></div>
          <div className="reward-progress-track"><span style={{ width: "53%" }} /></div>
          <div className="reward-progress-row requirement-preview"><div className="reward-progress-copy"><strong>Balance requirement funded</strong><span>$10,000 recorded of $10,000 target</span></div><CheckCircle2 size={17} /></div>
          <div className="reward-progress-track requirement-track"><span style={{ width: "100%" }} /></div>
          <div className="reward-quick-grid home-quick-grid">
            <div><BadgeDollarSign size={15} /><span><small>Opportunity cost</small><b>Compared with current APY</b></span></div>
            <div><ShieldCheck size={15} /><span><small>Research</small><b>Terms shown before action</b></span></div>
          </div>
        </article>
      </div>
      <p className="home-example-disclosure">Illustrative example only. Offer terms, rates, eligibility, taxes, and payout timing can change.</p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="home-page">
      <section className="home-hero shell refreshed-home-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span /> CASH STRATEGY + REWARD TRACKER</div>
          <h1>Are you fully taking advantage of <em>your savings?</em></h1>
          <p className="hero-lede">Churning helps you compare bank bonuses, high-yield savings, and debit/spending rewards against what your cash earns today—then tracks the requirements so you know what to do next.</p>
          <div className="cash-scope-note"><WalletCards size={17} /><span>Built for liquid cash you keep outside long-term investments—after bills and the emergency reserve you want left untouched.</span></div>
          <div className="hero-actions">
            <Link className="button primary hero-primary" href="/guest"><Sparkles size={18} /> Find my opportunities <ArrowRight size={18} /></Link>
            <Link className="button ghost" href="/auth">Create free account</Link>
          </div>
          <p className="guest-inline-note"><LockKeyhole size={15} /> Guest Mode uses the same planning questions without permanently saving your answers.</p>
          <div className="trust-row">
            <span><ShieldCheck size={17} /> Research status visible</span>
            <span><CircleCheck size={17} /> You move the money</span>
            <span><CircleCheck size={17} /> Weekly freshness standard</span>
          </div>
        </div>
        <HomeDashboardExample />
      </section>

      <section className="process shell new-how-it-works" id="how-it-works">
        <div className="section-heading split-heading">
          <div><span>HOW IT WORKS</span><h2>From idle cash to a trackable plan.</h2></div>
          <p>Churning is designed to answer one question: <strong>what is the best use of the liquid cash you already have, without pretending every bonus is worth the effort?</strong></p>
        </div>
        <div className="process-flow">
          <article><div className="process-number">01</div><div className="process-icon"><WalletCards size={22} /></div><h3>Tell us where your cash stands</h3><p>Enter savings, checking, the reserve you want untouched, your paycheck capacity, normal spending, and what your savings already earns.</p><span>Total and usable cash are calculated for you.</span></article>
          <article><div className="process-number">02</div><div className="process-icon"><Sparkles size={22} /></div><h3>See your strongest matches</h3><p>We rank up to ten relevant opportunities, put your top three first, and separate direct-deposit, savings, and debit/spending options so the tradeoffs are clear.</p><span>Value · effort · liquidity · eligibility · research</span></article>
          <article><div className="process-number">03</div><div className="process-icon"><CalendarClock size={22} /></div><h3>Add only what you want to track</h3><p>Confirm the real opening date, cash committed, and requirements. The clock does not begin until you actually open the account.</p><span>Time progress stays separate from requirement progress.</span></article>
          <article><div className="process-number">04</div><div className="process-icon"><ShieldCheck size={22} /></div><h3>Finish the reward safely</h3><p>Track payout timing, fees, waiver rules, closing restrictions, and the actual reward received before deciding what to keep or close.</p><span>Your completed earnings build a history.</span></article>
        </div>
      </section>

      <section className="home-research shell compact-research-section">
        <div className="research-home-copy"><span className="kicker">RESEARCH YOU CAN SEE</span><h2>A bonus number is only the beginning.</h2><p>Each opportunity can publish the evidence that matters before you act. If research is stale or incomplete, Churning shows that instead of hiding it.</p></div>
        <div className="research-home-grid">
          <div><strong>Inquiry & screening</strong><span>Hard-pull, ChexSystems, and EWS research when known.</span></div>
          <div><strong>Real economics</strong><span>Fees, APY opportunity cost, cash required, and estimated advantage.</span></div>
          <div><strong>Eligibility</strong><span>Prior-bank restrictions, state availability, and qualification windows.</span></div>
          <div><strong>After payout</strong><span>Close/clawback rules and the earliest point to review the account.</span></div>
        </div>
      </section>

      <section className="home-final-cta shell">
        <div><span className="kicker">START WITH YOUR REAL NUMBERS</span><h2>See what your cash could be doing differently.</h2><p>No account is required to build the first plan.</p></div>
        <Link className="button primary" href="/guest">Build my plan <ArrowRight size={17} /></Link>
      </section>
    </main>
  );
}
