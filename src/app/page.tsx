import Link from "next/link";
import { connection } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { spentLast24h, recentPayments } from "@/lib/ledger";
import { formatUsd } from "@/lib/money";
import { describeSchedule } from "@/lib/agent/schedule";
import { ModePill, Stat, StatusPill, shortUrl, timeAgo } from "@/components/ui";

export default async function Dashboard() {
  await connection();
  const agents = db.select().from(schema.agents).orderBy(desc(schema.agents.createdAt)).all();
  const payments = recentPayments(undefined, 8);
  const pending = db.select().from(schema.approvals).where(eq(schema.approvals.status, "pending")).all().length;
  const spentToday = agents.reduce((sum, a) => sum + spentLast24h(a.id), 0);
  const paidCount = db.select().from(schema.payments).where(eq(schema.payments.status, "paid")).all().length;
  const names = new Map(agents.map((a) => [a.id, a]));

  if (agents.length === 0) {
    return (
      <section className="mx-auto max-w-2xl pt-10 text-center">
        <div className="eyebrow">No code needed</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Create an AI agent that can pay for what it needs.</h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-2">
          Pick a job, set a budget, and your agent gets its own wallet. It buys data one request at a time with stablecoins, and it can never spend past the limits you set.
        </p>
        <Link href="/agents/new" className="btn-primary mt-8 px-6 py-3 text-base">
          Create your first agent
        </Link>
        <div className="mt-12 grid gap-3 text-left sm:grid-cols-3">
          {[
            ["1 · Pick a job", "Start from a template like Research Agent or FX Watcher."],
            ["2 · Set the rules", "Per-payment cap, daily budget, and which services it may pay."],
            ["3 · Let it work", "Chat with it, or run it on a schedule. Every cent gets a receipt."],
          ].map(([t, d]) => (
            <div key={t} className="card p-4">
              <div className="font-medium">{t}</div>
              <div className="mt-1 text-sm text-ink-2">{d}</div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Dashboard</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your agents</h1>
        </div>
        <Link href="/agents/new" className="btn-primary">+ New agent</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Agents" value={String(agents.length)} sub={`${agents.filter((a) => a.status === "active").length} active`} />
        <Stat label="Spent (24h)" value={formatUsd(spentToday)} sub="across all agents" />
        <Stat label="Paid calls" value={String(paidCount)} sub="all time" />
        <Stat label="Waiting on you" value={String(pending)} sub={pending ? "approvals pending" : "nothing pending"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => {
          const spent = spentLast24h(a.id);
          const pct = Math.min(100, Math.round((spent / a.dailyBudgetMicro) * 100));
          return (
            <Link key={a.id} href={`/agents/${a.id}`} className="card group block p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-paper-2 text-2xl">{a.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-semibold group-hover:text-leaf">{a.name}</div>
                    {a.status === "paused" ? <span className="pill bg-paper-2 text-ink-2">Paused</span> : null}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-sm text-ink-2">{a.description || a.instructions}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-ink-2">
                <ModePill mode={a.walletMode} />
                <span>{describeSchedule(a.schedule)}</span>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-ink-2">
                  <span>Today: {formatUsd(spent)} of {formatUsd(a.dailyBudgetMicro)}</span>
                  {a.walletMode === "simulated" ? <span>Balance {formatUsd(a.simBalanceMicro)}</span> : null}
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-2">
                  <div className={`h-full rounded-full ${pct > 80 ? "bg-gold" : "bg-leaf"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-semibold">Latest payments</h2>
          <Link href="/receipts" className="text-sm text-leaf hover:underline">All receipts →</Link>
        </div>
        {payments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-2">No payments yet. Chat with an agent and ask it something that needs paid data.</p>
        ) : (
          <ul className="divide-y divide-line">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="text-lg">{names.get(p.agentId)?.emoji ?? "🤖"}</span>
                <span className="font-medium">{names.get(p.agentId)?.name ?? "Deleted agent"}</span>
                <span className="truncate font-mono text-xs text-ink-2">{shortUrl(p.url)}</span>
                <span className="ml-auto tabular-nums">{formatUsd(p.amountMicro)}</span>
                <StatusPill status={p.status} />
                <span className="w-16 text-right text-xs text-ink-2">{timeAgo(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
