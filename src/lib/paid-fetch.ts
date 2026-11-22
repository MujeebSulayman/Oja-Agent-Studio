import type { Agent } from "@/db/schema";
import { findDemoService } from "./demo-data";
import { confirmPayment, failPayment, reservePayment } from "./ledger";
import { CAIP_NETWORK, createPayingClient, liveUsdcBalanceMicro, USDC_ADDRESS } from "./wallet";
import { formatUsd } from "./money";

export type PaidFetchResult =
  | { ok: true; paid: boolean; amount?: string; paymentId?: string; txHash?: string | null; data: unknown }
  | { ok: false; status: "blocked" | "needs_approval" | "error"; message: string; paymentId?: string };

const MAX_TEXT = 6000;

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
  }
}

function demoSellerUrl(path: string, search: string) {
  const base = (process.env.DEMO_SELLER_URL ?? "http://localhost:4021").replace(/\/$/, "");
  return `${base}/${path}${search}`;
}

function blocked(r: { decision: string; reason?: string; paymentId: string; approvalId?: string }, amountMicro: number): PaidFetchResult {
  if (r.decision === "needs_approval") {
    return {
      ok: false,
      status: "needs_approval",
      paymentId: r.paymentId,
      message: `This costs ${formatUsd(amountMicro)}, which needs the owner's approval (request ${r.approvalId}). Tell the user to approve it on the Approvals page, then ask again.`,
    };
  }
  return { ok: false, status: "blocked", paymentId: r.paymentId, message: `Payment blocked by spending rules: ${r.reason}` };
}

/** Simulated wallet + built-in demo service: full guard and ledger, no blockchain. */
function simulatedDemoCall(agent: Agent, url: URL): PaidFetchResult {
  const path = `${url.host}${url.pathname}`.replace(/^\/+|\/+$/g, "");
  const svc = findDemoService(path);
  if (!svc) return { ok: false, status: "error", message: `No demo service at ${url.toString()}` };
  const r = reservePayment(agent, { url: url.toString(), domain: "oja-demo", amountMicro: svc.priceMicro, payTo: "simulated-seller", network: "simulated" }, null);
  if (r.decision !== "allow") return blocked(r, svc.priceMicro);
  try {
    const data = svc.handler(url.searchParams);
    confirmPayment(r.paymentId, { txHash: null });
    return { ok: true, paid: true, amount: formatUsd(svc.priceMicro), paymentId: r.paymentId, data };
  } catch (e) {
    failPayment(r.paymentId, String(e));
    return { ok: false, status: "error", message: "The service failed, so the payment was cancelled." };
  }
}

function decodeRequirements(res: Response, body: unknown): { amountMicro: number; payTo?: string; asset?: string; network?: string } | null {
  try {
    const header = res.headers.get("PAYMENT-REQUIRED");
    const parsed = header ? JSON.parse(Buffer.from(header, "base64").toString("utf8")) : body;
    const accepts = (parsed as { accepts?: Array<Record<string, string>> })?.accepts;
    const first = accepts?.[0];
    if (!first) return null;
    return { amountMicro: Number(first.amount ?? first.maxAmountRequired), payTo: first.payTo, asset: first.asset, network: first.network };
  } catch {
    return null;
  }
}

/** Simulated wallet + external URL: we can check the price against the rules, but can't really pay. */
async function simulatedExternalCall(agent: Agent, url: URL): Promise<PaidFetchResult> {
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  const body = await readBody(res);
  if (res.status !== 402) return { ok: res.ok, paid: false, data: body } as PaidFetchResult;
  const req = decodeRequirements(res, body);
  if (!req || !Number.isFinite(req.amountMicro)) return { ok: false, status: "error", message: "Service asked for payment but its price couldn't be read." };
  const r = reservePayment(agent, { url: url.toString(), domain: url.hostname, amountMicro: req.amountMicro, payTo: req.payTo, network: req.network }, null);
  if (r.decision !== "allow") return blocked(r, req.amountMicro);
  failPayment(r.paymentId, "Simulated wallet: external services need a live wallet.");
  return { ok: false, status: "error", message: `The rules allow this ${formatUsd(req.amountMicro)} payment, but a simulated wallet can't pay real services. Switch this agent to a live wallet.` };
}

