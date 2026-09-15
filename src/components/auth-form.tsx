"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage({ type: "error", text: error.message });
          return;
        }

        router.push(searchParams.get("next") || "/my-plan");
        router.refresh();
        return;
      }

      const emailRedirectTo = window.location.origin + "/auth/confirm?next=/questionnaire";
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else if (data.session) {
        router.push("/questionnaire");
        router.refresh();
      } else {
        setMessage({ type: "success", text: "Check your email and tap the confirmation link. Then we’ll build your plan." });
      }
    } catch (error) {
      console.error("[auth] Sign-in unavailable", error);
      setMessage({
        type: "error",
        text: "Sign-in is temporarily unavailable on this deployment. Please try again after the preview account settings are enabled.",
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
      </form>
      <div className="auth-toggle">
        {mode === "signin" ? "New to Churning? " : "Already have an account? "}
        <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); }}>
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </div>
      <div className="auth-divider"><span>or</span></div>
      <Link className="button guest-auth-button full" href="/guest"><Sparkles size={17} /> Continue as guest</Link>
      <p className="auth-guest-note">No account needed. Guest plans disappear when you leave.</p>
    </div>
  );
}
