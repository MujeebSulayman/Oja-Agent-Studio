"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MODEL_OPTIONS, TEMPLATES, TOOL_INFO, type ToolId } from "@/lib/agent/catalog";

export type EnvStatus = {
  keys: Record<string, boolean>; // which API keys are set
  liveWallets: boolean;
  network: string;
};

export type FormValues = {
  template: string;
  name: string;
  emoji: string;
  description: string;
  instructions: string;
  model: string;
  tools: ToolId[];
  walletMode: "simulated" | "live";
  startingBalance: number;
  perPaymentCap: number;
  dailyBudget: number;
  approvalThreshold: number;
  allowedDomains: string;
  scheduleKind: "off" | "hourly" | "daily";
  scheduleTime: string;
  schedulePrompt: string;
};

const EMOJIS = ["🤖", "🔎", "💱", "🧺", "🏢", "📈", "🛒", "🧾", "🌍", "⚡", "🦉", "🐢"];

const STEPS = ["Job", "Identity", "Brain & tools", "Wallet & rules", "Schedule", "Review"] as const;

function fromTemplate(id: string): FormValues {
  const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[TEMPLATES.length - 1];
  const [kind, time] = t.schedule.startsWith("daily@") ? (["daily", t.schedule.slice(6)] as const) : ([t.schedule as "off" | "hourly", "08:00"] as const);
  return {
    template: t.id,
    name: t.id === "custom" ? "" : t.name,
    emoji: t.emoji,
    description: t.description,
    instructions: t.instructions,
    model: "demo:scripted",
    tools: [...t.tools],
    walletMode: "simulated",
    startingBalance: 5,
    perPaymentCap: t.perPaymentCap,
    dailyBudget: t.dailyBudget,
    approvalThreshold: t.approvalThreshold,
    allowedDomains: "oja-demo, localhost",
    scheduleKind: kind,
    scheduleTime: time,
    schedulePrompt: t.schedulePrompt,
  };
}

function toPayload(v: FormValues) {
  return {
    template: v.template,
    name: v.name,
    emoji: v.emoji,
    description: v.description,
    instructions: v.instructions,
    model: v.model,
    tools: v.tools,
    walletMode: v.walletMode,
    startingBalance: Number(v.startingBalance),
    perPaymentCap: Number(v.perPaymentCap),
    dailyBudget: Number(v.dailyBudget),
    approvalThreshold: Number(v.approvalThreshold),
    allowedDomains: v.allowedDomains.split(/[,\s]+/).map((d) => d.trim()).filter(Boolean),
    schedule: v.scheduleKind === "off" ? "off" : v.scheduleKind === "hourly" ? "hourly" : `daily@${v.scheduleTime}`,
    schedulePrompt: v.scheduleKind === "off" ? "" : v.schedulePrompt,
  };
}

function usd(n: number) {
  return `$${Number(n || 0).toFixed(2)}`;
}

