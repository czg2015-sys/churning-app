"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const AUTH_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms = AUTH_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("AUTH_TIMEOUT"));
    }, ms);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function friendlySignInError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email or password is incorrect. If you haven’t made an account yet, choose Create an account.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Your email still needs to be confirmed. Check your inbox and spam folder, or use Resend confirmation below.";
  }

  return message;
}

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function resendConfirmation() {
    if (!email) {
      setMessage({ type: "error", text: "Enter your email first." });
      return;
    }

    setResending(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const emailRedirectTo = window.location.origin + "/auth/confirm?next=/questionnaire";
      const { error } = await withTimeout(
        supabase.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo },
        }),
      );

      if (error) {
        setMessage({
          type: "error",
          text: error.message.toLowerCase().includes("already confirmed")
            ? "This email is already confirmed. Switch to Sign in instead."
            : error.message,
        });
        return;
      }

      setMessage({
        type: "success",
        text: "If this email still needs confirmation, we sent another link. Check your inbox and spam folder. It can take a minute to arrive.",
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.message === "AUTH_TIMEOUT";
      setMessage({
        type: "error",
        text: timedOut
          ? "The resend request timed out. Please try again in a moment."
          : "We couldn’t resend the confirmation email right now. Please try again.",
      });
    } finally {
      setResending(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setAwaitingConfirmation(false);

    try {
      const supabase = createClient();

      if (mode === "signin") {
        const { error } = await withTimeout(
          supabase.auth.signInWithPassword({ email, password }),
        );

        if (error) {
          setMessage({ type: "error", text: friendlySignInError(error.message) });
          return;
        }

        router.push(searchParams.get("next") || "/my-plan");
        router.refresh();
        return;
      }

      const emailRedirectTo = window.location.origin + "/auth/confirm?next=/questionnaire";
      const { data, error } = await withTimeout(
        supabase.auth.signUp({ email, password, options: { emailRedirectTo } }),
      );

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else if (data.session) {
        router.push("/questionnaire");
        router.refresh();
      } else {
        setAwaitingConfirmation(true);
        setMessage({
          type: "success",
          text: "Check your email for a confirmation link. If it doesn’t arrive, check spam or use Resend confirmation below. If you’ve used this email before, switch to Sign in instead.",
        });
      }
    } catch (error) {
      console.error("[auth] Sign-in unavailable", error);
      const timedOut = error instanceof Error && error.message === "AUTH_TIMEOUT";
      setMessage({
        type: "error",
        text: timedOut
          ? "The sign-in request timed out. The preview still cannot reach Supabase correctly."
          : "Sign-in is temporarily unavailable on this deployment. Please try again after the preview account settings are enabled.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
      <p>{mode === "signin" ? "Your plan is right where you left it." : "It takes about two minutes to build your first plan."}</p>
      <form className="form-stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required />
          {mode === "signup" && <small>Use at least 8 characters.</small>}
        </div>
        {message && <div className={message.type === "error" ? "form-error" : "form-success"}>{message.text}</div>}
        <button className="button primary full" type="submit" disabled={loading}>
          {loading ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        {mode === "signup" && awaitingConfirmation && (
          <button className="button full" type="button" onClick={resendConfirmation} disabled={resending}>
            {resending ? "Resending…" : "Resend confirmation email"}
          </button>
        )}
      </form>
      <div className="auth-toggle">
        {mode === "signin" ? "New to Churning? " : "Already have an account? "}
        <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); setAwaitingConfirmation(false); }}>
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </div>
      <div className="auth-divider"><span>or</span></div>
      <Link className="button guest-auth-button full" href="/guest"><Sparkles size={17} /> Continue as guest</Link>
      <p className="auth-guest-note">No account needed. Guest plans disappear when you leave.</p>
    </div>
  );
}
