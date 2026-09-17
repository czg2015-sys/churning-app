"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const AUTH_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms = AUTH_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("AUTH_TIMEOUT")), ms);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

function friendlySignInError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "Email or password is incorrect. If you haven’t made an account yet, choose Create an account.";
  if (normalized.includes("email not confirmed")) return "Your email still needs to be confirmed. Check your inbox and spam folder, or use Resend confirmation below.";
  return message;
}

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await withTimeout(supabase.auth.getClaims(), 5_000);
        if (active && data?.claims?.sub) window.location.replace("/my-plan");
      } catch {
        // Stay on the auth page when no valid session can be confirmed.
      }
    })();
    return () => { active = false; };
  }, []);

  async function resendConfirmation() {
    if (!email) {
      setMessage({ type: "error", text: "Enter your email first." });
      return;
    }
    setResending(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const emailRedirectTo = window.location.origin + "/auth/confirm?next=/my-plan";
      const { error } = await withTimeout(supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo } }));
      if (error) {
        setMessage({ type: "error", text: error.message.toLowerCase().includes("already confirmed") ? "This email is already confirmed. Switch to Sign in instead." : error.message });
        return;
      }
      setMessage({ type: "success", text: "If this email still needs confirmation, we sent another link. Check your inbox and spam folder. It can take a minute to arrive." });
    } catch (error) {
      const timedOut = error instanceof Error && error.message === "AUTH_TIMEOUT";
      setMessage({ type: "error", text: timedOut ? "The resend request timed out. Please try again in a moment." : "We couldn’t resend the confirmation email right now. Please try again." });
    } finally {
      setResending(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage(null);
    setAwaitingConfirmation(false);

    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { data, error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
        if (error) {
          setMessage({ type: "error", text: friendlySignInError(error.message) });
          return;
        }
        if (!data.session) {
          setMessage({ type: "error", text: "Sign-in completed without a usable session. Please try again." });
          return;
        }

        // A full navigation makes sure the new auth cookies are read by the server header immediately.
        window.location.assign("/my-plan");
        return;
      }

      const emailRedirectTo = window.location.origin + "/auth/confirm?next=/my-plan";
      const { data, error } = await withTimeout(supabase.auth.signUp({ email, password, options: { emailRedirectTo } }));
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else if (data.session) {
        window.location.assign("/my-plan");
      } else {
        setAwaitingConfirmation(true);
        setMessage({ type: "success", text: "Check your email for a confirmation link. If it doesn’t arrive, check spam or use Resend confirmation below. If you’ve used this email before, switch to Sign in instead." });
      }
    } catch (error) {
      console.error("[auth] Sign-in unavailable", error);
      const timedOut = error instanceof Error && error.message === "AUTH_TIMEOUT";
      setMessage({ type: "error", text: timedOut ? "The sign-in request timed out. Churning could not reach the account service. Please try again." : "Sign-in is temporarily unavailable. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
      <p>{mode === "signin" ? "Your plan is right where you left it." : "It takes about two minutes to build your first plan."}</p>
      <form className="form-stack" onSubmit={submit}>
        <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required />{mode === "signup" && <small>Use at least 8 characters.</small>}</div>

        {mode === "signin" ? (
          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, background: "rgba(255,255,255,.025)", cursor: "default" }}>
            <input type="checkbox" checked readOnly aria-label="Keep me signed in" />
            <span style={{ display: "grid", gap: 1 }}><strong style={{ fontSize: 14 }}>Keep me signed in</strong><small style={{ color: "var(--muted)" }}>Stays signed in on this device until you choose Sign out.</small></span>
          </label>
        ) : null}

        {message && <div className={message.type === "error" ? "form-error" : "form-success"}>{message.text}</div>}
        <button className="button primary full" type="submit" disabled={loading}>{loading ? "Signing in…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        {mode === "signup" && awaitingConfirmation && <button className="button full" type="button" onClick={resendConfirmation} disabled={resending}>{resending ? "Resending…" : "Resend confirmation email"}</button>}
      </form>
      <div className="auth-toggle">{mode === "signin" ? "New to Churning? " : "Already have an account? "}<button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); setAwaitingConfirmation(false); }}>{mode === "signin" ? "Create an account" : "Sign in"}</button></div>
      <div className="auth-divider"><span>or</span></div>
      <Link className="button guest-auth-button full" href="/guest"><Sparkles size={17} /> Continue as guest</Link>
      <p className="auth-guest-note">No account needed. Guest plans disappear when you leave.</p>
    </div>
  );
}
