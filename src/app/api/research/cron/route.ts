import { NextResponse } from "next/server";
import { runResearchScan } from "@/lib/research/agent";
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
    return NextResponse.json({ error: "Research Agent server credentials are not configured." }, { status: 503 });
  }

  const schedule = request.headers.get("x-vercel-cron-schedule");
  const scope = schedule === "0 16 * * 1" ? "full" : "expiring";
  const result = await runResearchScan({ triggerType: "cron", scope });
  return NextResponse.json({ ...result, scope }, { status: result.status === "failed" ? 500 : 200 });
}
