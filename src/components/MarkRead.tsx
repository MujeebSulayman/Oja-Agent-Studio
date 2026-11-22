"use client";

import { useRouter } from "next/navigation";

export function MarkRead() {
  const router = useRouter();
  return (
    <button
      className="btn-ghost"
      onClick={async () => {
        await fetch("/api/inbox", { method: "POST" });
        router.refresh();
      }}
    >
      Mark all read
    </button>
  );
}
