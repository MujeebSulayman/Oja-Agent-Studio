import { connection } from "next/server";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { Markdown } from "@/components/Markdown";
import { MarkRead } from "@/components/MarkRead";
import { timeAgo } from "@/components/ui";

export default async function InboxPage() {
  await connection();
  const items = db.select().from(schema.notifications).orderBy(desc(schema.notifications.createdAt)).limit(200).all();
  const unread = items.some((n) => !n.read);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Messages from your agents</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1 text-ink-2">Scheduled reports and approval requests. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to also get them on your phone.</p>
        </div>
        {unread ? <MarkRead /> : null}
      </div>
      {items.length === 0 ? (
        <div className="card p-6 text-sm text-ink-2">No messages yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div key={n.id} className={`card p-4 text-sm ${n.read ? "" : "border-leaf/40"}`}>
              <div className="mb-1 flex items-center gap-2 text-xs text-ink-2">
                {!n.read ? <span className="h-2 w-2 rounded-full bg-leaf" /> : null}
                <span className={`pill ${n.kind === "approval" ? "bg-gold-soft text-gold" : "bg-dye-soft text-dye"}`}>{n.kind === "approval" ? "Approval needed" : n.kind === "agent_message" ? "Agent message" : "Info"}</span>
                <span className="ml-auto">{timeAgo(n.createdAt)}</span>
              </div>
              <Markdown text={n.text} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
