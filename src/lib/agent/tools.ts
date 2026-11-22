import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Agent } from "@/db/schema";
import { paidFetch } from "@/lib/paid-fetch";
import { spentLast24h } from "@/lib/ledger";
import { formatUsd } from "@/lib/money";
import { liveUsdcBalanceMicro, NETWORK } from "@/lib/wallet";
import { notifyOwner } from "@/lib/notify";
import type { ToolId } from "./catalog";

// Each tool is a plain function the model can call. Money tools go through
// paidFetch, which runs the spend guard in code before anything is paid.

export async function listMarketplace() {
  const rows = db.select().from(schema.services).all();
  return rows.map((s) => ({
    url: s.url,
    name: s.name,
    description: s.description,
    price: s.priceHintMicro != null ? formatUsd(s.priceHintMicro) : "see 402 response",
    params: s.params,
  }));
}

export async function walletStatus(agent: Agent) {
  const fresh = db.select().from(schema.agents).where(eq(schema.agents.id, agent.id)).get() ?? agent;
  const spent = spentLast24h(agent.id);
  const balance = fresh.walletMode === "simulated" ? fresh.simBalanceMicro : fresh.walletAddress ? await liveUsdcBalanceMicro(fresh.walletAddress) : null;
  return {
    mode: fresh.walletMode,
    network: fresh.walletMode === "live" ? NETWORK : "simulated",
    address: fresh.walletAddress,
    balance: balance == null ? "unknown" : formatUsd(balance),
    spentLast24h: formatUsd(spent),
    budgetLeftToday: formatUsd(Math.max(0, fresh.dailyBudgetMicro - spent)),
    perPaymentCap: formatUsd(fresh.perPaymentCapMicro),
    needsApprovalAbove: formatUsd(fresh.approvalThresholdMicro),
  };
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildTools(agent: Agent): ToolSet {
  const all: Record<ToolId, ToolSet[string]> = {
    marketplace: tool({
      description: "List the pay-per-use services this agent can buy from, with prices and parameters.",
      inputSchema: z.object({}),
      execute: async () => listMarketplace(),
    }),
    paid_api: tool({
      description:
        "Call a pay-per-use (x402) service URL and pay for it in USDC if required. Add query parameters to the URL. Spending rules are enforced automatically; if a payment is blocked or needs approval, explain that to the user.",
      inputSchema: z.object({ url: z.string().describe("Full service URL including query string, e.g. oja-demo://fx-rates?currency=USD") }),
      execute: async ({ url }) => paidFetch(agent, url),
    }),
    wallet: tool({
      description: "Check this agent's wallet balance, today's spending and its limits.",
      inputSchema: z.object({}),
      execute: async () => walletStatus(agent),
    }),
    web_search: tool({
      description: "Search the web (free). Returns titles, links and snippets.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const key = process.env.TAVILY_API_KEY;
        if (!key) return { error: "Web search isn't set up (TAVILY_API_KEY missing). Use other tools." };
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify({ query, max_results: 5 }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) return { error: `Search failed (HTTP ${res.status})` };
        const json = (await res.json()) as { results?: Array<{ title: string; url: string; content: string }> };
        return (json.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 400) }));
      },
    }),
    read_webpage: tool({
      description: "Read the text of a public web page (free).",
      inputSchema: z.object({ url: z.string().url() }),
      execute: async ({ url }) => {
        const u = new URL(url);
        if (!["http:", "https:"].includes(u.protocol)) return { error: "Only http(s) pages." };
        const res = await fetch(u, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "OjaAgentStudio/0.1" } });
        if (res.status === 402) return { error: "This page wants payment. Use paid_api instead." };
        const text = htmlToText(await res.text());
        return { status: res.status, text: text.slice(0, 8000) };
      },
    }),
    notify_owner: tool({
      description: "Send the owner a short message (shown in their inbox, and on Telegram if set up).",
      inputSchema: z.object({ message: z.string().max(1500) }),
      execute: async ({ message }) => notifyOwner({ agentId: agent.id, kind: "agent_message", text: `${agent.emoji} ${agent.name}: ${message}` }),
    }),
  };

  const out: ToolSet = {};
  for (const id of agent.tools as ToolId[]) if (all[id]) out[id] = all[id];
  return out;
}
