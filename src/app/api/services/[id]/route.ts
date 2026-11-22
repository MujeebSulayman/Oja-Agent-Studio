import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/services/[id]">) {
  const { id } = await ctx.params;
  db.delete(schema.services).where(and(eq(schema.services.id, id), eq(schema.services.builtIn, false))).run();
  return NextResponse.json({ ok: true });
}