export function AgentForm({ env, initial, agentId }: { env: EnvStatus; initial?: FormValues; agentId?: string }) {
  const router = useRouter();
  const editing = Boolean(agentId);
  const [step, setStep] = useState(editing ? 1 : 0);
  const [v, setV] = useState<FormValues>(initial ?? fromTemplate("research"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => {
    setSaved(false);
    setV((prev) => ({ ...prev, [k]: val }));
  };

  const stepError = useMemo(() => {
    if (step === 1 && v.name.trim().length < 2) return "Give your agent a name.";
    if (step === 1 && v.instructions.trim().length < 10) return "Describe the agent's job in at least a sentence.";
    if (step === 3) {
      if (!(v.perPaymentCap > 0)) return "Per-payment cap must be above $0.";
      if (!(v.dailyBudget > 0)) return "Daily budget must be above $0.";
      if (Number(v.perPaymentCap) > Number(v.dailyBudget)) return "Per-payment cap can't be bigger than the daily budget.";
      if (v.walletMode === "live" && !env.liveWallets) return "Live wallets need CDP API keys in .env.local.";
    }
    if (step === 4 && v.scheduleKind !== "off" && v.schedulePrompt.trim().length === 0) return "Say what the agent should do on each run.";
    return null;
  }, [step, v, env.liveWallets]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(editing ? `/api/agents/${agentId}` : "/api/agents", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toPayload(v)),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      if (editing) {
        setSaved(true);
        router.refresh();
      } else {
        router.push(`/agents/${json.id}${json.warning ? `?warning=${encodeURIComponent(json.warning)}` : ""}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const modelInfo = MODEL_OPTIONS.find((m) => m.value === v.model);
  const modelMissingKey = modelInfo?.env ? !env.keys[modelInfo.env] : false;
  const domains = toPayload(v).allowedDomains;

  const sections: Record<number, React.ReactNode> = {
    0: (
      <div className="grid gap-3 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setV(fromTemplate(t.id));
              setStep(1);
            }}
            className={`card flex items-start gap-3 p-4 text-left transition hover:border-leaf hover:shadow-md ${v.template === t.id ? "border-leaf ring-2 ring-leaf/15" : ""}`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-paper-2 text-xl">{t.emoji}</span>
            <span>
              <span className="block font-semibold">{t.name}</span>
              <span className="mt-0.5 block text-sm text-ink-2">{t.tagline}</span>
            </span>
          </button>
        ))}
      </div>
    ),
    1: (
      <div className="space-y-5">
        <div>
          <span className="label">Icon</span>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => set("emoji", e)} className={`grid h-10 w-10 place-items-center rounded-xl border text-xl ${v.emoji === e ? "border-leaf bg-leaf-soft" : "border-line bg-white hover:bg-paper-2"}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="input" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Mama Nkechi’s Price Scout" maxLength={60} />
        </div>
        <div>
          <label className="label" htmlFor="desc">Short description <span className="font-normal text-ink-2">(optional)</span></label>
          <input id="desc" className="input" value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="What it does, in one line" maxLength={300} />
        </div>
        <div>
          <label className="label" htmlFor="instructions">Its job, in plain words</label>
          <textarea id="instructions" className="input min-h-36" value={v.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="You help my catering business buy stock cheaply. Compare prices across markets and tell me where to buy each item." />
          <p className="hint">Write it like you’d brief a new assistant: who they work for, what to do, what to avoid.</p>
        </div>
      </div>
    ),
    2: (
      <div className="space-y-6">
        <div>
          <span className="label">Brain (AI model)</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODEL_OPTIONS.map((m) => {
              const missing = m.env ? !env.keys[m.env] : false;
              return (
                <button key={m.value} type="button" onClick={() => set("model", m.value)} className={`rounded-xl border p-3 text-left text-sm ${v.model === m.value ? "border-leaf bg-leaf-soft" : "border-line bg-white hover:bg-paper-2"}`}>
                  <span className="block font-medium">{m.label}</span>
                  <span className={`block text-xs ${missing ? "text-gold" : "text-ink-2"}`}>{m.env ? (missing ? `Add ${m.env} to .env.local` : "Ready") : "Works offline · understands a few demo requests"}</span>
                </button>
              );
            })}
          </div>
          {modelMissingKey ? <p className="hint text-gold">This model needs {modelInfo?.env}. You can still create the agent and add the key later.</p> : null}
          <details className="mt-2 text-xs text-ink-2">
            <summary className="cursor-pointer">Use a different model ID</summary>
            <input className="input mt-2 font-mono" value={v.model} onChange={(e) => set("model", e.target.value)} placeholder="openrouter:vendor/model-id" />
            <p className="hint">Format: openrouter:vendor/model, e.g. openrouter:anthropic/claude-sonnet-5.5</p>
          </details>
        </div>
        <div>
          <span className="label">What it can do</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(TOOL_INFO) as ToolId[]).map((id) => {
              const t = TOOL_INFO[id];
              const on = v.tools.includes(id);
              const missing = t.needs ? !env.keys[t.needs] : false;
              return (
                <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${on ? "border-leaf bg-leaf-soft/60" : "border-line bg-white"}`}>
                  <input type="checkbox" className="mt-1 accent-[var(--leaf)]" checked={on} onChange={() => set("tools", on ? v.tools.filter((x) => x !== id) : [...v.tools, id])} />
                  <span>
                    <span className="flex items-center gap-2 font-medium">
                      {t.label}
                      {t.spendsMoney ? <span className="pill bg-gold-soft text-gold">spends</span> : null}
                    </span>
                    <span className="block text-xs text-ink-2">{t.description}</span>
                    {missing ? <span className="block text-xs text-gold">Needs {t.needs}</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    ),
    3: (
      <div className="space-y-6">
        <div>
          <span className="label">Wallet</span>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => set("walletMode", "simulated")} className={`rounded-xl border p-3 text-left text-sm ${v.walletMode === "simulated" ? "border-leaf bg-leaf-soft" : "border-line bg-white"}`}>
              <span className="block font-medium">Simulated wallet</span>
              <span className="block text-xs text-ink-2">Play money. Same rules and receipts, no blockchain. Best for trying things out.</span>
            </button>
            <button type="button" onClick={() => set("walletMode", "live")} className={`rounded-xl border p-3 text-left text-sm ${v.walletMode === "live" ? "border-leaf bg-leaf-soft" : "border-line bg-white"}`}>
              <span className="block font-medium">Live wallet · USDC on {env.network}</span>
              <span className={`block text-xs ${env.liveWallets ? "text-ink-2" : "text-gold"}`}>{env.liveWallets ? "A Coinbase CDP wallet. The key stays in a secure enclave, never with the AI." : "Needs CDP API keys in .env.local"}</span>
            </button>
          </div>
        </div>
        {v.walletMode === "simulated" && !editing ? (
          <div className="max-w-xs">
            <label className="label" htmlFor="bal">Starting balance (play USDC)</label>
            <input id="bal" type="number" min={0} step={1} className="input" value={v.startingBalance} onChange={(e) => set("startingBalance", Number(e.target.value))} />
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="cap">Max per payment</label>
            <input id="cap" type="number" min={0.001} step={0.01} className="input" value={v.perPaymentCap} onChange={(e) => set("perPaymentCap", Number(e.target.value))} />
            <p className="hint">Anything pricier is always blocked.</p>
          </div>
          <div>
            <label className="label" htmlFor="daily">Daily budget</label>
            <input id="daily" type="number" min={0.01} step={0.5} className="input" value={v.dailyBudget} onChange={(e) => set("dailyBudget", Number(e.target.value))} />
            <p className="hint">Total it can spend in any 24 hours.</p>
          </div>
          <div>
            <label className="label" htmlFor="appr">Ask me above</label>
            <input id="appr" type="number" min={0} step={0.01} className="input" value={v.approvalThreshold} onChange={(e) => set("approvalThreshold", Number(e.target.value))} />
            <p className="hint">Payments above this wait for your OK.</p>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="domains">Services it may pay</label>
          <input id="domains" className="input font-mono" value={v.allowedDomains} onChange={(e) => set("allowedDomains", e.target.value)} />
          <p className="hint">Comma-separated domains. <code>oja-demo</code> = built-in demo services, <code>localhost</code> = the local demo seller, <code>*.example.com</code> = a domain and its subdomains.</p>
        </div>
      </div>
    ),
    4: (
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["off", "Only when I chat"],
              ["hourly", "Every hour"],
              ["daily", "Every day"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" onClick={() => set("scheduleKind", k)} className={`rounded-xl border p-3 text-left text-sm font-medium ${v.scheduleKind === k ? "border-leaf bg-leaf-soft" : "border-line bg-white"}`}>
              {label}
            </button>
          ))}
        </div>
        {v.scheduleKind === "daily" ? (
          <div className="max-w-xs">
            <label className="label" htmlFor="time">Time (Lagos)</label>
            <input id="time" type="time" className="input" value={v.scheduleTime} onChange={(e) => set("scheduleTime", e.target.value)} />
          </div>
        ) : null}
        {v.scheduleKind !== "off" ? (
          <div>
            <label className="label" htmlFor="sp">What should it do each time?</label>
            <textarea id="sp" className="input min-h-24" value={v.schedulePrompt} onChange={(e) => set("schedulePrompt", e.target.value)} placeholder="Check today's dollar rate and send me a short update." />
            {!v.tools.includes("notify_owner") ? <p className="hint text-gold">Tip: turn on “Message you” in Brain & tools so it can send you the result.</p> : null}
          </div>
        ) : null}
      </div>
    ),
    5: (
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-paper-2 text-2xl">{v.emoji}</span>
          <div>
            <div className="text-lg font-semibold">{v.name || "Unnamed agent"}</div>
            <div className="text-ink-2">{v.description}</div>
          </div>
        </div>
        <div className="rounded-xl border border-leaf/30 bg-leaf-soft/50 p-4">
          <div className="eyebrow text-leaf">Its spending rules, enforced in code</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Never more than <b>{usd(v.perPaymentCap)}</b> in one payment.</li>
            <li>Never more than <b>{usd(v.dailyBudget)}</b> in any 24 hours.</li>
            <li>Asks you first before paying more than <b>{usd(v.approvalThreshold)}</b>.</li>
            <li>May only pay: {domains.length ? domains.map((d) => <code key={d} className="mx-0.5 rounded bg-white px-1">{d}</code>) : <b>nobody</b>}</li>
            <li>{v.walletMode === "live" ? `Real USDC on ${env.network}.` : `Simulated wallet${editing ? "" : ` with ${usd(v.startingBalance)} play money`}.`}</li>
          </ul>
        </div>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div className="card p-3"><dt className="eyebrow">Brain</dt><dd className="mt-1">{modelInfo?.label ?? v.model}</dd></div>
          <div className="card p-3"><dt className="eyebrow">Runs</dt><dd className="mt-1">{v.scheduleKind === "off" ? "When you chat" : v.scheduleKind === "hourly" ? "Every hour" : `Daily at ${v.scheduleTime}`}</dd></div>
          <div className="card p-3 sm:col-span-2"><dt className="eyebrow">Can</dt><dd className="mt-1">{v.tools.map((t) => TOOL_INFO[t].label).join(" · ") || "Nothing yet"}</dd></div>
        </dl>
      </div>
    ),
  };

  if (editing) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <section key={i} className="card p-5">
            <h3 className="mb-4 font-semibold">{STEPS[i]}</h3>
            {sections[i]}
          </section>
        ))}
        <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-2xl border border-line bg-card/95 p-3 shadow-lg backdrop-blur">
          {error ? <span className="mr-auto text-sm text-clay">{error}</span> : saved ? <span className="mr-auto text-sm text-leaf">Saved ✓</span> : null}
          <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      <ol className="hidden space-y-1 lg:block">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" disabled={i > step} onClick={() => setStep(i)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${i === step ? "bg-card font-semibold shadow-sm" : i < step ? "text-ink hover:bg-paper-2" : "text-ink-2/60"}`}>
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${i < step ? "bg-leaf text-white" : i === step ? "bg-ink text-white" : "bg-paper-2"}`}>{i < step ? "✓" : i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      <div className="card p-5 sm:p-6">
        <div className="eyebrow">Step {step + 1} of {STEPS.length}</div>
        <h2 className="mb-5 mt-1 text-xl font-semibold">
          {["What job should your agent do?", "Name it and describe its job", "Choose its brain and abilities", "Give it a wallet and spending rules", "When should it work?", "Check and create"][step]}
        </h2>
        {sections[step]}
        {step > 0 ? (
          <div className="mt-8 flex items-center gap-3 border-t border-line pt-4">
            <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>Back</button>
            {error ?? stepError ? <span className="text-sm text-clay">{error ?? stepError}</span> : null}
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn-primary ml-auto" disabled={Boolean(stepError)} onClick={() => setStep(step + 1)}>Continue</button>
            ) : (
              <button type="button" className="btn-primary ml-auto" disabled={busy} onClick={submit}>{busy ? "Creating…" : `Create ${v.name || "agent"}`}</button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function valuesFromAgent(a: {
  template: string; name: string; emoji: string; description: string; instructions: string; model: string; tools: string[];
  walletMode: "simulated" | "live"; perPaymentCapMicro: number; dailyBudgetMicro: number; approvalThresholdMicro: number;
  allowedDomains: string[]; schedule: string; schedulePrompt: string;
}): FormValues {
  const daily = a.schedule.match(/^daily@(\d{2}:\d{2})$/);
  return {
    template: a.template,
    name: a.name,
    emoji: a.emoji,
    description: a.description,
    instructions: a.instructions,
    model: a.model,
    tools: a.tools as ToolId[],
    walletMode: a.walletMode,
    startingBalance: 0,
    perPaymentCap: a.perPaymentCapMicro / 1e6,
    dailyBudget: a.dailyBudgetMicro / 1e6,
    approvalThreshold: a.approvalThresholdMicro / 1e6,
    allowedDomains: a.allowedDomains.join(", "),
    scheduleKind: daily ? "daily" : a.schedule === "hourly" ? "hourly" : "off",
    scheduleTime: daily?.[1] ?? "08:00",
    schedulePrompt: a.schedulePrompt,
  };
}
