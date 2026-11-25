import "./auth.css";
import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function AuthPage() {
  return (
    <main className="auth-form-side auth-entry">
      <Suspense fallback={<div className="loading-box">Loading…</div>}><AuthForm /></Suspense>
    </main>
  );
}
