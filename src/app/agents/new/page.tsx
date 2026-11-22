import { connection } from "next/server";
import { AgentForm } from "@/components/AgentForm";
import { envStatus } from "@/lib/env";

export default async function NewAgentPage() {
  await connection();
  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">New agent</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Create an agent, no code</h1>
        <p className="mt-1 text-ink-2">Six short steps. You can change anything later.</p>
      </div>
      <AgentForm env={envStatus()} />
    </div>
  );
}
