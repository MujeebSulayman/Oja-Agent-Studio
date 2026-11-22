import Link from "next/link";
import { connection } from "next/server";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatUsd } from "@/lib/money";
import { shortUrl, timeAgo } from "@/components/ui";
import { ApprovalButtons } from "@/components/ApprovalButtons";

export default async function ApprovalsPage() {
  await connection();
  const rows = db.select().from(schema.approvals).orderBy(desc(schema.approvals.createdAt)).limit(100).all();
  const agents = new Map(db.select().from(schema.agents).all().map((a) => [a.id, a]));
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">Human in the loop</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Approvals</h1>
        <p className="mt-1 text-ink-2">Payments above an agent&apos;s “ask me” limit wait here. Approving lets that one payment through; then ask the agent again.</p>
      </div>

      {pending.length === 0 ? (
        <div className="card p-6 text-sm text-ink-2">Nothing waiting for you. 🎉</div>
      ) : (
        <div className="space-y-3">
          {pending.map((a) => {
            const agent = agents.get(a.agentId);
            return (
              <div key={a.id} className="card flex flex-wrap items-center gap-4 border-gold/40 p-4">
                <span className="text-2xl">{agent?.emoji ?? "🤖"}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {agent ? <Link className="hover:underline" href={`/agents/${agent.id}`}>{agent.name}</Link> : "Deleted agent"} wants to pay <b className="tabular-nums">{formatUsd(a.amountMicro)}</b>
                  </div>
                  <div className="truncate font-mono text-xs text-ink-2">{shortUrl(a.url)} · {timeAgo(a.createdAt)}</div>
                </div>
                <ApprovalButtons id={a.id} />
              </div>
            );
          })}
        </div>
      )}

      {decided.length ? (
        <section>
          <h2 className="mb-2 font-semibold">History</h2>
          <div className="card divide-y divide-line">
            {decided.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span>{agents.get(a.agentId)?.emoji ?? "🤖"}</span>
                <span className="font-mono text-xs text-ink-2">{shortUrl(a.url)}</span>
                <span className="ml-auto tabular-nums">{formatUsd(a.amountMicro)}</span>
                <span className={`pill ${a.status === "rejected" ? "bg-clay-soft text-clay" : a.status === "used" ? "bg-leaf-soft text-leaf" : "bg-dye-soft text-dye"}`}>
                  {a.status === "used" ? "Approved · paid" : a.status === "approved" ? "Approved · waiting for retry" : "Rejected"}
                </span>
                <span className="w-16 text-right text-xs text-ink-2">{a.decidedAt ? timeAgo(a.decidedAt) : ""}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
