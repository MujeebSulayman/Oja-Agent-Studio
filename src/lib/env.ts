import { liveWalletsConfigured, NETWORK } from "./wallet";

// Tells the UI which features are ready, without ever sending secret values to the browser.
export function envStatus() {
  const names = ["OPENROUTER_API_KEY", "TAVILY_API_KEY", "TELEGRAM_BOT_TOKEN"];
  return {
    keys: Object.fromEntries(names.map((n) => [n, Boolean(process.env[n])])),
    liveWallets: liveWalletsConfigured(),
    network: NETWORK === "base" ? "Base" : "Base Sepolia (testnet)",
  };
}
