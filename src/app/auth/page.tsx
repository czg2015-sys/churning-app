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
        <div className="kicker">YOUR BANK BONUS GUIDE</div>
        <h1>Find out how bank bonuses work.</h1>
        <p>Get simple explanations, compare bank rewards, and track what you still need to do. Churning never moves your money.</p>
        <div className="auth-points">
          <span><ShieldCheck size={18} /> Research status and requirements shown</span>
          <span><LockKeyhole size={18} /> Your plan is private to your account</span>
          <span><CircleCheck size={18} /> Your saved plan stays with your account</span>
        </div>
        <div className="auth-mini-card"><span>CHURNING NEVER</span><strong>Moves money or opens accounts</strong><small>You review and complete every action yourself.</small></div>
      </section>
      <section className="auth-form-side">
        <Suspense fallback={<div className="loading-box">Loading…</div>}><AuthForm /></Suspense>
      </section>
    </main>
  );
}
