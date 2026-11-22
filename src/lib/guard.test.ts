import { describe, expect, it } from "vitest";
import { checkSpend, domainAllowed, type SpendPolicy } from "./guard";

const policy: SpendPolicy = {
  perPaymentCapMicro: 50_000, // 5c
  dailyBudgetMicro: 2_000_000, // $2
  approvalThresholdMicro: 20_000, // 2c
  allowedDomains: ["oja-demo", "*.example.com"],
};
const fresh = { spentLast24hMicro: 0, balanceMicro: 5_000_000, hasApproval: false };

describe("domainAllowed", () => {
  it("matches exact and wildcard domains", () => {
    expect(domainAllowed("oja-demo", policy.allowedDomains)).toBe(true);
    expect(domainAllowed("api.example.com", policy.allowedDomains)).toBe(true);
    expect(domainAllowed("example.com", policy.allowedDomains)).toBe(true);
    expect(domainAllowed("evil-example.com", policy.allowedDomains)).toBe(false);
    expect(domainAllowed("anything", [])).toBe(false);
  });
});

describe("checkSpend", () => {
  it("allows a small payment to an approved service", () => {
    expect(checkSpend(policy, { domain: "oja-demo", amountMicro: 10_000 }, fresh).decision).toBe("allow");
  });
  it("blocks unknown services", () => {
    expect(checkSpend(policy, { domain: "random.io", amountMicro: 10_000 }, fresh).decision).toBe("block");
  });
  it("blocks anything above the per-payment cap, even with approval", () => {
    const r = checkSpend(policy, { domain: "oja-demo", amountMicro: 60_000 }, { ...fresh, hasApproval: true });
    expect(r.decision).toBe("block");
  });
  it("blocks when the daily budget would be exceeded", () => {
    const r = checkSpend(policy, { domain: "oja-demo", amountMicro: 10_000 }, { ...fresh, spentLast24hMicro: 1_995_000 });
    expect(r.decision).toBe("block");
  });
  it("blocks when the wallet is short", () => {
    const r = checkSpend(policy, { domain: "oja-demo", amountMicro: 10_000 }, { ...fresh, balanceMicro: 5_000 });
    expect(r.decision).toBe("block");
  });
  it("asks for approval above the threshold, allows once approved", () => {
    expect(checkSpend(policy, { domain: "oja-demo", amountMicro: 30_000 }, fresh).decision).toBe("needs_approval");
    expect(checkSpend(policy, { domain: "oja-demo", amountMicro: 30_000 }, { ...fresh, hasApproval: true }).decision).toBe("allow");
  });
  it("rejects zero and fractional amounts", () => {
    expect(checkSpend(policy, { domain: "oja-demo", amountMicro: 0 }, fresh).decision).toBe("block");
    expect(checkSpend(policy, { domain: "oja-demo", amountMicro: 1.5 }, fresh).decision).toBe("block");
  });
});
