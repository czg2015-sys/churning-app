"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell"><div className="shell"><section className="empty-plan"><h2>Something didn’t load</h2><p>Your information is still safe. Try loading this page again.</p><button className="button primary" type="button" onClick={reset}>Try again</button></section></div></main>
  );
}
