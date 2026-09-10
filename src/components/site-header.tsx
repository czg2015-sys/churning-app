import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="Churning home"><span className="brand-mark">C</span><span>CHURNING</span></Link>
        <nav aria-label="Primary navigation"><Link href="/">Start Here</Link><Link href="/my-plan">My Plan</Link><Link href="/opportunities">Opportunities</Link></nav>
        <Link className="header-signin" href="/auth">Sign in</Link>
      </div>
    </header>
  );
}
