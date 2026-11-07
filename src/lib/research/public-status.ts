import "server-only";
import { createResearchAdminClient, hasResearchServerConfig } from "./server";

// Explicit allowlist: never pass raw research rows, admin identities or error logs to visitors.
export async function getPublicResearchStatus() {
  if (!hasResearchServerConfig()) return null;
  try {
    const db = createResearchAdminClient();
    const [monitor, discovery] = await Promise.all([
      db.from("research_runs").select("status,completed_at,checked_offers,unreachable_offers").not("completed_at","is",null).order("completed_at",{ascending:false}).limit(1).maybeSingle(),
      db.from("discovery_runs").select("status,completed_at,new_candidates,error_message").not("completed_at","is",null).order("completed_at",{ascending:false}).limit(1).maybeSingle(),
    ]);
    if (monitor.error || discovery.error) return null;
    return {
      checkedAt: monitor.data?.completed_at || null,
      checked: Number(monitor.data?.checked_offers || 0),
      blocked: Number(monitor.data?.unreachable_offers || 0),
      monitorStatus: monitor.data?.status || "unknown",
      discoveredAt: discovery.data?.completed_at || null,
      candidates: Number(discovery.data?.new_candidates || 0),
      discoveryPartial: Boolean(discovery.data?.error_message),
    };
  } catch { return null; }
}
