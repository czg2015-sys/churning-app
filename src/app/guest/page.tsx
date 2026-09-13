import type { Metadata } from "next";
import { CircleCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import { QuestionnaireForm } from "@/components/questionnaire-form";
import styles from "./guest.module.css";

export const metadata: Metadata = { title: "Guest Planner" };

export default function GuestPage() {
  return (
    <main className={styles.guestExperience}>
      <div className="shell">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><i className={styles.eyebrowDot} /> GUEST MODE · NO ACCOUNT REQUIRED</span>
            <h1>See what Churning would recommend <em>before you sign up.</em></h1>
            <p>Use the same planning questions and ranking logic as an account user. Churning is built for liquid cash you keep outside long-term investments—after bills and the reserve you want left untouched.</p>
            <div className={styles.heroTrust}>
              <span><CircleCheck size={15} /> Same recommendation engine</span>
              <span><ShieldCheck size={15} /> Research status stays visible</span>
              <span><LockKeyhole size={15} /> Guest answers are not permanently saved</span>
            </div>
          </div>
        </section>

        <section className={styles.formStage}>
          <QuestionnaireForm initial={null} guestMode />
        </section>
      </div>
    </main>
  );
}
