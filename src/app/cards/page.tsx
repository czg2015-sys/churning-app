import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CardOpportunityHelper } from "@/components/cards/card-opportunity-helper";
import { createClient } from "@/lib/supabase/server";
import type { FinancialProfile, Opportunity } from "@/lib/types";

export const metadata: Metadata = { title: "Cards & Spending" };
export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/auth?next=/cards");

  const [{ data: profile }, { data: history }, { data: opportunities }] = await Promise.all([
    supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("account_history").select("product_name").eq("user_id", userId).eq("account_type", "credit_card"),
    supabase.from("opportunities").select("*, opportunity_reviews(*)").eq("offer_status", "live").in("category", ["debit_spend", "credit_card_bonus"]),
  ]);

  if (!profile) redirect("/questionnaire");

  return <CardOpportunityHelper
    userId={userId}
    initialProfile={profile as FinancialProfile}
    initialCards={(history || []).map((row) => row.product_name).filter((value): value is string => Boolean(value))}
    opportunities={(opportunities || []) as Opportunity[]}
  />;
}
