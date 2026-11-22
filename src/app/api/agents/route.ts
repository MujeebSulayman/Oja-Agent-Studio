import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { db, schema } from "@/db";
import { agentInputSchema, firstError, toAgentColumns } from "@/lib/agent/input";
import { toMicro } from "@/lib/money";
import { liveWalletsConfigured, provisionLiveWallet } from "@/lib/wallet";
import { eq } from "drizzle-orm";

const agentId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

export async function GET() {
  return NextResponse.json(db.select().from(schema.agents).all());
}

export async function POST(req: Request) {
  const parsed = agentInputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const v = parsed.data;
  if (v.walletMode === "live" && !liveWalletsConfigured()) {
    return NextResponse.json({ error: "Live wallets need your CDP API keys in .env.local. Use a simulated wallet for now." }, { status: 400 });
  }

  const id = agentId();
  db.insert(schema.agents)
    .values({ id, ...toAgentColumns(v), simBalanceMicro: v.walletMode === "simulated" ? toMicro(v.startingBalance) : 0, createdAt: Date.now() })
    .run();

  if (v.walletMode === "live") {
    try {
      const agent = db.select().from(schema.agents).where(eq(schema.agents.id, id)).get()!;
      const address = await provisionLiveWallet(agent);
      db.update(schema.agents).set({ walletAddress: address }).where(eq(schema.agents.id, id)).run();
    } catch (e) {
      // Agent still exists; the wallet can be created later from the Wallet tab.
      return NextResponse.json({ id, warning: `Agent created, but the live wallet failed: ${e instanceof Error ? e.message : e}` });
    }
  }
  return NextResponse.json({ id });
}
