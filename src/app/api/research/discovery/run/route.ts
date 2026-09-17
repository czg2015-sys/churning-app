import { NextResponse } from "next/server";
import { runDiscoverySweep, hasDiscoverySearchConfig } from "@/lib/research/discovery";
import { getResearchAdminSession, hasResearchServerConfig } from "@/lib/research/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  if (!hasResearchServerConfig()) {
    return NextResponse.json({ error: "Research server credentials are not configured." }, { status: 503 });
  }
  if (!hasDiscoverySearchConfig()) {
    return NextResponse.json({ error: "Discovery search is installed but DISCOVERY_SEARCH_API_KEY is not configured." }, { status: 503 });
  }

  const admin = await getResearchAdminSession();
  if (!admin.configured) {
    return NextResponse.json({ error: "RESEARCH_ADMIN_EMAILS is not configured." }, { status: 503 });
  }
  if (!admin.authorized || !admin.userId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const result = await runDiscoverySweep({ triggerType: "manual", force: true });
  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
