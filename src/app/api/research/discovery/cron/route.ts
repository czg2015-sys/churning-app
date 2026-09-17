import { NextResponse } from "next/server";
import { runDiscoverySweep, hasDiscoverySearchConfig } from "@/lib/research/discovery";
import { hasResearchServerConfig } from "@/lib/research/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasResearchServerConfig()) {
    return NextResponse.json({ error: "Research server credentials are not configured." }, { status: 503 });
  }
  if (!hasDiscoverySearchConfig()) {
    return NextResponse.json({ status: "skipped", message: "Discovery search is installed but DISCOVERY_SEARCH_API_KEY is not configured." }, { status: 200 });
  }

  const result = await runDiscoverySweep({ triggerType: "cron" });
  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
