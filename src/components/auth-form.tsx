"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const REMEMBERED_EMAIL = "churning.remembered-email";
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

function subscribeToStorage(notify: () => void) {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
}

function readSavedEmail() {
  try { return localStorage.getItem(REMEMBERED_EMAIL) || ""; }
  catch { return ""; }
}

export function AuthForm() {
  const confirmationFailed = useSearchParams().get("error") === "confirmation";
  const savedEmail = useSyncExternalStore(subscribeToStorage, readSavedEmail, () => "");
  const [rememberChoice, setRememberEmail] = useState<boolean>();
  const rememberEmail = rememberChoice ?? Boolean(savedEmail);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [editedEmail, setEmail] = useState<string>();
  const email = editedEmail ?? savedEmail;
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(confirmationFailed);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(confirmationFailed ? { type: "error", text: "That email link could not be verified. Request a new confirmation below, or choose Forgot password for a reset link." } : null);

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

  function saveEmail(value: string | null) {
    try {
      if (value) localStorage.setItem(REMEMBERED_EMAIL, value);
      else localStorage.removeItem(REMEMBERED_EMAIL);
    } catch { /* Sign-in also works without browser storage. */ }
  }

  async function resetPassword() {
    if (!email.trim()) { setMessage({type: "error", text: "Enter your email first."}); return; }
    setLoading(true);
    try {
      const {error} = await withTimeout(createClient().auth.resetPasswordForEmail(email.trim(), {redirectTo: window.location.origin + "/auth/confirm?next=/auth/reset-password"}));
      setMessage(error ? {type:"error",text:error.message} : {type:"success",text:"If an account matches that email, a password reset link will arrive shortly. Open it in this browser."});
    } catch { setMessage({type:"error",text:"Could not request a reset link. Please try again."}); }
    finally {setLoading(false);}
  }

  async function resendConfirmation() {
    if (!email.trim()) {
      setMessage({ type: "error", text: "Enter your email first." });
      return;
    }
    setResending(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const emailRedirectTo = window.location.origin + "/auth/confirm?next=/my-plan";
      const { error } = await withTimeout(supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo } }));
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
        const { data, error } = await withTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }));
        if (error) {
          setAwaitingConfirmation(error.code === "email_not_confirmed" || error.message.toLowerCase().includes("email not confirmed"));
          setMessage({ type: "error", text: friendlySignInError(error.message) });
          return;
        }
        if (!data.session) {
          setMessage({ type: "error", text: "Sign-in completed without a usable session. Please try again." });
          return;
        }

        // A full navigation makes sure the new auth cookies are read by the server header immediately.
        saveEmail(rememberEmail ? email.trim() : null);
        window.location.replace("/my-plan");
        return;
      }

      const emailRedirectTo = window.location.origin + "/auth/confirm?next=/my-plan";
      const { data, error } = await withTimeout(supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo } }));
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else if (data.session) {
        saveEmail(rememberEmail ? email.trim() : null);
        window.location.replace("/my-plan");
      } else {
        saveEmail(rememberEmail ? email.trim() : null);
        setAwaitingConfirmation(true);
        setMessage({ type: "success", text: "Check your inbox and spam folder for a confirmation link. Already registered? Choose Sign in." });
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
      <h1>{mode === "signin" ? "Sign in to Churning" : "Create your account"}</h1>

      <form className="form-stack" onSubmit={submit}>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoCapitalize="none" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" minLength={mode === "signup" ? 8 : undefined} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required />{mode === "signup" && <small>Use at least 8 characters.</small>}</div>

        <label className="remember-email">
          <input type="checkbox" checked={rememberEmail} onChange={(event) => {
            setRememberEmail(event.target.checked);
            if (!event.target.checked) {
              setEmail(email);
              saveEmail(null);
            }
          }} />
          Remember my email on this device
        </label>

        {message && <div role="status" className={message.type === "error" ? "form-error" : "form-success"}>{message.text}</div>}
        <button className="button primary full" type="submit" disabled={loading || resending}>{loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        {awaitingConfirmation && <button className="button full" type="button" onClick={resendConfirmation} disabled={loading || resending}>{resending ? "Resending…" : "Resend confirmation email"}</button>}
      </form>
      {mode === "signin" ? <button type="button" className="button ghost full" disabled={loading || resending} onClick={resetPassword}>Forgot password?</button> : null}
      <div className="auth-toggle">{mode === "signin" ? "New to Churning? " : "Already have an account? "}<button disabled={loading || resending} type="button" onClick={() => { setPassword(""); setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); setAwaitingConfirmation(false); }}>{mode === "signin" ? "Create an account" : "Sign in"}</button></div>
      <div className="auth-divider"><span>or</span></div>
      <Link className="button guest-auth-button full" href="/guest"><Sparkles size={17} /> Continue as guest</Link>
      <p className="auth-guest-note">No account needed. Guest plans disappear when you leave.</p>
    </div>
  );
}
