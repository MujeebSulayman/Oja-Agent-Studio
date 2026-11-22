import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, sqlite, schema } from "@/db";
import type { Agent } from "@/db/schema";
import { checkSpend } from "./guard";
import { notifyOwner } from "./notify";
import { formatUsd } from "./money";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PaymentIntent = {
  url: string;
  domain: string;
  amountMicro: number;
  payTo?: string;
  network?: string;
};

export type Reservation =
  | { decision: "allow"; paymentId: string }
  | { decision: "needs_approval"; paymentId: string; approvalId: string; reason: string }
  | { decision: "block"; paymentId: string; reason: string };

export function spentLast24h(agentId: string): number {
  const row = sqlite
    .prepare(
      `SELECT COALESCE(SUM(amount_micro), 0) AS total FROM payments
       WHERE agent_id = ? AND status IN ('paid', 'reserved') AND created_at >= ?`,
    )
    .get(agentId, Date.now() - DAY_MS) as { total: number };
  return row.total;
}

/**
 * Runs the spend guard and records the outcome in one synchronous SQLite transaction,
 * so two payments running at the same time can't both squeeze under the budget.
 * An allowed payment is "reserved" (counts toward the budget) until confirmed or failed.
 */
export function reservePayment(agent: Agent, intent: PaymentIntent, liveBalanceMicro: number | null): Reservation {
  let notifyText: string | null = null;
  const result = sqlite.transaction((): Reservation => {
    const now = Date.now();
    const fresh = db.select().from(schema.agents).where(eq(schema.agents.id, agent.id)).get();
    if (!fresh) throw new Error("Agent not found");

    const approval = db
      .select()
      .from(schema.approvals)
      .where(
        and(
          eq(schema.approvals.agentId, agent.id),
          eq(schema.approvals.url, intent.url),
          eq(schema.approvals.status, "approved"),
          gte(schema.approvals.amountMicro, intent.amountMicro),
        ),
      )
      .get();

    const decision = checkSpend(
      {
        perPaymentCapMicro: fresh.perPaymentCapMicro,
        dailyBudgetMicro: fresh.dailyBudgetMicro,
        approvalThresholdMicro: fresh.approvalThresholdMicro,
        allowedDomains: fresh.allowedDomains,
      },
      { domain: intent.domain, amountMicro: intent.amountMicro },
      {
        spentLast24hMicro: spentLast24h(agent.id),
        balanceMicro: fresh.walletMode === "simulated" ? fresh.simBalanceMicro : liveBalanceMicro,
        hasApproval: Boolean(approval),
      },
    );

    const paymentId = `pay_${nanoid(12)}`;
    const base = {
      id: paymentId,
      agentId: agent.id,
      url: intent.url,
      domain: intent.domain,
      amountMicro: intent.amountMicro,
      payTo: intent.payTo ?? null,
      network: intent.network ?? null,
      mode: fresh.walletMode,
      createdAt: now,
    };

    if (decision.decision === "allow") {
      if (approval) db.update(schema.approvals).set({ status: "used" }).where(eq(schema.approvals.id, approval.id)).run();
      db.insert(schema.payments).values({ ...base, status: "reserved", approvalId: approval?.id ?? null }).run();
      return { decision: "allow", paymentId };
    }

    if (decision.decision === "needs_approval") {
      const existing = db
        .select()
        .from(schema.approvals)
        .where(and(eq(schema.approvals.agentId, agent.id), eq(schema.approvals.url, intent.url), eq(schema.approvals.status, "pending")))
        .get();
      const approvalId = existing?.id ?? `apr_${nanoid(12)}`;
      if (!existing) {
        db.insert(schema.approvals)
          .values({ id: approvalId, agentId: agent.id, url: intent.url, domain: intent.domain, amountMicro: intent.amountMicro, status: "pending", createdAt: now })
          .run();
        notifyText = `${fresh.emoji} ${fresh.name} wants to pay ${formatUsd(intent.amountMicro)} to ${intent.domain}. Approve or reject it in Ọjà Agent Studio.`;
      }
      db.insert(schema.payments).values({ ...base, status: "pending_approval", reason: decision.reason, approvalId }).run();
      return { decision: "needs_approval", paymentId, approvalId, reason: decision.reason };
    }

    db.insert(schema.payments).values({ ...base, status: "blocked", reason: decision.reason }).run();
    return { decision: "block", paymentId, reason: decision.reason };
  })();

  if (notifyText) void notifyOwner({ agentId: agent.id, kind: "approval", text: notifyText });
  return result;
}

export function confirmPayment(paymentId: string, details: { txHash?: string | null; payTo?: string | null } = {}) {
  sqlite.transaction(() => {
    const p = db.select().from(schema.payments).where(eq(schema.payments.id, paymentId)).get();
    if (!p || p.status !== "reserved") return;
    db.update(schema.payments)
      .set({ status: "paid", txHash: details.txHash ?? null, payTo: details.payTo ?? p.payTo })
      .where(eq(schema.payments.id, paymentId))
      .run();
    if (p.mode === "simulated") {
      db.update(schema.agents)
        .set({ simBalanceMicro: sql`${schema.agents.simBalanceMicro} - ${p.amountMicro}` })
        .where(eq(schema.agents.id, p.agentId))
        .run();
    }
  })();
}

export function failPayment(paymentId: string, reason: string) {
  db.update(schema.payments)
    .set({ status: "failed", reason })
    .where(and(eq(schema.payments.id, paymentId), inArray(schema.payments.status, ["reserved"])))
    .run();
}

export function recentPayments(agentId?: string, limit = 50) {
  const q = db.select().from(schema.payments);
  return (agentId ? q.where(eq(schema.payments.agentId, agentId)) : q).orderBy(desc(schema.payments.createdAt)).limit(limit).all();
}
