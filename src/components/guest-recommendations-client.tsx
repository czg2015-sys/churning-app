"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { GuestWorkspace } from "@/components/guest-workspace";
import type { FinancialProfile, Opportunity } from "@/lib/types";

type GuestPayload = {
  profile: FinancialProfile;
  banks: string[];
  stateCode: string;
  createdAt: string;
};

export function GuestRecommendationsClient({ opportunities, dataAvailable }: { opportunities: Opportunity[]; dataAvailable: boolean }) {
  const [payload, setPayload] = useState<GuestPayload | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("churning_guest_profile");
      if (raw) setPayload(JSON.parse(raw) as GuestPayload);
    } finally {
      setLoaded(true);
    }
  }, []);

  if (!loaded) return <div className="loading-box">Building your matches…</div>;

  if (!payload) {
    return (
      <section className="guest-missing-plan">
        <LockKeyhole size={26} />
        <h2>Start with the guest questionnaire.</h2>
        <p>We could not find a guest profile in this browser session.</p>
        <Link className="button primary" href="/guest">Build a guest plan</Link>
      </section>
    );
  }

  return (
    <>
      <div className="results-topbar">
        <Link href="/guest"><ArrowLeft size={15} /> Edit answers</Link>
        <span><ShieldCheck size={14} /> Guest entries are not saved to a permanent account.</span>
      </div>
      <header className="results-hero">
        <span className="kicker">YOUR GUEST MATCHES</span>
        <h1>Here’s where your cash could work harder.</h1>
        <p>These matches use the same ranking logic as an account plan. Create an account only if you want to save opportunities and keep tracking them later.</p>
      </header>
      {!dataAvailable ? (
        <section className="recommendation-data-error"><ShieldCheck size={24} /><div><h2>We couldn’t load the verified offer feed right now.</h2><p>Your answers are still available in this browser session. Refresh to retry the live feed; Churning will not fill the page with stale or invented matches.</p></div></section>
      ) : (
        <GuestWorkspace profile={payload.profile} opportunities={opportunities} usedBanks={payload.banks || []} stateCode={payload.stateCode || "CA"} resultsPage />
      )}
    </>
  );
}
