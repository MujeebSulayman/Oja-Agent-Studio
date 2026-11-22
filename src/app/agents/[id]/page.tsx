import { notFound } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { chatHistory } from "@/lib/agent/run";
import { recentPayments, spentLast24h } from "@/lib/ledger";
import { envStatus } from "@/lib/env";
import { AgentWorkspace } from "@/components/AgentWorkspace";

export default async function AgentPage(props: PageProps<"/agents/[id]">) {
  await connection();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const agent = db.select().from(schema.agents).where(eq(schema.agents.id, id)).get();
  if (!agent) notFound();
  return (
    <AgentWorkspace
      key={agent.id}
      agent={agent}
      messages={chatHistory(agent.id)}
      payments={recentPayments(agent.id, 100)}
      spentMicro={spentLast24h(agent.id)}
      env={envStatus()}
      warning={typeof sp.warning === "string" ? sp.warning : undefined}
    />
  );
}
