import { Suspense } from "react";
import type { Metadata } from "next";
import { CircleCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function AuthPage() {
  return (
    <main className="auth-page">
      <section className="auth-side">
        <div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" />
        <div className="kicker">YOUR CASH COMMAND CENTER</div>
        <h1>One clear view of your next best move.</h1>
        <p>Keep your preferences, opportunities, and progress together—without giving Churning control of your accounts.</p>
        <div className="auth-points">
          <span><ShieldCheck size={18} /> Recommendations checked for risk and requirements</span>
          <span><LockKeyhole size={18} /> Your plan is private to your account</span>
          <span><CircleCheck size={18} /> Sign in stays active until you choose to sign out</span>
        </div>
        <div className="auth-mini-card"><span>CHURNING NEVER</span><strong>Moves money or opens accounts</strong><small>You review and complete every action yourself.</small></div>
      </section>
      <section className="auth-form-side">
        <Suspense fallback={<div className="loading-box">Loading…</div>}><AuthForm /></Suspense>
      </section>
    </main>
  );
}
