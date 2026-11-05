import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuestionnaireForm } from "@/components/questionnaire-form";
import { createClient } from "@/lib/supabase/server";
import type { FinancialProfile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Profile" };

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
          <div><span className="kicker">MY PROFILE</span><h1>Your money. Your preferences.</h1><p>Update your savings, paycheck and preferences here. Your answers stay saved. To record a bank deposit or bonus payment, use Update progress in My Plan.</p></div>
        </div>
        <QuestionnaireForm initial={(profile as FinancialProfile | null) || null} initialBanks={((bankHistory || []) as Array<{ institution: string }>).map((row) => row.institution)} initialState={userProfile?.state_code || "CA"} />
      </div>
    </main>
  );
}
