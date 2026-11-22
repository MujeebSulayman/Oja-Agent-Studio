import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db, schema } from "@/db";
import { toMicro } from "@/lib/money";

const body = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(300),
  url: z.string().trim().url().refine((u) => /^https?:\/\//.test(u), "Use an http(s) URL"),
  category: z.string().trim().min(2).max(30).default("data"),
  price: z.number().min(0).max(100).optional(),
  params: z.string().trim().max(300).default(""),
});

export async function GET() {
  return NextResponse.json(db.select().from(schema.services).all());
}

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid service" }, { status: 400 });
  const v = parsed.data;
  const id = `svc_${nanoid(10)}`;
  db.insert(schema.services)
    .values({ id, name: v.name, description: v.description, url: v.url, category: v.category, priceHintMicro: v.price != null ? toMicro(v.price) : null, params: v.params, builtIn: false, createdAt: Date.now() })
    .run();
  return NextResponse.json({ id });
}
