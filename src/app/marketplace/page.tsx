import { connection } from "next/server";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatUsd } from "@/lib/money";
import { ServiceForm, RemoveService } from "@/components/ServiceForm";

export default async function MarketplacePage() {
  await connection();
  const services = db.select().from(schema.services).orderBy(asc(schema.services.createdAt)).all();
  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">What agents can buy</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Marketplace</h1>
        <p className="mt-1 max-w-2xl text-ink-2">
          Pay-per-use services your agents can discover and pay with x402. Built-in demo services sell sample data. Add any x402 endpoint, then allow its domain in an agent&apos;s settings.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {services.map((s) => (
          <div key={s.id} className="card p-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{s.name}</h3>
                  <span className="pill bg-dye-soft text-dye">{s.category}</span>
                  {s.builtIn ? <span className="pill bg-paper-2 text-ink-2">demo · sample data</span> : null}
                </div>
                <p className="mt-1 text-sm text-ink-2">{s.description}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold tabular-nums">{s.priceHintMicro != null ? formatUsd(s.priceHintMicro) : "—"}</div>
                <div className="text-xs text-ink-2">per call</div>
              </div>
            </div>
            <code className="mt-3 block truncate rounded-lg bg-paper-2 px-2 py-1 text-xs">{s.url}</code>
            {s.params ? <p className="mt-2 text-xs text-ink-2">Parameters: {s.params}</p> : null}
            {!s.builtIn ? <RemoveService id={s.id} /> : null}
          </div>
        ))}
      </div>
      <ServiceForm />
    </div>
  );
}
