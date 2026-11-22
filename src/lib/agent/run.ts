import { generateText, isStepCount, type LanguageModel, type ModelMessage } from "ai";
import { asc, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "@/db";
import type { Agent, ToolTraceItem } from "@/db/schema";
import { paidFetch } from "@/lib/paid-fetch";
import { notifyOwner } from "@/lib/notify";
import { buildTools, listMarketplace, walletStatus } from "./tools";

export type RunResult = { reply: string; trace: ToolTraceItem[]; messageId: string };

async function resolveModel(spec: string): Promise<LanguageModel> {
  const [provider, ...rest] = spec.split(":");
  const id = rest.join(":");
  // Legacy specs saved before the OpenRouter switch ("anthropic:x") map to OpenRouter slugs ("anthropic/x").
  const slug = provider === "openrouter" ? id : ["anthropic", "openai", "google"].includes(provider) ? `${provider}/${id}` : null;
  if (!slug) throw new Error(`Unknown model provider "${provider}"`);
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set in .env.local");
  // OpenRouter is OpenAI-compatible; use the chat completions endpoint.
  const { createOpenAI } = await import("@ai-sdk/openai");
  const openrouter = createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: process.env.OPENROUTER_API_KEY });
  return openrouter.chat(slug);
}

function systemPrompt(agent: Agent): string {
  return [
    `You are "${agent.name}", an AI agent built in Ọjà Agent Studio.`,
    agent.instructions,
    "",
    "Rules you must follow:",
    "- You have a wallet, but you never see its keys. Payments happen only through the paid_api tool.",
    "- Spending limits are enforced in code. If a payment is blocked or needs approval, tell the user plainly. Never try to get around a limit.",
    "- Use the marketplace tool to find services before calling paid_api. Built-in demo services use oja-demo:// URLs.",
    "- After paying for something, say what you paid and why.",
    "- If data is labelled sample data, say so.",
    `- Today is ${new Date().toLocaleDateString("en-NG", { dateStyle: "full", timeZone: "Africa/Lagos" })} (Lagos time).`,
  ].join("\n");
}

function history(agentId: string): ModelMessage[] {
  const rows = db.select().from(schema.messages).where(eq(schema.messages.agentId, agentId)).orderBy(desc(schema.messages.createdAt)).limit(20).all().reverse();
  return rows.map((m) => ({ role: m.role, content: m.content }) as ModelMessage);
}

async function runWithModel(agent: Agent): Promise<{ reply: string; trace: ToolTraceItem[] }> {
  const model = await resolveModel(agent.model);
  const result = await generateText({
    model,
    system: systemPrompt(agent),
    messages: history(agent.id),
    tools: buildTools(agent),
    stopWhen: isStepCount(8),
  });
  const trace: ToolTraceItem[] = [];
  for (const step of result.steps) {
    for (const r of step.toolResults) trace.push({ tool: r.toolName, input: r.input, output: r.output });
  }
  return { reply: result.text || "(The agent finished without a written reply.)", trace };
}

// ---------- Demo brain: deterministic, no API key, uses the same tools and spend guard ----------

