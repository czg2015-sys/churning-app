import { NextResponse } from "next/server";
import { runResearchScan } from "@/lib/research/agent";
import { getResearchAdminSession, hasResearchServerConfig } from "@/lib/research/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  if (!hasResearchServerConfig()) {
    return NextResponse.json({ error: "Research Agent server credentials are not configured." }, { status: 503 });
  }

  const admin = await getResearchAdminSession();
  if (!admin.configured) {
    return NextResponse.json({ error: "RESEARCH_ADMIN_EMAILS is not configured." }, { status: 503 });
  }
  if (!admin.authorized || !admin.userId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const result = await runResearchScan({ triggerType: "manual", initiatedBy: admin.userId });
  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