/** Live CDP wallet: real x402 payment, with the guard running before anything is signed. */
async function liveCall(agent: Agent, url: URL): Promise<PaidFetchResult> {
  if (!agent.walletAddress) return { ok: false, status: "error", message: "This agent's live wallet hasn't been created yet. Open its Wallet tab." };
  const { wrapFetchWithPayment } = await import("@x402/fetch");
  const { decodePaymentResponseHeader } = await import("@x402/core/http");
  const client = await createPayingClient(agent);
  let reservation: ReturnType<typeof reservePayment> | null = null;
  let amountMicro = 0;

  client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
    const req = selectedRequirements as unknown as Record<string, string>;
    amountMicro = Number(req.amount ?? req.maxAmountRequired);
    if (req.network !== CAIP_NETWORK) return { abort: true, reason: `Wrong network ${req.network}` };
    if ((req.asset ?? "").toLowerCase() !== USDC_ADDRESS.toLowerCase()) return { abort: true, reason: "Only USDC payments are allowed" };
    const balance = await liveUsdcBalanceMicro(agent.walletAddress!);
    reservation = reservePayment(agent, { url: url.toString(), domain: url.hostname, amountMicro, payTo: req.payTo, network: req.network }, balance);
    if (reservation.decision !== "allow") return { abort: true, reason: reservation.reason };
  });

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);
  let res: Response;
  try {
    res = await fetchWithPayment(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    const r = reservation as ReturnType<typeof reservePayment> | null;
    if (r && r.decision !== "allow") return blocked(r, amountMicro);
    if (r) failPayment(r.paymentId, String(e));
    return { ok: false, status: "error", message: `Payment or request failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const r = reservation as ReturnType<typeof reservePayment> | null;
  const body = await readBody(res);
  if (!r) return { ok: res.ok, paid: false, data: body } as PaidFetchResult; // free endpoint, nothing paid
  if (r.decision !== "allow") return blocked(r, amountMicro);
  if (!res.ok) {
    failPayment(r.paymentId, `Service returned HTTP ${res.status}`);
    return { ok: false, status: "error", message: `Service returned HTTP ${res.status} after payment was offered.` };
  }
  let txHash: string | null = null;
  const header = res.headers.get("PAYMENT-RESPONSE") ?? res.headers.get("X-PAYMENT-RESPONSE");
  if (header) {
    try {
      txHash = (decodePaymentResponseHeader(header) as { transaction?: string }).transaction ?? null;
    } catch {
      /* receipt header unreadable; payment still went through */
    }
  }
  confirmPayment(r.paymentId, { txHash });
  return { ok: true, paid: true, amount: formatUsd(amountMicro), paymentId: r.paymentId, txHash, data: body };
}

export async function paidFetch(agent: Agent, rawUrl: string): Promise<PaidFetchResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, status: "error", message: `Not a valid URL: ${rawUrl}` };
  }
  const isDemo = url.protocol === "oja-demo:";
  if (!isDemo && !["http:", "https:"].includes(url.protocol)) return { ok: false, status: "error", message: "Only http(s) and oja-demo:// URLs are supported." };

  try {
    if (agent.walletMode === "simulated") return isDemo ? simulatedDemoCall(agent, url) : await simulatedExternalCall(agent, url);
    const liveUrl = isDemo ? new URL(demoSellerUrl(`${url.host}${url.pathname}`.replace(/^\/+|\/+$/g, ""), url.search)) : url;
    return await liveCall(agent, liveUrl);
  } catch (e) {
    return { ok: false, status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
