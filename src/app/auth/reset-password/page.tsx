"use client";
import {useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
export default function ResetPasswordPage() {
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(password!==confirm){setMessage("Passwords do not match.");return;}
    setSaving(true);setMessage("");
    try {
      const db=createClient();
      const {data,error:authError}=await db.auth.getUser();
      if(authError || !data.user){setMessage("Open a valid reset link from your email first. If it expired, request a new one from Sign in.");return;}
      const {error}=await db.auth.updateUser({password});
      if(error){setMessage(error.message);return;}
      setSaved(true);setPassword("");setConfirm("");
    } catch {setMessage("Could not save your password. Please try again.");}
    finally{setSaving(false);}
  }
  return <main className="page-shell"><div className="shell"><section className="auth-card"><h1>Reset your password</h1>{saved ? <p role="status">Password saved. <Link href="/my-plan">Return to My Plan</Link></p> : <form className="form-stack" onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></label><label>Confirm password<input type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>{message ? <p role="alert">{message}</p>:null}<button className="button primary" disabled={saving}>{saving?"Saving…":"Save new password"}</button><Link href="/auth">Back to sign in</Link></form>}</section></div></main>;
}
