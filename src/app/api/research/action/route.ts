import { NextResponse } from "next/server";
import { applyResearchAction } from "@/lib/research/actions";
import { getResearchAdminSession, hasResearchServerConfig } from "@/lib/research/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

  const body = (await request.json()) as {
    findingId?: string | null;
    opportunityId?: string;
    action?: "approve_baseline" | "keep_on_hold";
    notes?: string | null;
  };

  if (!body.opportunityId || !body.action || !["approve_baseline", "keep_on_hold"].includes(body.action)) {
    return NextResponse.json({ error: "Invalid research action." }, { status: 400 });
  }

  try {
    await applyResearchAction({
      findingId: body.findingId || null,
      opportunityId: body.opportunityId,
      action: body.action,
      actorUserId: admin.userId,
      notes: body.notes || null,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
