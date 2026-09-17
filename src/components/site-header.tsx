import Link from "next/link";
import { BarChart3, ShieldCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as { sub?: string; email?: string } | undefined;
  const signedIn = Boolean(claims?.sub);
  const email = typeof claims?.email === "string" ? claims.email : "";
  const accountLabel = email.includes("@") ? email.split("@")[0] : email || "Account";

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="Churning home"><span className="brand-mark">C</span><span>CHURNING</span><i>beta</i></Link>
        <nav aria-label="Primary navigation">
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/opportunities">Opportunities</Link>
          <Link href="/my-plan"><BarChart3 size={14} /> My Plan</Link>
          <Link href="/research-standards"><ShieldCheck size={14} /> Research & Risk</Link>
        </nav>
        <div className="header-actions">
          {signedIn
            ? <Link className="header-signin" href="/my-plan"><UserRound size={15} /> {accountLabel}</Link>
            : <Link className="header-signin" href="/auth">Sign in</Link>}
        </div>
      </div>
    </header>
  );
}
