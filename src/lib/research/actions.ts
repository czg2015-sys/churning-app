import "server-only";

import { createResearchAdminClient } from "@/lib/research/server";

export async function applyResearchAction({
  findingId,
  opportunityId,
  action,
  actorUserId,
  notes = null,
}: {
  findingId: string | null;
  opportunityId: string;
  action: "approve_baseline" | "keep_on_hold";
  actorUserId: string;
  notes?: string | null;
}) {
  const supabase = createResearchAdminClient();
  const now = new Date().toISOString();

  if (action === "approve_baseline") {
    if (!findingId) throw new Error("A finding is required to approve a page baseline.");

    const { data: finding, error: findingError } = await supabase
      .from("research_findings")
      .select("id,opportunity_id,content_hash,fetch_status,change_status,mismatch_flags,material_change")
      .eq("id", findingId)
      .eq("opportunity_id", opportunityId)
      .maybeSingle();

    if (findingError) throw findingError;
    if (!finding?.content_hash || finding.fetch_status !== "ok") {
      throw new Error("Only a successfully fetched official page can be approved as the current baseline.");
    }
    if (finding.material_change || (finding.mismatch_flags || []).length > 0) {
      throw new Error("Terms mismatch detected. Update/review the stored offer before approving this official-page baseline.");
    }

    const { error: monitorError } = await supabase
      .from("research_monitor_state")
      .update({
        approved_content_hash: finding.content_hash,
        approved_at: now,
        approved_by: actorUserId,
        monitor_status: "verified",
        updated_at: now,
      })
      .eq("opportunity_id", opportunityId);
    if (monitorError) throw monitorError;

    // Approving the page baseline confirms the official page being monitored. It does NOT
    // automatically Safety Clear an offer whose credit/Chex/EWS/closing review is still on hold.
    const { error: opportunityError } = await supabase
      .from("opportunities")
      .update({ last_verified_at: now, updated_at: now })
      .eq("id", opportunityId);
    if (opportunityError) throw opportunityError;
  } else {
    const [{ error: monitorError }, { error: opportunityError }] = await Promise.all([
      supabase
        .from("research_monitor_state")
        .update({ monitor_status: "hold", updated_at: now })
        .eq("opportunity_id", opportunityId),
      supabase
        .from("opportunities")
        .update({ safety_gate: "hold", updated_at: now })
        .eq("id", opportunityId),
    ]);
    if (monitorError) throw monitorError;
    if (opportunityError) throw opportunityError;
  }

  const { error: actionError } = await supabase.from("research_actions").insert({
    opportunity_id: opportunityId,
    finding_id: findingId,
    actor_user_id: actorUserId,
    action_type: action,
    notes,
  });
  if (actionError) throw actionError;
}
