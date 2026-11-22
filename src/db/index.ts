import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { BUILT_IN_SERVICES } from "@/lib/demo-data";

// Zero-setup SQLite for development. Tables are created on first use.
// For production, point Drizzle at Postgres (see README).

const DDL = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '🤖', description TEXT NOT NULL DEFAULT '',
  template TEXT NOT NULL DEFAULT 'custom', instructions TEXT NOT NULL, model TEXT NOT NULL, tools TEXT NOT NULL,
  wallet_mode TEXT NOT NULL DEFAULT 'simulated', wallet_address TEXT, sim_balance_micro INTEGER NOT NULL DEFAULT 0,
  per_payment_cap_micro INTEGER NOT NULL, daily_budget_micro INTEGER NOT NULL, approval_threshold_micro INTEGER NOT NULL,
  allowed_domains TEXT NOT NULL, schedule TEXT NOT NULL DEFAULT 'off', schedule_prompt TEXT NOT NULL DEFAULT '',
  last_scheduled_run_at INTEGER, status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'chat', trace TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_agent ON messages(agent_id, created_at);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, url TEXT NOT NULL, domain TEXT NOT NULL, amount_micro INTEGER NOT NULL,
  pay_to TEXT, network TEXT, mode TEXT NOT NULL, status TEXT NOT NULL, reason TEXT, tx_hash TEXT, approval_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_agent ON payments(agent_id, created_at);
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, url TEXT NOT NULL, domain TEXT NOT NULL, amount_micro INTEGER NOT NULL,
  status TEXT NOT NULL, created_at INTEGER NOT NULL, decided_at INTEGER
);
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'data', price_hint_micro INTEGER, params TEXT NOT NULL DEFAULT '',
  built_in INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, agent_id TEXT, kind TEXT NOT NULL, text TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
`;

function open() {
  const file = process.env.OJA_DB_PATH ?? path.join(process.cwd(), "data", "oja.db");
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(DDL);
  const seed = sqlite.prepare(
    `INSERT OR IGNORE INTO services (id, name, description, url, category, price_hint_micro, params, built_in, created_at)
     VALUES (@id, @name, @description, @url, @category, @priceMicro, @params, 1, @createdAt)`,
  );
  for (const s of BUILT_IN_SERVICES) {
    seed.run({ id: s.id, name: s.name, description: s.description, url: `oja-demo://${s.path}`, category: s.category, priceMicro: s.priceMicro, params: s.params, createdAt: Date.now() });
  }
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { __oja?: ReturnType<typeof open> };
export const conn = g.__oja ?? (g.__oja = open());
export const db = conn.db;
export const sqlite = conn.sqlite;
export { schema };
