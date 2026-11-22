"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Agent, Message, Payment, ToolTraceItem } from "@/db/schema";
import { TOOL_INFO, type ToolId } from "@/lib/agent/catalog";
import { formatUsd } from "@/lib/money";
import { AgentForm, valuesFromAgent, type EnvStatus } from "./AgentForm";
import { Markdown } from "./Markdown";
import { ModePill, StatusPill, shortUrl, timeAgo } from "./ui";

type Tab = "chat" | "activity" | "wallet" | "settings";

const SUGGESTIONS: Record<string, string[]> = {
  research: ["Top 3 fintech funding rounds in West Africa?", "What's the dollar rate today?", "How much budget do I have left?"],
  "fx-watcher": ["Check the dollar rate", "What are GBP rates now?", "How much have you spent today?"],
  "market-scout": ["Where is rice cheapest?", "Compare tomato prices", "Show all market prices"],
  kyb: ['Check "Adunni Foods"', 'Verify "Eko Bright Solar"', "How much budget is left?"],
  custom: ["What's the dollar rate today?", "Where is rice cheapest?", "Check my wallet"],
};

function TraceView({ trace }: { trace: ToolTraceItem[] }) {
  if (!trace?.length) return null;
  return (
    <details className="mt-2 rounded-lg border border-line bg-paper/60 text-xs">
      <summary className="cursor-pointer px-3 py-1.5 text-ink-2">Used {trace.length} tool{trace.length > 1 ? "s" : ""}: {trace.map((t) => TOOL_INFO[t.tool as ToolId]?.label ?? t.tool).join(" → ")}</summary>
      <div className="space-y-2 border-t border-line p-3">
        {trace.map((t, i) => {
          const out = t.output as { ok?: boolean; paid?: boolean; amount?: string; status?: string; message?: string };
          return (
            <div key={i}>
              <div className="flex items-center gap-2 font-medium">
                <span>{TOOL_INFO[t.tool as ToolId]?.label ?? t.tool}</span>
                {t.tool === "paid_api" ? (
                  out?.ok ? (
                    <span className="pill bg-leaf-soft text-leaf">{out.paid ? `paid ${out.amount}` : "free"}</span>
                  ) : (
                    <span className={`pill ${out?.status === "needs_approval" ? "bg-gold-soft text-gold" : "bg-clay-soft text-clay"}`}>{out?.status === "needs_approval" ? "needs approval" : out?.status ?? "error"}</span>
                  )
                ) : null}
              </div>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2 font-mono text-[11px] text-ink-2">{JSON.stringify({ input: t.input, output: t.output }, null, 2).slice(0, 2500)}</pre>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function localMessage(agentId: string, role: "user" | "assistant", content: string, trace: ToolTraceItem[] | null = null, id?: string): Message {
  const now = Date.now();
  return { id: id ?? `local-${now}-${Math.random().toString(36).slice(2, 7)}`, agentId, role, content, trigger: "chat", trace, createdAt: now };
}

function Chat({ agent, initial }: { agent: Agent; initial: Message[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);

  async function send(msg: string) {
    const content = msg.trim();
    if (!content || busy) return;
    setText("");
    setBusy(true);
    setMessages((m) => [...m, localMessage(agent.id, "user", content)]);
    try {
      const res = await fetch(`/api/agents/${agent.id}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: content }) });
      const json = await res.json();
      const reply = res.ok ? json.reply : `⚠️ ${json.error}`;
      setMessages((m) => [...m, localMessage(agent.id, "assistant", reply, json.trace ?? null, json.messageId)]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex h-[65vh] min-h-[420px] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <div className="text-4xl">{agent.emoji}</div>
              <p className="mt-2 font-medium">Say hello to {agent.name}</p>
              <p className="text-sm text-ink-2">Ask something that needs data. Watch it pay, within your rules.</p>
            </div>
          </div>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-leaf text-white" : "border border-line bg-white"}`}>
              {m.trigger === "schedule" ? <div className={`eyebrow mb-1 ${m.role === "user" ? "text-white/70" : ""}`}>⏰ Scheduled run</div> : null}
              {m.role === "assistant" ? <Markdown text={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
              {m.role === "assistant" && m.trace ? <TraceView trace={m.trace} /> : null}
            </div>
          </div>
        ))}
        {busy ? (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-line bg-white px-4 py-2.5 text-sm text-ink-2">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-2" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-2 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-2 [animation-delay:240ms]" />
              </span>{" "}
              working…
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <div className="border-t border-line p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {(SUGGESTIONS[agent.template] ?? SUGGESTIONS.custom).map((s) => (
            <button key={s} type="button" disabled={busy || agent.status === "paused"} onClick={() => send(s)} className="rounded-full border border-line bg-paper px-3 py-1 text-xs text-ink-2 hover:border-leaf hover:text-leaf disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={agent.status === "paused" ? "This agent is paused" : `Message ${agent.name}…`} disabled={busy || agent.status === "paused"} />
          <button className="btn-primary" disabled={busy || !text.trim() || agent.status === "paused"}>Send</button>
        </form>
      </div>
    </div>
  );
}

function Activity({ payments }: { payments: Payment[] }) {
  if (!payments.length) return <div className="card p-6 text-sm text-ink-2">No payments yet.</div>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-xs text-ink-2">
          <tr><th className="px-4 py-2 font-medium">When</th><th className="px-4 py-2 font-medium">Service</th><th className="px-4 py-2 text-right font-medium">Amount</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Details</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap px-4 py-2 text-ink-2">{timeAgo(p.createdAt)}</td>
              <td className="px-4 py-2 font-mono text-xs">{shortUrl(p.url)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatUsd(p.amountMicro)}</td>
              <td className="px-4 py-2"><StatusPill status={p.status} /></td>
              <td className="px-4 py-2 text-xs text-ink-2">
                {p.txHash ? <a className="text-dye underline" target="_blank" rel="noreferrer" href={`https://${p.network === "eip155:8453" ? "" : "sepolia."}basescan.org/tx/${p.txHash}`}>View on BaseScan</a> : p.reason ?? (p.mode === "simulated" ? "Simulated" : "")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Wallet({ agent, spentMicro, env }: { agent: Agent; spentMicro: number; env: EnvStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [liveBalance, setLiveBalance] = useState<number | null | undefined>(undefined);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch(`/api/agents/${agent.id}/wallet`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (action === "balance") setLiveBalance(json.balanceMicro);
      if (action === "faucet") setMsg("Testnet USDC requested. It usually arrives in under a minute.");
      if (action === "topup") setMsg("Topped up.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (agent.walletMode !== "live" || !agent.walletAddress) return;
    let cancelled = false;
    fetch(`/api/agents/${agent.id}/wallet`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "balance" }) })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setLiveBalance(j.balanceMicro ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [agent.id, agent.walletMode, agent.walletAddress]);

  const left = Math.max(0, agent.dailyBudgetMicro - spentMicro);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div className="eyebrow">Balance</div>
          <ModePill mode={agent.walletMode} />
        </div>
        <div className="mt-2 text-4xl font-semibold tabular-nums">
          {agent.walletMode === "simulated" ? formatUsd(agent.simBalanceMicro) : liveBalance == null ? "—" : formatUsd(liveBalance)}
          <span className="ml-2 text-base font-normal text-ink-2">USDC</span>
        </div>
        {agent.walletMode === "simulated" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {[1, 5, 20].map((n) => (
              <button key={n} className="btn-ghost" disabled={Boolean(busy)} onClick={() => act("topup", { amount: n })}>+ ${n} play money</button>
            ))}
          </div>
        ) : agent.walletAddress ? (
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <div className="eyebrow">Address ({env.network})</div>
              <code className="mt-1 block break-all rounded-lg bg-paper-2 p-2 text-xs">{agent.walletAddress}</code>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" disabled={Boolean(busy)} onClick={() => act("balance")}>{busy === "balance" ? "Checking…" : "Refresh balance"}</button>
              {env.network.includes("Sepolia") ? <button className="btn-ghost" disabled={Boolean(busy)} onClick={() => act("faucet")}>{busy === "faucet" ? "Requesting…" : "Get testnet USDC"}</button> : null}
            </div>
            <p className="hint">The private key lives in Coinbase&apos;s secure enclave. Neither the AI nor this app can see it.</p>
          </div>
        ) : (
          <div className="mt-4">
            <button className="btn-primary" disabled={Boolean(busy) || !env.liveWallets} onClick={() => act("provision")}>{busy === "provision" ? "Creating…" : "Create live wallet"}</button>
            {!env.liveWallets ? <p className="hint text-gold">Add CDP_API_KEY_ID, CDP_API_KEY_SECRET and CDP_WALLET_SECRET to .env.local.</p> : null}
          </div>
        )}
        {msg ? <p className="mt-3 text-sm text-ink-2">{msg}</p> : null}
      </div>
      <div className="card p-5">
        <div className="eyebrow">Today&apos;s budget (rolling 24h)</div>
        <div className="mt-2 text-4xl font-semibold tabular-nums">{formatUsd(left)} <span className="text-base font-normal text-ink-2">left of {formatUsd(agent.dailyBudgetMicro)}</span></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-2">
          <div className="h-full rounded-full bg-leaf" style={{ width: `${Math.min(100, (spentMicro / agent.dailyBudgetMicro) * 100)}%` }} />
        </div>
        <ul className="mt-4 space-y-1.5 text-sm">
          <li className="flex justify-between"><span className="text-ink-2">Max per payment</span><b>{formatUsd(agent.perPaymentCapMicro)}</b></li>
          <li className="flex justify-between"><span className="text-ink-2">Asks you above</span><b>{formatUsd(agent.approvalThresholdMicro)}</b></li>
          <li className="flex justify-between gap-4"><span className="text-ink-2">May pay</span><span className="text-right font-mono text-xs">{agent.allowedDomains.join(", ") || "nobody"}</span></li>
        </ul>
      </div>
    </div>
  );
}

function Settings({ agent, env }: { agent: Agent; env: EnvStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    await fetch(`/api/agents/${agent.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: agent.status === "active" ? "paused" : "active" }) });
    setBusy(false);
    router.refresh();
  }
  async function remove() {
    if (!confirm(`Delete ${agent.name}? Its chat history goes too; payment receipts are kept.`)) return;
    setBusy(true);
    await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  }
  return (
    <div className="space-y-6">
      <AgentForm env={env} agentId={agent.id} initial={valuesFromAgent(agent)} />
      <section className="card flex flex-wrap items-center gap-3 p-5">
        <div className="mr-auto">
          <div className="font-semibold">{agent.status === "active" ? "Pause this agent" : "Resume this agent"}</div>
          <div className="text-sm text-ink-2">A paused agent can&apos;t chat, run on schedule, or spend.</div>
        </div>
        <button className="btn-ghost" disabled={busy} onClick={toggle}>{agent.status === "active" ? "Pause" : "Resume"}</button>
        <button className="btn-danger" disabled={busy} onClick={remove}>Delete</button>
      </section>
    </div>
  );
}

export function AgentWorkspace(props: { agent: Agent; messages: Message[]; payments: Payment[]; spentMicro: number; env: EnvStatus; warning?: string }) {
  const { agent } = props;
  const [tab, setTab] = useState<Tab>("chat");
  const tabs: Array<[Tab, string]> = [["chat", "Chat"], ["activity", `Activity (${props.payments.length})`], ["wallet", "Wallet"], ["settings", "Settings"]];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-card text-3xl shadow-sm ring-1 ring-line">{agent.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
            <ModePill mode={agent.walletMode} />
            {agent.status === "paused" ? <span className="pill bg-paper-2 text-ink-2">Paused</span> : null}
          </div>
          <p className="text-sm text-ink-2">{agent.description || agent.instructions.slice(0, 140)}</p>
        </div>
        <Link href="/" className="text-sm text-ink-2 hover:text-ink">← All agents</Link>
      </div>
      {props.warning ? <div className="rounded-xl border border-gold/30 bg-gold-soft p-3 text-sm text-gold">{props.warning}</div> : null}
      <div className="flex gap-1 border-b border-line">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === k ? "border-leaf font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}>{label}</button>
        ))}
      </div>
      {tab === "chat" ? <Chat agent={agent} initial={props.messages} /> : null}
      {tab === "activity" ? <Activity payments={props.payments} /> : null}
      {tab === "wallet" ? <Wallet agent={agent} spentMicro={props.spentMicro} env={props.env} /> : null}
      {tab === "settings" ? <Settings agent={agent} env={props.env} /> : null}
    </div>
  );
}
