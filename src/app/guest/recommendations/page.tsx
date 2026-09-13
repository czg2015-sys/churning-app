import type { Metadata } from "next";
import { GuestRecommendationsClient } from "@/components/guest-recommendations-client";
import { getLiveOpportunities } from "@/lib/opportunities";

export const metadata: Metadata = { title: "Guest Recommendations" };

export default async function GuestRecommendationsPage() {
  const { opportunities, dataAvailable } = await getLiveOpportunities();
  return (
    <main className="page-shell recommendation-results-page guest-results-page">
      <div className="shell">
        <GuestRecommendationsClient opportunities={opportunities} dataAvailable={dataAvailable} />
      </div>
    </main>
  );
}
