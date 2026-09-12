import Link from "next/link";
import { BarChart3, Sparkles } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="Churning home"><span className="brand-mark">C</span><span>CHURNING</span><i>beta</i></Link>
        <nav aria-label="Primary navigation"><Link href="/#how-it-works">How it works</Link><Link href="/opportunities">Opportunities</Link><Link href="/my-plan"><BarChart3 size={14} /> My Plan</Link></nav>
        <div className="header-actions"><Link className="header-guest" href="/guest"><Sparkles size={15} /> Guest Lab</Link><Link className="header-signin" href="/auth">Sign in</Link></div>
      </div>
    </header>
  );
}
