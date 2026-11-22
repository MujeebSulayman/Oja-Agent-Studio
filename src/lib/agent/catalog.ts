// Shared, client-safe definitions for the no-code builder.

export type ToolId = "marketplace" | "paid_api" | "wallet" | "web_search" | "read_webpage" | "notify_owner";

export const TOOL_INFO: Record<ToolId, { label: string; description: string; spendsMoney?: boolean; needs?: string }> = {
  marketplace: { label: "Browse the marketplace", description: "See which paid services exist and what they cost." },
  paid_api: { label: "Pay for data (x402)", description: "Call pay-per-use services and pay in USDC, within your limits.", spendsMoney: true },
  wallet: { label: "Check wallet", description: "Know its balance and how much budget is left today." },
  web_search: { label: "Web search", description: "Search the free web for current information.", needs: "TAVILY_API_KEY" },
  read_webpage: { label: "Read web pages", description: "Open a link and read the page text." },
  notify_owner: { label: "Message you", description: "Send you a message in the inbox (and Telegram, if set up)." },
};

export const MODEL_OPTIONS = [
  { value: "demo:scripted", label: "Demo brain (no API key, for testing)", env: null },
  { value: "openrouter:anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5", env: "OPENROUTER_API_KEY" },
  { value: "openrouter:anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5 (fast, cheap)", env: "OPENROUTER_API_KEY" },
  { value: "openrouter:openai/gpt-5", label: "OpenAI GPT", env: "OPENROUTER_API_KEY" },
  { value: "openrouter:google/gemini-2.5-flash", label: "Google Gemini", env: "OPENROUTER_API_KEY" },
] as const;

export type Template = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  instructions: string;
  tools: ToolId[];
  perPaymentCap: number; // USD
  dailyBudget: number;
  approvalThreshold: number;
  schedule: string;
  schedulePrompt: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "research",
    name: "Research Agent",
    emoji: "🔎",
    tagline: "Answers questions and pays for premium data when it needs to",
    description: "Researches a question using free search first, then buys paid data only when it adds something.",
    instructions:
      "You are a careful research assistant. Use free sources first. Only pay for data when it clearly improves the answer, and say what you paid for. Give short, well-structured answers and say when data is sample or unverified.",
    tools: ["marketplace", "paid_api", "wallet", "web_search", "read_webpage"],
    perPaymentCap: 0.05,
    dailyBudget: 2,
    approvalThreshold: 0.04,
    schedule: "off",
    schedulePrompt: "",
  },
  {
    id: "fx-watcher",
    name: "FX Watcher",
    emoji: "💱",
    tagline: "Checks naira rates on a schedule and messages you",
    description: "Checks naira exchange rates and sends you a short update.",
    instructions:
      "You watch naira exchange rates for the owner. Fetch current rates, compare buy and sell, and send the owner a short, clear update. Flag big moves.",
    tools: ["marketplace", "paid_api", "wallet", "notify_owner"],
    perPaymentCap: 0.02,
    dailyBudget: 0.5,
    approvalThreshold: 0.02,
    schedule: "daily@08:00",
    schedulePrompt: "Check today's naira rates for USD, GBP and EUR and send me a short update.",
  },
  {
    id: "market-scout",
    name: "Market Price Scout",
    emoji: "🧺",
    tagline: "Finds the cheapest market for food staples",
    description: "Compares food prices across markets so a shop or caterer can buy smarter.",
    instructions:
      "You help a small food business buy stock cheaply. Compare prices across markets, name the cheapest market for each item, and estimate savings in naira.",
    tools: ["marketplace", "paid_api", "wallet", "notify_owner"],
    perPaymentCap: 0.05,
    dailyBudget: 1,
    approvalThreshold: 0.05,
    schedule: "off",
    schedulePrompt: "",
  },
  {
    id: "kyb",
    name: "Business Checker",
    emoji: "🏢",
    tagline: "Verifies a business before you trade with it",
    description: "Looks up a business in the registry and reports whether it's active.",
    instructions:
      "You verify businesses before the owner trades with them. Look the business up, report its registration number, type and status, and flag anything that looks wrong. Never guess a registration detail.",
    tools: ["marketplace", "paid_api", "wallet"],
    perPaymentCap: 0.1,
    dailyBudget: 1,
    approvalThreshold: 0.04,
    schedule: "off",
    schedulePrompt: "",
  },
  {
    id: "custom",
    name: "Start from scratch",
    emoji: "✨",
    tagline: "Pick everything yourself",
    description: "",
    instructions: "",
    tools: ["marketplace", "paid_api", "wallet"],
    perPaymentCap: 0.05,
    dailyBudget: 1,
    approvalThreshold: 0.05,
    schedule: "off",
    schedulePrompt: "",
  },
];
