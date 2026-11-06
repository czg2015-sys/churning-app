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
          {profile ? (
            <div><span className="kicker">MY PROFILE</span><h1>Your money, all in one place.</h1><p>These are your saved answers. Change them anytime. To record a real deposit or bonus payment, choose Update progress in My Plan.</p></div>
          ) : (
            <div><span className="kicker">GET STARTED</span><h1>Let's find bank offers that could work for you.</h1><p>Start with your checking, savings, and money you need for bills. Add paycheck details if you have them. Estimates are fine, and you can edit everything later.</p></div>
          )}
        </div>
        <div className="profile-intro-guide"><span aria-hidden="true">✓</span><div><strong>{profile ? "Want to change one answer?" : "No bank logins or account numbers needed"}</strong><p>{profile ? "Open the section you want, make your changes, and save. Your tracked bank accounts remain in My Plan." : "The first section is about your money. The other sections help us match offers but can be filled out later."}</p></div></div>
        <QuestionnaireForm initial={(profile as FinancialProfile | null) || null} initialBanks={((bankHistory || []) as Array<{ institution: string }>).map((row) => row.institution)} initialState={userProfile?.state_code || "CA"} />
      </div>
    </main>
  );
}
