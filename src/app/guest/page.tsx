import type { Metadata } from "next";
import { QuestionnaireForm } from "@/components/questionnaire-form";
import { createClient } from "@/lib/supabase/server";
import type { Opportunity } from "@/lib/types";

export const metadata: Metadata = { title: "Guest Planner" };

export default async function GuestPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("opportunities").select("*").eq("offer_status", "live");

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
        <QuestionnaireForm initial={null} guestMode opportunities={(data || []) as Opportunity[]} />
      </div>
    </main>
  );
}
