import type { Metadata } from "next";
import { BadgeCheck, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { QuestionnaireForm } from "@/components/questionnaire-form";
import styles from "./guest.module.css";

export const metadata: Metadata = { title: "Guest Planner" };

export default function GuestPage() {
  return (
    <main className={styles.guestExperience}>
      <div className="shell">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><i className={styles.eyebrowDot} /> GUEST PREVIEW · NO ACCOUNT REQUIRED</span>
            <h1>See what Churning would recommend <em>before you sign up.</em></h1>
            <p>Use your real numbers or test a scenario. You’ll get the same questionnaire, ranking logic, research labels, and tracker experience as an account user.</p>
          </div>

          <aside className={styles.sessionPanel} aria-label="Guest preview details">
            <div className={styles.panelTop}>
              <span className={styles.panelLabel}>FULL PRODUCT PREVIEW</span>
              <span className={styles.liveBadge}><Sparkles size={13} /> Guest Mode</span>
            </div>
            <div className={styles.sessionBody}>
              <div className={styles.sessionItem}>
                <span className={styles.sessionIcon}><BadgeCheck size={18} /></span>
                <div><strong>Same planning questions</strong><small>Guest and signed-in users use the exact same profile logic.</small></div>
                <span className={styles.sessionState}>YES</span>
              </div>
              <div className={styles.sessionItem}>
                <span className={styles.sessionIcon}><ShieldCheck size={18} /></span>
                <div><strong>Same research visibility</strong><small>See fit, freshness, and known risk/screening fields.</small></div>
                <span className={styles.sessionState}>YES</span>
              </div>
              <div className={styles.sessionItem}>
                <span className={styles.sessionIcon}><LockKeyhole size={18} /></span>
                <div><strong>No permanent profile</strong><small>Create an account later only if you want saved tracking.</small></div>
                <span className={styles.sessionState}>NO SAVE</span>
              </div>
            </div>
            <div className={styles.panelFoot}><LockKeyhole size={16} /><span>Your guest answers stay in the current browser session and are not written to a permanent Churning account.</span></div>
          </aside>
        </section>

        <section className={styles.demoStrip} aria-label="Guest planning flow">
          <article><span>01 · YOUR CASH FLOW</span><strong>Tell us where your cash sits and what your paycheck can support</strong></article>
          <article><span>02 · YOUR MATCHES</span><strong>Get a new recommendations page with your top three first</strong></article>
          <article><span>03 · YOUR TRACKER</span><strong>Add a candidate and see the full progress system before signing up</strong></article>
        </section>

        <section className={styles.formStage}>
          <QuestionnaireForm initial={null} guestMode />
        </section>
      </div>
    </main>
  );
}
