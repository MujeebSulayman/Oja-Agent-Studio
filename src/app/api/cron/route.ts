import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { runAgent } from "@/lib/agent/run";
import { isDue } from "@/lib/agent/schedule";

export const maxDuration = 300;

// Runs every agent whose schedule is due. Call it every minute:
//  - locally: `npm run scheduler`
//  - on Vercel: a cron job hitting /api/cron with `Authorization: Bearer $CRON_SECRET`
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Set CRON_SECRET to enable scheduled runs in production" }, { status: 401 });
  }
  if (secret &&req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const due = db
    .select()
    .from(schema.agents)
    .where(and(eq(schema.agents.status, "active"), ne(schema.agents.schedule, "off")))
    .all()
    .filter((a) => isDue(a.schedule, a.lastScheduledRunAt));

  const ran: Array<{ id: string; name: string; ok: boolean }> = [];
  for (const agent of due) {
    db.update(schema.agents).set({ lastScheduledRunAt: Date.now() }).where(eq(schema.agents.id, agent.id)).run();
    try {
      await runAgent(agent.id, agent.schedulePrompt, "schedule");
      ran.push({ id: agent.id, name: agent.name, ok: true });
    } catch {
      ran.push({ id: agent.id, name: agent.name, ok: false });
    }
  }
  return NextResponse.json({ checkedAt: new Date().toISOString(), ran });
}

export const GET = handle;
export const POST = handle;
