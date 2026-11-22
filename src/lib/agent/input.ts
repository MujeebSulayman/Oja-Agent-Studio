import { z } from "zod";
import { toMicro } from "@/lib/money";
import { TOOL_INFO, type ToolId } from "./catalog";

const toolIds = Object.keys(TOOL_INFO) as [ToolId, ...ToolId[]];

export const agentInputSchema = z
  .object({
    name: z.string().trim().min(2, "Give your agent a name").max(60),
    emoji: z.string().trim().min(1).max(8).default("🤖"),
    description: z.string().trim().max(300).default(""),
    template: z.string().default("custom"),
    instructions: z.string().trim().min(10, "Tell the agent what its job is (at least a sentence)").max(4000),
    model: z.string().regex(/^(demo|openrouter|anthropic|openai|google):.+$/, "Pick a model"),
    tools: z.array(z.enum(toolIds)).default([]),
    walletMode: z.enum(["simulated", "live"]).default("simulated"),
    startingBalance: z.number().min(0).max(1000).default(5), // simulated USDC
    perPaymentCap: z.number().positive("Per-payment cap must be above $0").max(100),
    dailyBudget: z.number().positive("Daily budget must be above $0").max(1000),
    approvalThreshold: z.number().min(0).max(100),
    allowedDomains: z.array(z.string().trim().toLowerCase().min(1)).default(["oja-demo", "localhost"]),
    schedule: z.string().regex(/^(off|hourly|daily@\d{2}:\d{2})$/).default("off"),
    schedulePrompt: z.string().trim().max(1000).default(""),
  })
  .refine((v) => v.perPaymentCap <= v.dailyBudget, { message: "Per-payment cap can't be bigger than the daily budget", path: ["perPaymentCap"] })
  .refine((v) => v.schedule === "off" || v.schedulePrompt.length > 0, { message: "Tell the agent what to do on each scheduled run", path: ["schedulePrompt"] });

export type AgentInput = z.infer<typeof agentInputSchema>;

export function toAgentColumns(v: AgentInput) {
  return {
    name: v.name,
    emoji: v.emoji,
    description: v.description,
    template: v.template,
    instructions: v.instructions,
    model: v.model,
    tools: v.tools,
    walletMode: v.walletMode,
    perPaymentCapMicro: toMicro(v.perPaymentCap),
    dailyBudgetMicro: toMicro(v.dailyBudget),
    approvalThresholdMicro: toMicro(v.approvalThreshold),
    allowedDomains: Array.from(new Set(v.allowedDomains)),
    schedule: v.schedule,
    schedulePrompt: v.schedulePrompt,
  };
}

export function firstError(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Invalid input";
}
