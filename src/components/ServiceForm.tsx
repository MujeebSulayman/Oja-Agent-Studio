"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ServiceForm() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", description: "", url: "", category: "data", price: "", params: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, price: f.price ? Number(f.price) : undefined }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(json.error);
    setF({ name: "", description: "", url: "", category: "data", price: "", params: "" });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h2 className="font-semibold">List an x402 service</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Yoruba translation" /></div>
        <div><label className="label">URL</label><input className="input font-mono" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://api.example.com/translate" /></div>
        <div className="sm:col-span-2"><label className="label">Description</label><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What the agent gets for its money" /></div>
        <div><label className="label">Category</label><input className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
        <div><label className="label">Price per call (USD, shown to agents)</label><input className="input" type="number" min={0} step={0.001} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="0.01" /></div>
        <div className="sm:col-span-2"><label className="label">Parameters</label><input className="input" value={f.params} onChange={(e) => setF({ ...f, params: e.target.value })} placeholder="text (required), to (yo|en)" /></div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy}>{busy ? "Adding…" : "Add service"}</button>
        {err ? <span className="text-sm text-clay">{err}</span> : null}
        <span className="ml-auto text-xs text-ink-2">The real price always comes from the service&apos;s 402 response and is checked against each agent&apos;s rules.</span>
      </div>
    </form>
  );
}

export function RemoveService({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      className="mt-3 text-xs text-clay hover:underline"
      onClick={async () => {
        await fetch(`/api/services/${id}`, { method: "DELETE" });
        router.refresh();
      }}
    >
      Remove
    </button>
  );
}
