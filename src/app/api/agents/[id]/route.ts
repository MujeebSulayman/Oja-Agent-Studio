import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, sqlite, schema } from "@/db";
import { agentInputSchema, firstError, toAgentColumns } from "@/lib/agent/input";
import { liveWalletsConfigured } from "@/lib/wallet";

export async function PATCH(req: Request, ctx: RouteContext<"/api/agents/[id]">) {
  const { id } = await ctx.params;
  const agent = db.select().from(schema.agents).where(eq(schema.agents.id, id)).get();
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  // Quick pause/resume toggle
  if (body && typeof body === "object" && "status" in body && Object.keys(body).length === 1) {
    if (body.status !== "active" && body.status !== "paused") return NextResponse.json({ error: "Bad status" }, { status: 400 });
    db.update(schema.agents).set({ status: body.status }).where(eq(schema.agents.id, id)).run();
    return NextResponse.json({ ok: true });
  }

  const parsed = agentInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  if (parsed.data.walletMode === "live" && !liveWalletsConfigured()) {
    return NextResponse.json({ error: "Live wallets need your CDP API keys in .env.local." }, { status: 400 });
  }
  db.update(schema.agents).set(toAgentColumns(parsed.data)).where(eq(schema.agents.id, id)).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/agents/[id]">) {
  const { id } = await ctx.params;
  sqlite.transaction(() => {
    db.delete(schema.messages).where(eq(schema.messages.agentId, id)).run();
    db.delete(schema.approvals).where(eq(schema.approvals.agentId, id)).run();
    db.delete(schema.agents).where(eq(schema.agents.id, id)).run();
    // Payments are kept as an audit trail.
  })();
  return NextResponse.json({ ok: true });
}
