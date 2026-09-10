import type { Metadata } from "next";
import { QuestionnaireForm } from "@/components/questionnaire-form";
import { getLiveOpportunities } from "@/lib/opportunities";

export const metadata: Metadata = { title: "Guest Planner" };

export default async function GuestPage() {
  const { opportunities, dataAvailable } = await getLiveOpportunities();

  return (
    <main className="page-shell guest-page">
      <div className="shell guest-planner-shell">
        <div className="page-heading guest-heading">
          <div>
            <span className="kicker">GUEST MODE</span>
            <h1>Test-drive a cash plan.</h1>
            <p>Use real numbers or experiment for fun. No sign-up is needed and nothing you enter is saved.</p>
          </div>
          <div className="planner-progress" aria-label="Four short sections">
            <span className="active" /><span /><span /><span />
          </div>
        </div>
        {!dataAvailable && <div className="disclaimer"><strong>Guest Mode is still available.</strong> Live offers are temporarily unavailable, so you can build a practice allocation but recommendation cards may be empty.</div>}
        <QuestionnaireForm initial={null} guestMode opportunities={opportunities} />
      </div>
    </main>
  );
}
