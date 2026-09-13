import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuestionnaireForm } from "@/components/questionnaire-form";
import { createClient } from "@/lib/supabase/server";
import type { FinancialProfile } from "@/lib/types";

export const metadata: Metadata = { title: "Build My Plan" };

export default async function QuestionnairePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/auth?next=/questionnaire");

  const [{ data: profile }, { data: bankHistory }, { data: userProfile }] = await Promise.all([
    supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("account_history").select("institution").eq("user_id", userId).eq("notes", "Reported during onboarding"),
    supabase.from("profiles").select("state_code").eq("user_id", userId).maybeSingle(),
  ]);

  return (
    <main className="page-shell">
      <div className="shell questionnaire-wrap">
        <div className="page-heading">
          <div><span className="kicker">BUILD YOUR PROFILE</span><h1>A few answers. Better recommendations.</h1><p>Use estimates when you need to. The more accurate the inputs, the better Churning can compare offers against your real cash flow.</p></div>
        </div>
        <QuestionnaireForm initial={(profile as FinancialProfile | null) || null} initialBanks={((bankHistory || []) as Array<{ institution: string }>).map((row) => row.institution)} initialState={userProfile?.state_code || "CA"} />
      </div>
    </main>
  );
}
