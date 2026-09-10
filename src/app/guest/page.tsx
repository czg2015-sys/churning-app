import type { Metadata } from "next";
import { DatabaseZap, EyeOff, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { QuestionnaireForm } from "@/components/questionnaire-form";
import { getLiveOpportunities } from "@/lib/opportunities";
import styles from "./guest.module.css";

export const metadata: Metadata = { title: "Guest Planner" };

export default async function GuestPage() {
  const { opportunities, dataAvailable } = await getLiveOpportunities();

  return (
    <main className={styles.guestExperience}>
      <div className="shell">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><i className={styles.eyebrowDot} /> GUEST LAB · NO ACCOUNT REQUIRED</span>
            <h1>Build a real plan.<br /><em>Save nothing.</em></h1>
            <p>Try Churning with real numbers or make up a scenario for fun. We’ll build a practice cash plan and show matching opportunities without creating an account.</p>
          </div>

          <aside className={styles.sessionPanel} aria-label="Guest session status">
            <div className={styles.panelTop}>
              <span className={styles.panelLabel}>TEMPORARY SESSION</span>
              <span className={styles.liveBadge}><Sparkles size={13} /> Guest Mode</span>
            </div>
            <div className={styles.sessionBody}>
              <div className={styles.sessionItem}>
                <span className={styles.sessionIcon}><DatabaseZap size={18} /></span>
                <div><strong>Database storage</strong><small>Your guest plan is never written to Supabase.</small></div>
                <span className={styles.sessionState}>OFF</span>
              </div>
              <div className={styles.sessionItem}>
                <span className={styles.sessionIcon}><EyeOff size={18} /></span>
                <div><strong>Account required</strong><small>No email, password, or signup needed.</small></div>
                <span className={styles.sessionState}>NO</span>
              </div>
              <div className={styles.sessionItem}>
                <span className={styles.sessionIcon}><ShieldCheck size={18} /></span>
                <div><strong>Practice recommendations</strong><small>See how your cash could be split and ranked.</small></div>
                <span className={styles.sessionState}>ON</span>
              </div>
            </div>
            <div className={styles.panelFoot}><TriangleAlert size={16} /><span>Leaving or refreshing the page clears the plan. Create an account only if you want to save and track it later.</span></div>
          </aside>
        </section>

        <section className={styles.demoStrip} aria-label="What guest mode includes">
          <article><span>01 · ENTER A SCENARIO</span><strong>Cash, paycheck, APY and spending</strong></article>
          <article><span>02 · GET A PRACTICE PLAN</span><strong>Direct deposit, HYSA and spending picks</strong></article>
          <article><span>03 · DECIDE LATER</span><strong>Create an account only if you want tracking</strong></article>
        </section>

        {!dataAvailable && <div className="disclaimer"><strong>Guest Mode is available.</strong> Live opportunity data is temporarily unavailable, so the practice allocation will still work but some recommendation cards may be empty.</div>}

        <section className={styles.formStage}>
          <QuestionnaireForm initial={null} guestMode opportunities={opportunities} />
        </section>
      </div>
    </main>
  );
}
