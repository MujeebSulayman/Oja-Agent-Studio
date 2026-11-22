// All money is stored as integer micro-USDC (USDC has 6 decimals): 1 USDC = 1_000_000.
export const MICRO = 1_000_000;

export function toMicro(usd: number | string): number {
  const n = typeof usd === "string" ? Number(usd.replace(/[$,\s]/g, "")) : usd;
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid amount: ${usd}`);
  return Math.round(n * MICRO);
}

export function fromMicro(micro: number): number {
  return micro / MICRO;
}

export function formatUsd(micro: number): string {
  const usd = micro / MICRO;
  if (usd !== 0 && Math.abs(usd) < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