function pickService(text: string): { url: string; label: string } | null {
  const t = text.toLowerCase();
  const currency = t.match(/\b(usd|gbp|eur|ghs|kes)\b/)?.[1] ?? (/(dollar)/.test(t) ? "usd" : /(pound)/.test(t) ? "gbp" : /(euro)/.test(t) ? "eur" : null);
  if (/(business|company|registered|registration|verify|\bcac\b|\brc\b)/.test(t) || (/\bcheck\b/.test(t) && /["“']/.test(text))) {
    const quoted = text.match(/["“']([^"”']+)["”']/)?.[1];
    const after = text.match(/(?:check|verify|look ?up|lookup|search)\s+(?:for\s+)?([A-Z][\w&' ]+)/)?.[1];
    const name = (quoted ?? after ?? "").trim();
    return { url: `oja-demo://business-lookup?name=${encodeURIComponent(name)}`, label: "Business registry lookup" };
  }
  if (/(\bfx\b|exchange|\brates?\b|dollar|pound|euro|\busd\b|\bgbp\b|\beur\b)/.test(t)) {
    return { url: `oja-demo://fx-rates${currency ? `?currency=${currency.toUpperCase()}` : ""}`, label: "Naira FX rates" };
  }
  if (/(fund|raise|round|investor|vc|startup)/.test(t)) {
    const country = t.match(/\b(nigeria|ghana|senegal|côte d'ivoire|ivory coast)\b/)?.[1];
    return { url: `oja-demo://funding-rounds?limit=3${country ? `&country=${encodeURIComponent(country)}` : ""}`, label: "West Africa fintech funding" };
  }
  if (/(price|market|rice|tomato|garri|beans|palm oil|onion|food|buy)/.test(t)) {
    const item = t.match(/\b(rice|tomato|garri|beans|palm oil|onion)/)?.[1];
    return { url: `oja-demo://market-prices${item ? `?item=${encodeURIComponent(item)}` : ""}`, label: "Market food prices" };
  }
  return null;
}

function summarise(data: unknown): string {
  const d = data as Record<string, unknown>;
  const lines: string[] = [];
  if (d.rates) {
    for (const [c, v] of Object.entries(d.rates as Record<string, { buy: number; sell: number }>)) lines.push(`- **${c}/NGN**: buy ₦${v.buy.toLocaleString()} · sell ₦${v.sell.toLocaleString()}`);
  } else if (Array.isArray(d.rows)) {
    for (const r of d.rows as Array<{ item: string; unit: string; prices: Record<string, number> }>) {
      const entries = Object.entries(r.prices).sort((a, b) => a[1] - b[1]);
      if (!entries.length) continue;
      lines.push(`- **${r.item}** (${r.unit}): cheapest at ${entries[0][0]}, ₦${entries[0][1].toLocaleString()}${entries.length > 1 ? `; dearest at ${entries.at(-1)![0]}, ₦${entries.at(-1)![1].toLocaleString()}` : ""}`);
    }
  } else if (Array.isArray(d.rounds)) {
    for (const r of d.rounds as Array<{ company: string; country: string; stage: string; amountUsd: number; sector: string }>) lines.push(`- **${r.company}** (${r.country}): ${r.stage}, $${(r.amountUsd / 1e6).toFixed(1)}M, ${r.sector}`);
  } else if (Array.isArray(d.matches)) {
    if (!d.matches.length) lines.push("- No matching business found.");
    for (const b of d.matches as Array<Record<string, string>>) lines.push(`- **${b.name}**: ${b.rcNumber}, ${b.type}, status **${b.status}**, ${b.state}, registered ${b.registered}`);
  } else {
    lines.push("```json", JSON.stringify(data, null, 2).slice(0, 1500), "```");
  }
  if (d.note) lines.push("", `_${d.note}_`);
  return lines.join("\n");
}

async function runDemoBrain(agent: Agent, userText: string, trigger: "chat" | "schedule"): Promise<{ reply: string; trace: ToolTraceItem[] }> {
  const trace: ToolTraceItem[] = [];
  const has = (t: string) => agent.tools.includes(t);
  const t = userText.toLowerCase();

  if (/(balance|wallet|budget|spent|how much.*left)/.test(t) && has("wallet")) {
    const w = await walletStatus(agent);
    trace.push({ tool: "wallet", input: {}, output: w });
    return { reply: `Wallet (${w.mode}): balance **${w.balance}**. Spent in the last 24h: ${w.spentLast24h}, so ${w.budgetLeftToday} of today's budget is left. Each payment is capped at ${w.perPaymentCap}, and anything above ${w.needsApprovalAbove} needs your approval.`, trace };
  }

  if (has("marketplace")) {
    const m = await listMarketplace();
    trace.push({ tool: "marketplace", input: {}, output: m });
  }

  const choice = pickService(userText);
  if (!choice) {
    return {
      reply:
        "I'm the demo brain, so I only understand a few kinds of request: naira FX rates, market food prices, business checks, and West Africa fintech funding. Try “What's the dollar rate today?” or “Where is rice cheapest?”. Connect a real model (Claude, GPT or Gemini) in Settings for open-ended questions.",
      trace,
    };
  }
  if (!has("paid_api")) return { reply: `I'd need to buy data from “${choice.label}”, but I'm not allowed to pay for services. Turn on “Pay for data” in my settings.`, trace };

  const result = await paidFetch(agent, choice.url);
  trace.push({ tool: "paid_api", input: { url: choice.url }, output: result });

  let reply: string;
  if (result.ok) {
    reply = `${result.paid ? `I paid **${result.amount}** to “${choice.label}”.` : `“${choice.label}” was free.`} Here's what I found:\n\n${summarise(result.data)}`;
  } else if (result.status === "needs_approval") {
    reply = `I need your OK first. ${result.message}`;
  } else {
    reply = `I couldn't get that. ${result.message}`;
  }

  if (trigger === "schedule" && has("notify_owner")) {
    const sent = await notifyOwner({ agentId: agent.id, kind: "agent_message", text: `${agent.emoji} ${agent.name}: ${reply}` });
    trace.push({ tool: "notify_owner", input: { message: reply }, output: sent });
  }
  return { reply, trace };
}

// ---------- Entry point ----------

export async function runAgent(agentId: string, userText: string, trigger: "chat" | "schedule" = "chat"): Promise<RunResult> {
  const agent = db.select().from(schema.agents).where(eq(schema.agents.id, agentId)).get();
  if (!agent) throw new Error("Agent not found");
  if (agent.status === "paused") throw new Error("This agent is paused. Resume it in Settings.");

  const now = Date.now();
  db.insert(schema.messages).values({ id: `msg_${nanoid(12)}`, agentId, role: "user", content: userText, trigger, createdAt: now }).run();

  let out: { reply: string; trace: ToolTraceItem[] };
  try {
    out = agent.model.startsWith("demo:") ? await runDemoBrain(agent, userText, trigger) : await runWithModel(agent);
  } catch (e) {
    out = { reply: `⚠️ The agent hit an error: ${e instanceof Error ? e.message : String(e)}`, trace: [] };
  }

  const messageId = `msg_${nanoid(12)}`;
  db.insert(schema.messages).values({ id: messageId, agentId, role: "assistant", content: out.reply, trigger, trace: out.trace, createdAt: Date.now() }).run();
  return { ...out, messageId };
}

export function chatHistory(agentId: string) {
  return db.select().from(schema.messages).where(eq(schema.messages.agentId, agentId)).orderBy(asc(schema.messages.createdAt)).all();
}
