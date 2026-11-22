import type { PaymentStatus } from "@/db/schema";

export function StatusPill({ status }: { status: PaymentStatus | string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: "Paid", cls: "bg-leaf-soft text-leaf" },
    reserved: { label: "In progress", cls: "bg-dye-soft text-dye" },
    blocked: { label: "Blocked", cls: "bg-clay-soft text-clay" },
    pending_approval: { label: "Needs approval", cls: "bg-gold-soft text-gold" },
    failed: { label: "Failed", cls: "bg-paper-2 text-ink-2" },
  };
  const m = map[status] ?? { label: status, cls: "bg-paper-2 text-ink-2" };
  return <span className={`pill ${m.cls}`}>{m.label}</span>;
}

export function ModePill({ mode }: { mode: "simulated" | "live" }) {
  return mode === "live" ? <span className="pill bg-dye text-white">Live · USDC</span> : <span className="pill bg-paper-2 text-ink-2">Simulated</span>;
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-ink-2">{sub}</div> : null}
    </div>
  );
}

export function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ms).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export function shortUrl(u: string): string {
  return u.replace(/^https?:\/\//, "").replace(/^oja-demo:\/\//, "ọjà/").slice(0, 60);
}
