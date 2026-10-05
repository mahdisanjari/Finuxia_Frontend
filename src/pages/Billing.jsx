import { useEffect, useState } from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
import { rememberPlanBeforeCheckout } from "../lib/checkout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import ChangePlanModal from "../components/billing/ChangePlanModal";
import InvoiceHistory from "../components/billing/InvoiceHistory";
import PlanCards from "../components/billing/PlanCards";
import SubscriptionCard from "../components/billing/SubscriptionCard";

export default function Billing() {
  const { billing, refreshBilling } = useAuth();
  const { addToast } = useToast();
  const [plans, setPlans] = useState(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  // False in production until payments are connected: paid plans can't be selected yet.
  const [purchasesOpen, setPurchasesOpen] = useState(true);
  const [purchasingId, setPurchasingId] = useState(null);
  const [changingTo, setChangingTo] = useState(null);

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

  // A paying customer moves between plans with the change flow (previewed, prorated by Stripe, a downgrade waits for the period's end);
  // buying is for someone with no paid subscription.
  const paying = billing?.plan?.priceCents > 0 && !isLegacy && billing?.status !== "canceled";
  const changeBlocker = !paying
    ? ""
    : billing.cancelAtPeriodEnd
      ? "Keep your subscription first"
      : billing.status === "past_due"
        ? "Fix your payment first"
        : "";
  const changeLabel = (plan) => (plan.priceCents > billing.plan.priceCents ? "Upgrade" : "Downgrade");

  const planChanged = async (result) => {
    await refreshBilling();
    addToast(
      result.outcome === "upgraded"
        ? "Your plan has been upgraded."
        : "Your plan change is scheduled. Nothing changes until your current period ends."
    );
  };

  const actionFor = (plan) => {
    const isCurrent = plan.key === currentPlanKey;
    return {
      onClick: () => (paying ? setChangingTo(plan) : handlePurchase(plan)),
      disabled:
        isCurrent ||
        purchasingId === plan.id ||
        isLegacy ||
        Boolean(paying && changeBlocker) ||
        (!paying && !purchasesOpen && plan.priceCents > 0),
      label: isCurrent
        ? "Active"
        : paying
          ? changeBlocker || changeLabel(plan)
          : purchasingId === plan.id
            ? "Processing..."
            : !purchasesOpen && plan.priceCents > 0
              ? "Not available yet"
              : stripeConfigured
                ? "Subscribe"
                : "Get this plan (test)",
    };
  };

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
      {billing?.plan?.priceCents > 0 && !isLegacy && <InvoiceHistory />}

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

      <PlanCards plans={plans} currentPlanKey={currentPlanKey} actionFor={actionFor} />

      {changingTo && <ChangePlanModal plan={changingTo} onClose={() => setChangingTo(null)} onChanged={planChanged} />}
    </div>
  );
}
