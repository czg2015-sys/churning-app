import { NextResponse } from "next/server";
import { runReminderSweep } from "@/lib/reminders";
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
    return NextResponse.json({ error: "Server credentials are not configured." }, { status: 503 });
  }

  try {
    return NextResponse.json(await runReminderSweep());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reminder sweep failed." }, { status: 500 });
  }
}
