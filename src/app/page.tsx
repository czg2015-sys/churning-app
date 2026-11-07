import Link from "next/link";
import { TopOpportunityTable } from "@/components/top-opportunity-table";
import { getLiveOpportunities } from "@/lib/opportunities";
import { ArrowRight, CalendarClock, CheckCircle2, CircleCheck, Landmark, LockKeyhole, ShieldCheck, Sparkles, WalletCards } from "lucide-react";

function HomeDashboardExample() {
  return (
    <aside className="beginner-example" aria-label="Example of how a bank bonus works">
      <div className="beginner-example-top">
        <span className="kicker">A SIMPLE EXAMPLE</span>
        <span className="beginner-example-note">Illustration, not a live offer</span>
      </div>
      <div className="beginner-example-prize"><span>Example checking account bonus</span><strong>+$300</strong></div>
      <p>A bank might offer you <strong>$300</strong> if you meet its requirements. Here's what that could look like:</p>
      <ol className="beginner-example-steps">
        <li><span>1</span><div><strong>Open the account with the bank</strong><small>Read the bank's official terms before applying.</small></div></li>
        <li><span>2</span><div><strong>Get $1,000 in qualifying paycheck deposits</strong><small>For example, within 90 days. This is called direct deposit (DD).</small></div></li>
        <li><span>3</span><div><strong>Receive the $300 bonus if you qualify</strong><small>The bank sets the payment timing and all other rules.</small></div></li>
      </ol>
      <div className="beginner-example-tracker">
        <div><span>What Churning helps you track</span><strong>Sample progress</strong></div>
        <div className="beginner-example-progress"><span /></div>
        <small>$600 of the example $1,000 deposit goal recorded</small>
        <div className="beginner-example-reminder"><CalendarClock size={16} /> Come back after payday to update your progress.</div>
      </div>
      <p className="beginner-example-fine">Real offers vary and may have fees, taxes, eligibility limits, and rules about keeping the account open. Churning does not move money or guarantee bonuses.</p>
    </aside>
  );
}

export default async function Home() {
  const { opportunities } = await getLiveOpportunities();
  return (
    <main className="home-page">
      <section className="home-hero shell refreshed-home-hero beginner-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span /> BANK BONUSES, EXPLAINED SIMPLY</div>
          <h1>Some banks pay you to open an account. <em>We help you understand how.</em></h1>
          <p className="hero-lede">Banks sometimes offer cash rewards when you open an account and meet a few rules. Churning helps you find offers, compare what's required, and remember what to do next.</p>
          <div className="hero-actions">
            <Link className="button primary hero-primary" href="/guest">Try it with your numbers <ArrowRight size={18} /></Link>
            <Link className="button ghost" href="#how-it-works">Learn how it works</Link>
          </div>
          <p className="guest-inline-note"><LockKeyhole size={15} /> No account needed to try. You choose whether to open an account with a bank.</p>
          <div className="beginner-hero-points">
            <span><CircleCheck size={17} /> Clear steps, no finance experience needed</span>
            <span><CircleCheck size={17} /> You always control your money</span>
            <span><ShieldCheck size={17} /> Research status and rules shown with offers</span>
          </div>
        </div>
        <HomeDashboardExample />
      </section>

      <section className="shell bonus-basics beginner-basics" aria-label="Three ways a bank can pay you">
        <div><span className="kicker">START WITH THE BASICS</span><h2>Three ways your money could earn more.</h2><p>You don't need to know these terms yet. Here's what each one means in plain English.</p></div>
        <div className="bonus-basics-grid">
          <article><span className="beginner-card-icon"><WalletCards size={20} /></span><h3>1. Paycheck bonuses</h3><p>Some banks give you a one-time cash reward for sending part of your paycheck to a new checking account.</p><small><strong>Direct deposit (DD)</strong> just means money your employer sends straight into your bank account.</small></article>
          <article><span className="beginner-card-icon"><CheckCircle2 size={20} /></span><h3>2. Savings bonuses</h3><p>Some banks give you a reward if you put enough money into a savings account and keep it there for a certain time.</p><small>You still need to check fees, withdrawal rules, and when the bonus is paid.</small></article>
          <article><span className="beginner-card-icon"><Landmark size={20} /></span><h3>3. High-yield savings</h3><p>This isn't usually a one-time bonus. It's a savings account that pays you interest while your money stays there.</p><small><strong>APY</strong> is a way banks describe yearly interest. The rate can change.</small></article>
        </div>
        <p className="beginner-basics-footer">Not every offer is a good deal. Churning shows the rules, money needed, possible fees, and what is still unverified before you decide.</p>
      </section>
      <section className="process shell new-how-it-works beginner-process" id="how-it-works">
        <div className="section-heading split-heading">
          <div><span>HOW CHURNING WORKS</span><h2>Four steps. No financial background needed.</h2></div>
          <p>Start with an example or try it using estimates. You can change your answers later.</p>
        </div>
        <div className="process-flow">
          <article><div className="process-number">01</div><div className="process-icon"><Sparkles size={22}/></div><h3>Understand the reward</h3><p>See examples of how banks pay bonuses and which conditions matter.</p><span>Learn first. Apply only when you're ready.</span></article>
          <article><div className="process-number">02</div><div className="process-icon"><WalletCards size={22}/></div><h3>Tell us what works for you</h3><p>Enter a rough savings amount, paycheck amount, and money you need to keep untouched.</p><span>No bank passwords or account numbers needed.</span></article>
          <article><div className="process-number">03</div><div className="process-icon"><CheckCircle2 size={22}/></div><h3>Compare your options</h3><p>See bonuses and savings rates alongside the deposits, deadlines, fees, and restrictions.</p><span>Choose the bank yourself. Churning never opens it for you.</span></article>
          <article><div className="process-number">04</div><div className="process-icon"><CalendarClock size={22}/></div><h3>Come back to track progress</h3><p>After payday or a deposit, update what happened. We'll show the remaining requirements and estimated next dates.</p><span>Tracking is manual, not a live bank connection.</span></article>
        </div>
        <div className="beginner-process-cta"><Link className="button primary" href="/auth">Save my plan <ArrowRight size={16}/></Link><Link className="button ghost" href="/guest">Try without an account</Link></div>
      </section>

      <div className="shell"><TopOpportunityTable opportunities={opportunities} heading="When you are ready: browse real bank offers and their rules." /></div>

      <section className="home-research shell compact-research-section">
        <div className="research-home-copy"><span className="kicker">RESEARCH YOU CAN SEE</span><h2>How do we check an offer?</h2><p>We show where an offer came from, whether its requirements were checked, and what still needs review. Never rely on the bonus amount alone.</p></div>
        <div className="research-home-grid">
          <div><strong>Inquiry & screening</strong><span>Hard-pull, ChexSystems, and EWS research when known.</span></div>
          <div><strong>Real economics</strong><span>Fees, APY opportunity cost, cash required, and estimated advantage.</span></div>
          <div><strong>Eligibility</strong><span>Prior-bank restrictions, state availability, and qualification windows.</span></div>
          <div><strong>After payout</strong><span>Close/clawback rules and the earliest point to review the account.</span></div>
        </div>
      </section>

      <section className="home-final-cta shell">
        <div><span className="kicker">TAKE YOUR FIRST STEP</span><h2>Find offers that might fit your situation.</h2><p>Try with estimates first. Create an account when you want to save your plan and track a real bank bonus.</p></div>
        <div className="home-final-actions"><Link className="button primary" href="/auth">Save my plan <ArrowRight size={17} /></Link><Link className="button ghost" href="/guest">Try without an account</Link></div>
      </section>
    </main>
  );
}
