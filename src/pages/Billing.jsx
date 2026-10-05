import { useEffect, useState } from "react";
import { CheckCircle2, Sparkles, ShieldCheck } from "lucide-react";
import { rememberPlanBeforeCheckout } from "../lib/checkout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import SubscriptionCard from "../components/billing/SubscriptionCard";

function formatPrice(cents, currency, interval) {
  if (cents === 0) return "Free";
  const amount = (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 });
  return `$${amount} ${currency.toUpperCase()}/${interval === "month" ? "mo" : interval === "year" ? "yr" : "one-time"}`;
}

export default function Billing() {
  const { billing, refreshBilling } = useAuth();
  const { addToast } = useToast();
  const [plans, setPlans] = useState(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  // False in production until payments are connected: paid plans can't be selected yet.
  const [purchasesOpen, setPurchasesOpen] = useState(true);
  const [purchasingId, setPurchasingId] = useState(null);

  useEffect(() => {
    api
      .getBillingPlans()
      .then((res) => {
        setPlans(res.plans);
        setStripeConfigured(res.stripeConfigured);
        setPurchasesOpen(res.purchasesOpen !== false);
      })
      .catch(() => addToast("Could not load plans"));
  }, [addToast]);

  const currentPlanKey = billing?.plan?.key;
  const isLegacy = currentPlanKey === "legacy";

  const handlePurchase = async (plan) => {
    setPurchasingId(plan.id);
    try {
      const result = await api.purchasePlan(plan.id);
      if (result.mock) {
        await refreshBilling();
        addToast(`You're now on the ${plan.name} plan (test purchase — no real charge, Stripe isn't connected yet).`);
      } else if (result.checkoutUrl) {
        rememberPlanBeforeCheckout(currentPlanKey); // so the return page can tell that the purchase really went through
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      addToast(err.message || "Could not start checkout");
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Plans &amp; Billing</h1>
        <p className="text-sm text-slate-500">
          Pick a plan to unlock its modules. Each plan below only affects what your own account can use.
        </p>
      </div>

      <SubscriptionCard />

      {isLegacy && (
        <div className="flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold-dark">
          <ShieldCheck size={16} />
          You joined before plans existed, so your account keeps full access to every module for free — no need to pick a plan.
        </div>
      )}

      {!purchasesOpen && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Sparkles size={14} className="shrink-0 text-gold-dark" />
          Plan purchases aren't open yet. Your current plan stays as it is — we'll announce when paid plans are available.
        </div>
      )}

      {purchasesOpen && !stripeConfigured && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <Sparkles size={14} className="shrink-0 text-gold-dark" />
          Payments aren't connected yet — "purchasing" a plan below activates it instantly for testing, with no real charge.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(plans || []).map((plan) => {
          const isCurrent = plan.key === currentPlanKey;
          return (
            <div
              key={plan.id}
              className={`flex flex-col gap-4 rounded-2xl border bg-white p-6 shadow-sm ${
                isCurrent ? "border-gold ring-2 ring-gold/30" : "border-slate-200"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-navy">{plan.name}</h2>
                  {isCurrent && (
                    <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold-dark">Current plan</span>
                  )}
                </div>
                <p className="mt-1 text-2xl font-bold text-navy">{formatPrice(plan.priceCents, plan.currency, plan.interval)}</p>
                <p className="mt-1 text-xs text-slate-500">{plan.description}</p>
              </div>

              <ul className="flex flex-1 flex-col gap-1.5">
                {plan.modules.map((m) => (
                  <li key={m.key} className="flex items-start gap-1.5 text-sm text-slate-600">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-av-green" />
                    {m.name}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handlePurchase(plan)}
                disabled={isCurrent || purchasingId === plan.id || isLegacy || (!purchasesOpen && plan.priceCents > 0)}
                className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCurrent
                  ? "Active"
                  : purchasingId === plan.id
                    ? "Processing..."
                    : !purchasesOpen && plan.priceCents > 0
                      ? "Not available yet"
                      : stripeConfigured
                        ? "Subscribe"
                        : "Get this plan (test)"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
