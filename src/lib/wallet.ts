import type { Agent } from "@/db/schema";

// Live wallets are CDP Server Wallets: the private key stays inside Coinbase's
// secure enclave. The model never sees it, and this app never stores it.

export const NETWORK = (process.env.OJA_NETWORK === "base" ? "base" : "base-sepolia") as "base" | "base-sepolia";
export const CAIP_NETWORK = NETWORK === "base" ? "eip155:8453" : "eip155:84532";
export const USDC_ADDRESS =
  NETWORK === "base" ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" : "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export function liveWalletsConfigured(): boolean {
  return Boolean(process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET && process.env.CDP_WALLET_SECRET);
}

export function cdpAccountName(agentId: string): string {
  // CDP account names: 2-36 chars, letters, numbers and hyphens.
  return `oja-${agentId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 31)}`;
}

export async function createPayingClient(agent: Agent) {
  const { CdpX402Client } = await import("@coinbase/cdp-sdk/x402");
  return new CdpX402Client({
    walletConfig: { type: "eoa", accountName: cdpAccountName(agent.id) },
    environment: NETWORK === "base" ? "production" : "development",
    // Second line of defence inside the SDK, on top of Ọjà's own spend guard.
    spendControls: {
      maxAmountPerPayment: { atomic: BigInt(agent.perPaymentCapMicro), asset: USDC_ADDRESS },
      maxCumulativeSpend: { atomic: BigInt(agent.dailyBudgetMicro), asset: USDC_ADDRESS },
      maxCumulativeSpendWindow: "24h",
      allowedNetworks: [CAIP_NETWORK],
    },
  });
}

export async function provisionLiveWallet(agent: Agent): Promise<string> {
  if (!liveWalletsConfigured()) throw new Error("Live wallets need CDP_API_KEY_ID, CDP_API_KEY_SECRET and CDP_WALLET_SECRET in .env.local");
  const client = await createPayingClient(agent);
  const { evmAddress } = await client.getAddresses();
  if (!evmAddress) throw new Error("CDP did not return an EVM address");
  return evmAddress;
}

export async function liveUsdcBalanceMicro(address: string): Promise<number | null> {
  if (!liveWalletsConfigured()) return null;
  try {
    const { CdpClient } = await import("@coinbase/cdp-sdk");
    const cdp = new CdpClient();
    const res = await cdp.evm.listTokenBalances({ address: address as `0x${string}`, network: NETWORK });
    const usdc = res.balances.find((b) => b.token.contractAddress.toLowerCase() === USDC_ADDRESS.toLowerCase());
    return usdc ? Number(usdc.amount.amount) : 0;
  } catch (e) {
    console.error("balance lookup failed", e);
    return null;
  }
}

export async function requestTestnetUsdc(address: string) {
  if (NETWORK !== "base-sepolia") throw new Error("The faucet only works on Base Sepolia");
  const { CdpClient } = await import("@coinbase/cdp-sdk");
  const cdp = new CdpClient();
  return cdp.evm.requestFaucet({ address: address as `0x${string}`, network: "base-sepolia", token: "usdc" });
}
