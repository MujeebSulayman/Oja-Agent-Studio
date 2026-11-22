/**
 * Ọjà demo seller: a real x402 API selling the built-in sample data on Base Sepolia.
 * Live-wallet agents pay this server with testnet USDC.
 *
 *   SELLER_PAY_TO=0xYourAddress npm run seller
 *
 * Uses the public testnet facilitator (no API key). For mainnet, switch to the CDP facilitator.
 */
import express from "express";
import { paymentMiddleware, x402ResourceServer, type Network } from "@x402/express";
import type { RoutesConfig } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { BUILT_IN_SERVICES } from "../src/lib/demo-data";

const PORT = Number(process.env.SELLER_PORT ?? 4021);
const PAY_TO = process.env.SELLER_PAY_TO;
const NETWORK: Network = "eip155:84532"; // Base Sepolia
const FACILITATOR = process.env.SELLER_FACILITATOR_URL ?? "https://x402.org/facilitator";

if (!PAY_TO || !/^0x[a-fA-F0-9]{40}$/.test(PAY_TO)) {
  console.error("Set SELLER_PAY_TO to the 0x address that should receive payments.");
  process.exit(1);
}

const resourceServer = new x402ResourceServer(new HTTPFacilitatorClient({ url: FACILITATOR })).register(NETWORK, new ExactEvmScheme());

const routes: RoutesConfig = Object.fromEntries(
  BUILT_IN_SERVICES.map((s) => [
    `GET /${s.path}`,
    {
      accepts: [{ scheme: "exact", price: `$${(s.priceMicro / 1e6).toFixed(6)}`, network: NETWORK, payTo: PAY_TO }],
      description: s.description,
      mimeType: "application/json",
    },
  ]),
);

const app = express();
app.get("/", (_req, res) => {
  res.json({
    name: "Ọjà demo seller",
    network: NETWORK,
    payTo: PAY_TO,
    services: BUILT_IN_SERVICES.map((s) => ({ path: `/${s.path}`, name: s.name, price: `$${s.priceMicro / 1e6}`, params: s.params })),
  });
});
app.use(paymentMiddleware(routes, resourceServer));
for (const s of BUILT_IN_SERVICES) {
  app.get(`/${s.path}`, (req, res) => {
    res.json(s.handler(new URLSearchParams(req.query as Record<string, string>)));
  });
}

app.listen(PORT, () => {
  console.log(`Ọjà demo seller on http://localhost:${PORT}, paying out to ${PAY_TO} on Base Sepolia`);
});
