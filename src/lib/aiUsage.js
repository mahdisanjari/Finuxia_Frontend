// Presentation helpers for the AI usage view. Everything here is in CREDITS: token counts are provider
// detail and mean nothing to an advisor, so the API never sends them and this never shows them.

export const WARN_AT = 80;
export const CRITICAL_AT = 95;

export function formatCents(cents) {
  const value = Number.isFinite(cents) ? cents : 0;
  return `$${(value / 100).toFixed(2)}`;
}

export function creditsLabel(n) {
  return `${n} ${n === 1 ? "credit" : "credits"}`;
}

export function formatReset(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The sentence shown inline at 80% and 95% (and at 100%); null below 80%. */
export function warningMessage(usage) {
  if (!usage || usage.unlimited || !usage.credits || !usage.warning) return null;
  const { remaining, total } = usage.credits;
  const reset = formatReset(usage.period?.resetsAt);
  if (usage.warning === "exhausted") {
    return `You've used all ${total} AI credits included in your plan this period. They reset on ${reset}; add credit to your wallet or upgrade to keep using AI.`;
  }
  if (usage.warning === "critical") {
    return `Only ${creditsLabel(remaining)} left of your ${total} AI credits this period (resets ${reset}).`;
  }
  return `You've used ${usage.percentUsed}% of your AI credits this period (resets ${reset}).`;
}

/** What the blocked-state notice offers, from the API's `actions` (never a bare error code). */
export function isAiBlocked(error) {
  return error?.data?.code === "ai_credit_exhausted" || error?.data?.code === "ai_not_in_plan";
}
