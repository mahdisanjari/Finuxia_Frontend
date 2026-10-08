/**
 * Checkout bookkeeping. The page the payment provider sends the customer back to must never take the URL's
 * word for it that a payment happened (anyone can type /billing/success): it asks the server. To tell "the
 * purchase went through" from "the account was already on a paid plan", Billing remembers the plan the account
 * had when checkout started, for this browser tab only.
 */
const KEY = "fx.checkout.planBefore";

export function rememberPlanBeforeCheckout(planKey) {
  try {
    sessionStorage.setItem(KEY, planKey || "");
  } catch {
    // storage blocked: the success page then confirms any active paid plan
  }
}

export function planBeforeCheckout() {
  try {
    return sessionStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function forgetPlanBeforeCheckout() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Has the server's billing status caught up with a completed purchase? */
export function purchaseConfirmed(status, planBefore) {
  if (!status || status.status !== "active" || !status.plan) return false;
  if (!(status.plan.priceCents > 0)) return false; // a free plan is not a purchase
  return planBefore ? status.plan.key !== planBefore : true;
}
