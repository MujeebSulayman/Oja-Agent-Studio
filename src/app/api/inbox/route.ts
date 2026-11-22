import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function POST() {
  db.update(schema.notifications).set({ read: true }).where(eq(schema.notifications.read, false)).run();
  return NextResponse.json({ ok: true });
}
