import { connection } from "next/server";
import { db, schema } from "@/db";
import { recentPayments } from "@/lib/ledger";
import { formatUsd } from "@/lib/money";
import { StatusPill, shortUrl } from "@/components/ui";

export default async function ReceiptsPage() {
  await connection();
  const payments = recentPayments(undefined, 500);
  const agents = new Map(db.select().from(schema.agents).all().map((a) => [a.id, a]));
  const paid = payments.filter((p) => p.status === "paid");
  const total = paid.reduce((s, p) => s + p.amountMicro, 0);
  const blocked = payments.filter((p) => p.status === "blocked").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Audit trail</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Receipts</h1>
          <p className="mt-1 text-ink-2">Every payment attempt: paid, blocked by a rule, or waiting for approval.</p>
        </div>
        <div className="flex gap-6 text-sm">
          <div><div className="eyebrow">Total paid</div><div className="text-xl font-semibold tabular-nums">{formatUsd(total)}</div></div>
          <div><div className="eyebrow">Paid calls</div><div className="text-xl font-semibold">{paid.length}</div></div>
          <div><div className="eyebrow">Blocked</div><div className="text-xl font-semibold">{blocked}</div></div>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-2">
            <tr>
              <th className="px-4 py-2 font-medium">Time</th><th className="px-4 py-2 font-medium">Agent</th><th className="px-4 py-2 font-medium">Service</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Proof / reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {payments.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-ink-2">No payments yet.</td></tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-ink-2">{new Date(p.createdAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="whitespace-nowrap px-4 py-2">{agents.get(p.agentId)?.emoji} {agents.get(p.agentId)?.name ?? "Deleted agent"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{shortUrl(p.url)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatUsd(p.amountMicro)}</td>
                  <td className="px-4 py-2"><StatusPill status={p.status} /></td>
                  <td className="px-4 py-2 text-xs text-ink-2">
                    {p.txHash ? (
                      <a className="text-dye underline" target="_blank" rel="noreferrer" href={`https://${p.network === "eip155:8453" ? "" : "sepolia."}basescan.org/tx/${p.txHash}`}>{p.txHash.slice(0, 10)}…</a>
                    ) : (
                      p.reason ?? (p.mode === "simulated" ? "Simulated payment" : "")
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
