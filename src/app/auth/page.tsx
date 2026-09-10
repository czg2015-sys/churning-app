import { Suspense } from "react";
import type { Metadata } from "next";
import { CircleCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function AuthPage() {
  return (
    <main className="auth-page">
      <section className="auth-side">
        <div className="kicker">YOUR MONEY MAP</div>
        <h1>A smarter plan for the cash you already have.</h1>
        <p>Your preferences, opportunities, and progress stay together—without giving Churning control of your bank accounts.</p>
        <div className="auth-points">
          <span><ShieldCheck size={18} /> Recommendations checked for risk and requirements</span>
          <span><LockKeyhole size={18} /> Your plan is private to your account</span>
          <span><CircleCheck size={18} /> Sign in stays active until you choose to sign out</span>
        </div>
      </section>
      <section className="auth-form-side">
        <Suspense fallback={<div className="loading-box">Loading…</div>}><AuthForm /></Suspense>
      </section>
    </main>
  );
}
