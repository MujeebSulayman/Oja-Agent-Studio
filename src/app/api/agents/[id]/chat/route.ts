import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgent } from "@/lib/agent/run";

export const maxDuration = 120;

const body = z.object({ message: z.string().trim().min(1).max(4000) });

export async function POST(req: Request, ctx: RouteContext<"/api/agents/[id]/chat">) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Type a message first" }, { status: 400 });
  try {
    return NextResponse.json(await runAgent(id, parsed.data.message, "chat"));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
