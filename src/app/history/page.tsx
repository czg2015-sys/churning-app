import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleSlash, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { money, numberValue } from "@/lib/plan-math";
import type { AccountHistory, Mission } from "@/lib/types";

export const metadata: Metadata = { title: "Reward History" };
export const dynamic = "force-dynamic";

function dateLabel(value: string | null | undefined) {
  if (!value) return "Date not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date not recorded" :
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect("/auth?next=/history");
  const [{ data: missions }, { data: bankHistory }] = await Promise.all([
    supabase.from("missions").select("*,mission_steps(*)").eq("user_id", uid).in("status", ["complete", "cancelled"]).order("updated_at", { ascending: false }),
    supabase.from("account_history").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
  ]);
  const pastMissions = (missions || []) as Mission[];
  const rows = (bankHistory || []) as AccountHistory[];
  const missionKeys = new Set(pastMissions.filter(m => m.status === "complete").map(m => m.institution.toLowerCase()));
  const standalone = rows.filter(h => !missionKeys.has(h.institution.toLowerCase()));
  const completed = pastMissions.filter(m => m.status === "complete");
  const left = pastMissions.filter(m => m.status === "cancelled");
  return (
    <main className="page-shell my-plan-page">
      <div className="shell reward-history-page">
        <Link className="history-back" href="/my-plan"><ArrowLeft size={16}/> Back to My Plan</Link>
        <div className="history-heading"><History size={23}/><div><span className="kicker">YOUR SAVED ACCOUNT RECORDS</span><h1>Reward History</h1><p>Completed rewards and offers you stopped tracking stay here, instead of disappearing from your records.</p></div></div>
        <div className="history-counts"><span><CheckCircle2 size={15}/> {completed.length + standalone.filter(h => h.bonus_received).length} completed or recorded</span><span><CircleSlash size={15}/> {left.length} stopped tracking</span></div>
        <div className="reward-history-entries">
          {completed.map(m => {
            const paid = numberValue(m.mission_steps?.find(s => s.step_type === "bonus_received")?.current_amount);
            return <article className="history-entry" key={m.id}><div><small>COMPLETED</small><strong>{m.institution}</strong><span>{m.title}</span></div><div><b>{money.format(paid)}</b><small>{dateLabel((m as Mission & {updated_at?: string}).updated_at || m.opened_at)}</small></div></article>;
          })}
          {standalone.map(h =>
            <article className="history-entry" key={h.id}><div><small>{h.bonus_received ? "BONUS RECEIVED" : "BANK HISTORY"}</small><strong>{h.institution}</strong><span>{h.product_name || "Past account"}</span></div><div><b>{h.bonus_received ? money.format(numberValue(h.bonus_amount)) : "Recorded"}</b><small>{dateLabel(h.bonus_received_at || h.closed_at || h.opened_at)}</small></div></article>
          )}
          {left.map(m =>
            <article className="history-entry stopped" key={m.id}><div><small>STOPPED TRACKING</small><strong>{m.institution}</strong><span>{m.title}</span></div><div><b>No reward counted</b><small>{dateLabel((m as Mission & {updated_at?: string}).updated_at || m.opened_at)}</small></div></article>
          )}
          {!pastMissions.length && !rows.length ? <div className="history-empty">No completed or stopped rewards recorded yet. Your history will appear here when you confirm a reward or leave a tracked offer.</div> : null}
        </div>
        <p className="history-disclaimer">Stopping tracking here does not close a real bank account. Prior bonuses may restrict future signup eligibility; exact rules vary by bank.</p>
      </div>
    </main>
  );
}
