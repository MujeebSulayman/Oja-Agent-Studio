import { nanoid } from "nanoid";
import { db, schema } from "@/db";

/**
 * Saves a notification to the in-app inbox and, if configured, forwards it to Telegram.
 * Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to get approval requests on your phone.
 */
export async function notifyOwner(n: { agentId?: string | null; kind: "approval" | "agent_message" | "info"; text: string }) {
  db.insert(schema.notifications)
    .values({ id: `ntf_${nanoid(12)}`, agentId: n.agentId ?? null, kind: n.kind, text: n.text, createdAt: Date.now() })
    .run();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { delivered: "inbox" as const };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: n.text }),
    });
    return { delivered: res.ok ? ("telegram" as const) : ("inbox" as const) };
  } catch {
    return { delivered: "inbox" as const };
  }
}
