import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🤖"),
  description: text("description").notNull().default(""),
  template: text("template").notNull().default("custom"),
  instructions: text("instructions").notNull(),
  model: text("model").notNull(), // "provider:modelId", e.g. "openrouter:anthropic/claude-sonnet-5.5" or "demo:scripted"
  tools: text("tools", { mode: "json" }).$type<string[]>().notNull(),
  walletMode: text("wallet_mode").$type<"simulated" | "live">().notNull().default("simulated"),
  walletAddress: text("wallet_address"),
  simBalanceMicro: integer("sim_balance_micro").notNull().default(0),
  perPaymentCapMicro: integer("per_payment_cap_micro").notNull(),
  dailyBudgetMicro: integer("daily_budget_micro").notNull(),
  approvalThresholdMicro: integer("approval_threshold_micro").notNull(),
  allowedDomains: text("allowed_domains", { mode: "json" }).$type<string[]>().notNull(),
  schedule: text("schedule").notNull().default("off"), // "off" | "hourly" | "daily@08:00"
  schedulePrompt: text("schedule_prompt").notNull().default(""),
  lastScheduledRunAt: integer("last_scheduled_run_at"),
  status: text("status").$type<"active" | "paused">().notNull().default("active"),
  createdAt: integer("created_at").notNull(),
});

export type ToolTraceItem = { tool: string; input: unknown; output: unknown };

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  role: text("role").$type<"user" | "assistant">().notNull(),
  content: text("content").notNull(),
  trigger: text("trigger").$type<"chat" | "schedule">().notNull().default("chat"),
  trace: text("trace", { mode: "json" }).$type<ToolTraceItem[]>(),
  createdAt: integer("created_at").notNull(),
});

export type PaymentStatus = "reserved" | "paid" | "blocked" | "pending_approval" | "failed";

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  url: text("url").notNull(),
  domain: text("domain").notNull(),
  amountMicro: integer("amount_micro").notNull(),
  payTo: text("pay_to"),
  network: text("network"),
  mode: text("mode").$type<"simulated" | "live">().notNull(),
  status: text("status").$type<PaymentStatus>().notNull(),
  reason: text("reason"),
  txHash: text("tx_hash"),
  approvalId: text("approval_id"),
  createdAt: integer("created_at").notNull(),
});

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  url: text("url").notNull(),
  domain: text("domain").notNull(),
  amountMicro: integer("amount_micro").notNull(),
  status: text("status").$type<"pending" | "approved" | "rejected" | "used">().notNull(),
  createdAt: integer("created_at").notNull(),
  decidedAt: integer("decided_at"),
});

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  url: text("url").notNull(), // "oja-demo://fx-rates" for built-ins, https://... for external x402 services
  category: text("category").notNull().default("data"),
  priceHintMicro: integer("price_hint_micro"),
  params: text("params").notNull().default(""), // human/LLM readable description of query params
  builtIn: integer("built_in", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  agentId: text("agent_id"),
  kind: text("kind").$type<"approval" | "agent_message" | "info">().notNull(),
  text: text("text").notNull(),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
