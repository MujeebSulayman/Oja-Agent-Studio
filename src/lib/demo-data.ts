// Sample data sold by the built-in demo services. Every response is labelled as sample data.
// Swap these handlers for real sources you are licensed to resell before going live.
// This file has no app imports so the standalone demo seller (demo-seller/server.ts) can reuse it.

export type DemoService = {
  id: string;
  path: string;
  name: string;
  description: string;
  category: string;
  priceMicro: number;
  params: string;
  handler: (params: URLSearchParams) => unknown;
};

const NOTE = "SAMPLE DATA for demos and testing. Not real market information.";

const fxRates: Record<string, { buy: number; sell: number }> = {
  USD: { buy: 1528, sell: 1541 },
  GBP: { buy: 2012, sell: 2031 },
  EUR: { buy: 1771, sell: 1789 },
  GHS: { buy: 101, sell: 104 },
  KES: { buy: 11.8, sell: 12.1 },
};

const marketPrices = [
  { item: "Rice (50kg bag, foreign)", unit: "bag", prices: { "Mile 12": 82000, Oyingbo: 84500, Bodija: 80500 } },
  { item: "Tomatoes", unit: "basket", prices: { "Mile 12": 38000, Oyingbo: 41000, Bodija: 35500 } },
  { item: "Garri (white)", unit: "paint bucket", prices: { "Mile 12": 4200, Oyingbo: 4500, Bodija: 3900 } },
  { item: "Beans (oloyin)", unit: "paint bucket", prices: { "Mile 12": 9800, Oyingbo: 10200, Bodija: 9400 } },
  { item: "Palm oil", unit: "25L keg", prices: { "Mile 12": 52000, Oyingbo: 54000, Bodija: 49500 } },
  { item: "Onions", unit: "big bag", prices: { "Mile 12": 61000, Oyingbo: 63500, Bodija: 58000 } },
];

const businesses = [
  { name: "Adunni Foods Ltd", rcNumber: "RC-0000001", type: "Private limited company", status: "Active", state: "Lagos", registered: "2019-03-14" },
  { name: "Kola & Sons Logistics", rcNumber: "BN-0000002", type: "Business name", status: "Active", state: "Oyo", registered: "2021-07-02" },
  { name: "Eko Bright Solar Enterprises", rcNumber: "RC-0000003", type: "Private limited company", status: "Inactive", state: "Lagos", registered: "2016-11-20" },
  { name: "Ibadan Tech Hub Cooperative", rcNumber: "IT-0000004", type: "Incorporated trustees", status: "Active", state: "Oyo", registered: "2022-01-09" },
];

const fundingRounds = [
  { company: "PayKolo (fictional)", country: "Nigeria", stage: "Series A", amountUsd: 18_000_000, sector: "Payments" },
  { company: "SikaFlow (fictional)", country: "Ghana", stage: "Seed", amountUsd: 4_500_000, sector: "SME lending" },
  { company: "TeraNaira (fictional)", country: "Nigeria", stage: "Series B", amountUsd: 32_000_000, sector: "Stablecoin remittance" },
  { company: "Dakar Ledger (fictional)", country: "Senegal", stage: "Seed", amountUsd: 3_000_000, sector: "Merchant accounting" },
  { company: "Abidjan Pay (fictional)", country: "Côte d'Ivoire", stage: "Pre-seed", amountUsd: 1_200_000, sector: "Mobile money" },
];

export const BUILT_IN_SERVICES: DemoService[] = [
  {
    id: "svc_fx_rates",
    path: "fx-rates",
    name: "Naira FX rates",
    description: "Buy/sell rates for NGN against USD, GBP, EUR, GHS and KES.",
    category: "finance",
    priceMicro: 10_000,
    params: "currency (optional, e.g. USD)",
    handler: (p) => {
      const c = p.get("currency")?.toUpperCase();
      const rates = c && fxRates[c] ? { [c]: fxRates[c] } : fxRates;
      return { note: NOTE, base: "NGN", asOf: new Date().toISOString(), rates };
    },
  },
  {
    id: "svc_market_prices",
    path: "market-prices",
    name: "Market food prices",
    description: "Food staple prices (₦) at Mile 12 and Oyingbo (Lagos) and Bodija (Ibadan).",
    category: "commerce",
    priceMicro: 20_000,
    params: "item (optional, e.g. rice), market (optional: Mile 12, Oyingbo, Bodija)",
    handler: (p) => {
      const item = p.get("item")?.toLowerCase();
      const market = p.get("market");
      let rows = item ? marketPrices.filter((r) => r.item.toLowerCase().includes(item)) : marketPrices;
      if (market) {
        rows = rows.map((r) => ({ ...r, prices: Object.fromEntries(Object.entries(r.prices).filter(([m]) => m.toLowerCase() === market.toLowerCase())) as typeof r.prices }));
      }
      return { note: NOTE, currency: "NGN", asOf: new Date().toISOString(), rows };
    },
  },
  {
    id: "svc_business_lookup",
    path: "business-lookup",
    name: "Business registry lookup",
    description: "Look up a Nigerian business by name: registration number, type and status.",
    category: "verification",
    priceMicro: 50_000,
    params: "name (required, part of the business name)",
    handler: (p) => {
      const q = (p.get("name") ?? "").toLowerCase();
      const matches = q ? businesses.filter((b) => b.name.toLowerCase().includes(q)) : [];
      return { note: NOTE, query: q, matches };
    },
  },
  {
    id: "svc_funding_rounds",
    path: "funding-rounds",
    name: "West Africa fintech funding",
    description: "Recent fintech funding rounds in West Africa, with stage, amount and sector.",
    category: "research",
    priceMicro: 30_000,
    params: "country (optional), limit (optional, default 5)",
    handler: (p) => {
      const country = p.get("country")?.toLowerCase();
      const limit = Math.max(1, Math.min(20, Number(p.get("limit") ?? 5) || 5));
      const rows = (country ? fundingRounds.filter((r) => r.country.toLowerCase().includes(country)) : fundingRounds)
        .slice()
        .sort((a, b) => b.amountUsd - a.amountUsd)
        .slice(0, limit);
      return { note: NOTE, rounds: rows };
    },
  },
];

export function findDemoService(path: string): DemoService | undefined {
  return BUILT_IN_SERVICES.find((s) => s.path === path);
}
