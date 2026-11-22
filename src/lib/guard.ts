// The spend guard: the rules every payment must pass, enforced in code.
// "A prompt is a suggestion. Code is a rule."

export type SpendPolicy = {
  perPaymentCapMicro: number; // hard cap for any single payment
  dailyBudgetMicro: number; // rolling 24h budget
  approvalThresholdMicro: number; // payments above this need a human approval
  allowedDomains: string[]; // empty list = nothing allowed
};

export type SpendRequest = {
  domain: string; // hostname of the service being paid
  amountMicro: number;
};

export type SpendState = {
  spentLast24hMicro: number; // paid + reserved payments in the last 24h
  balanceMicro: number | null; // null when unknown (live wallets)
  hasApproval: boolean; // a human approved this exact request
};

export type GuardDecision =
  | { decision: "allow" }
  | { decision: "needs_approval"; reason: string }
  | { decision: "block"; reason: string };

export function domainAllowed(domain: string, allowed: string[]): boolean {
  const d = domain.toLowerCase();
  return allowed.some((raw) => {
    const rule = raw.trim().toLowerCase();
    if (!rule) return false;
    if (rule === "*") return true;
    if (rule.startsWith("*.")) {
      const base = rule.slice(2);
      return d === base || d.endsWith(`.${base}`);
    }
    return d === rule;
  });
}

export function checkSpend(policy: SpendPolicy, req: SpendRequest, state: SpendState): GuardDecision {
  if (!Number.isInteger(req.amountMicro) || req.amountMicro <= 0) {
    return { decision: "block", reason: "Invalid payment amount." };
  }
  if (!domainAllowed(req.domain, policy.allowedDomains)) {
    return { decision: "block", reason: `"${req.domain}" is not on this agent's list of approved services.` };
  }
  if (req.amountMicro > policy.perPaymentCapMicro) {
    return { decision: "block", reason: "Price is above this agent's per-payment cap." };
  }
  if (state.spentLast24hMicro + req.amountMicro > policy.dailyBudgetMicro) {
    return { decision: "block", reason: "This payment would go over the agent's daily budget." };
  }
  if (state.balanceMicro !== null && req.amountMicro > state.balanceMicro) {
    return { decision: "block", reason: "Not enough USDC in the agent's wallet." };
  }
  if (req.amountMicro > policy.approvalThresholdMicro && !state.hasApproval) {
    return { decision: "needs_approval", reason: "Payment is above the approval threshold, so a human must approve it." };
  }
  return { decision: "allow" };
}
