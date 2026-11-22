import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { toMicro } from "@/lib/money";
import { liveUsdcBalanceMicro, provisionLiveWallet, requestTestnetUsdc } from "@/lib/wallet";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("topup"), amount: z.number().positive().max(100) }),
  z.object({ action: z.literal("provision") }),
  z.object({ action: z.literal("faucet") }),
  z.object({ action: z.literal("balance") }),
]);

export async function POST(req: Request, ctx: RouteContext<"/api/agents/[id]/wallet">) {
  const { id } = await ctx.params;
  const agent = db.select().from(schema.agents).where(eq(schema.agents.id, id)).get();
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  try {
    switch (parsed.data.action) {
      case "topup": {
        if (agent.walletMode !== "simulated") return NextResponse.json({ error: "Only simulated wallets can be topped up here." }, { status: 400 });
        db.update(schema.agents)
          .set({ simBalanceMicro: sql`${schema.agents.simBalanceMicro} + ${toMicro(parsed.data.amount)}` })
          .where(eq(schema.agents.id, id))
          .run();
        return NextResponse.json({ ok: true });
      }
      case "provision": {
        const address = await provisionLiveWallet(agent);
        db.update(schema.agents).set({ walletAddress: address }).where(eq(schema.agents.id, id)).run();
        return NextResponse.json({ ok: true, address });
      }
      case "faucet": {
        if (!agent.walletAddress) return NextResponse.json({ error: "Create the wallet first." }, { status: 400 });
        const r = await requestTestnetUsdc(agent.walletAddress);
        return NextResponse.json({ ok: true, transactionHash: (r as { transactionHash?: string }).transactionHash ?? null });
      }
      case "balance": {
        const micro = agent.walletMode === "simulated" ? agent.simBalanceMicro : agent.walletAddress ? await liveUsdcBalanceMicro(agent.walletAddress) : null;
        return NextResponse.json({ balanceMicro: micro });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
