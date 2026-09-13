import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer-inner">
        <div><span className="brand-dot" /><strong>Churning</strong><small>Educational cash opportunity comparison + tracking.</small></div>
        <p><ShieldCheck size={15} /> Churning does not provide financial, tax, legal, or credit advice and does not open accounts or move money. Rates, bonuses, eligibility, and bank rules change. Always verify current official terms before acting.</p>
        <nav><Link href="/guest">Guest Mode</Link><Link href="/opportunities">Opportunity research</Link></nav>
      </div>
    </footer>
  );
}
