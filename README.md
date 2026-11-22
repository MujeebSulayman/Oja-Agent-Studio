# Ọjà Agent Studio

**Create AI agents that can pay for what they need, with no code.**

Pick a job, set a budget, and your agent gets its own wallet. It buys data one request at a time using [x402](https://x402.org) and USDC, and it can never spend past the limits you set. Those limits are enforced in code, not in the prompt.

> A prompt is a suggestion. Code is a rule.

## Features

- **No-code builder:** a 6-step wizard (Job → Identity → Brain & tools → Wallet & rules → Schedule → Review), with templates: Research Agent, FX Watcher, Market Price Scout, Business Checker.
- **Any brain:** Claude, GPT or Gemini via the Vercel AI SDK, plus a **Demo brain** that works offline with no API key.
- **A wallet for each agent:**
  - *Simulated:* play money with the same rules and receipts. Good for demos and testing.
  - *Live:* a Coinbase CDP Server Wallet on Base Sepolia or Base. The key stays in Coinbase's secure enclave; neither the AI nor this app ever sees it.
- **Spending rules enforced in code** (`src/lib/guard.ts`):
  - a hard cap per payment
  - a rolling 24-hour budget
  - human approval above a threshold, single-use per request
  - an allowlist of services the agent may pay
  - a balance check
  - all checked atomically, so payments running at the same time can't overspend
- **Approvals page** for payments that need your OK, with optional Telegram alerts.
- **Marketplace:** built-in demo services (naira FX, market food prices, business lookup, fintech funding), plus any x402 service you list.
- **Receipts:** every attempt is logged (paid, blocked or waiting), with BaseScan links for live payments.
- **Schedules:** run agents hourly or daily, with reports sent to your Inbox and Telegram.
- **Demo seller** (`demo-seller/server.ts`): a real x402 API, so live agents can pay real testnet USDC end to end.

## Quick start (no keys needed)

```bash
npm install
npm run dev
```

Open http://localhost:3000, create an agent with the **Demo brain** and a **simulated wallet**, and try:

- “What's the dollar rate today?”
- “Where is rice cheapest?”
- `Check "Adunni Foods"`: this costs $0.05, so with the default rules it lands in **Approvals**

All demo data is fictional sample data and is labelled as such.

## Connect a real AI model

Copy `.env.example` to `.env.local` and add your `OPENROUTER_API_KEY` (https://openrouter.ai/keys). In the agent's **Settings**, switch its brain to any OpenRouter model (Claude, GPT, Gemini, …). Add `TAVILY_API_KEY` to turn on free web search.

## Go live on Base Sepolia (testnet)

1. Create an API key and a wallet secret at https://portal.cdp.coinbase.com, then set `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` and `CDP_WALLET_SECRET` in `.env.local`.
2. Start the demo seller. It needs an address to receive payments, which can be any wallet you control:
   ```bash
   SELLER_PAY_TO=0xYourAddress npm run seller   # http://localhost:4021
   ```
3. Create an agent with a **Live wallet**. On its **Wallet** tab, click **Get testnet USDC**.
4. Chat with it. Built-in services now go to the demo seller and are paid in real testnet USDC. Receipts link to BaseScan.

External x402 services work the same way: list them in **Marketplace**, then add their domain to the agent's allowed services.

## Scheduled agents

```bash
npm run scheduler   # pings /api/cron every minute
```

In production, set `CRON_SECRET` and call `POST /api/cron` with `Authorization: Bearer $CRON_SECRET` every minute (for example, a Vercel cron job).

## How a payment is protected

```
Agent asks for data ─▶ Service answers 402 + price
                     ─▶ onBeforePaymentCreation hook
                        ─▶ spend guard (allowlist · cap · 24h budget · balance · approval), atomic in SQLite
                           ├─ block   → nothing is signed, receipt says why
                           ├─ approve → request waits on the Approvals page (+ Telegram)
                           └─ allow   → CDP wallet signs USDC payment → 200 OK + receipt
```

The CDP SDK's own `spendControls` add a second, independent per-payment cap and 24-hour limit.

## Project layout

```
src/lib/guard.ts          spending rules (pure, unit-tested)
src/lib/ledger.ts         atomic reserve/confirm/fail of payments
src/lib/paid-fetch.ts     x402 payments: simulated and live (CDP)
src/lib/wallet.ts         CDP wallets, balances, faucet
src/lib/agent/run.ts      agent loop (AI SDK) and offline Demo brain
src/lib/agent/tools.ts    tools the agent can use
src/lib/agent/catalog.ts  templates, models and tools shown in the builder
src/components/AgentForm  the no-code wizard (also the Settings editor)
demo-seller/server.ts     real x402 seller for testnet
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app |
| `npm test` | Unit tests (spend guard, schedules) |
| `npm run typecheck` | Generate route types and type-check |
| `npm run seller` | Start the x402 demo seller |
| `npm run scheduler` | Run scheduled agents locally |

## Before production

- Move from SQLite to Postgres (Drizzle supports both; the schema is in `src/db/schema.ts`), because serverless hosts don't keep local files.
- Add sign-in. There are no user accounts yet, so anyone who can open the app controls every agent.
- Replace the sample-data services with real data sources you're licensed to resell.
- Only switch `OJA_NETWORK=base` (real money) after testing on Sepolia with small limits.
# -j-Agent-Studio
