import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, sqlite, schema } from "@/db";

const body = z.object({ decision: z.enum(["approve", "reject"]) });

export async function POST(req: Request, ctx: RouteContext<"/api/approvals/[id]">) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const updated = sqlite.transaction(() => {
    const a = db.select().from(schema.approvals).where(and(eq(schema.approvals.id, id), eq(schema.approvals.status, "pending"))).get();
    if (!a) return false;
    const approved = parsed.data.decision === "approve";
    db.update(schema.approvals).set({ status: approved ? "approved" : "rejected", decidedAt: Date.now() }).where(eq(schema.approvals.id, id)).run();
    if (!approved) {
      db.update(schema.payments)
        .set({ status: "blocked", reason: "Rejected by owner" })
        .where(and(eq(schema.payments.approvalId, id), eq(schema.payments.status, "pending_approval")))
        .run();
    }
    return true;
  })();

  if (!updated) return NextResponse.json({ error: "This request was already decided." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
