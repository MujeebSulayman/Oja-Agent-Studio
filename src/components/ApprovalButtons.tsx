"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApprovalButtons({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/approvals/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }) });
    if (!res.ok) setErr((await res.json()).error ?? "Failed");
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex items-center gap-2">
      {err ? <span className="text-xs text-clay">{err}</span> : null}
      <button className="btn-ghost" disabled={busy} onClick={() => decide("reject")}>Reject</button>
      <button className="btn-primary" disabled={busy} onClick={() => decide("approve")}>Approve</button>
    </div>
  );
}
