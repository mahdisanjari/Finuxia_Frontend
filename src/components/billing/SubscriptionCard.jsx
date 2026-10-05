import { useState } from "react";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import { formatLongDate } from "../../lib/dates";
import { Button } from "../ui";
import CancelSubscriptionModal from "./CancelSubscriptionModal";

/**
 * Where the customer's paid subscription stands, and what they can do about it: cancel (access continues to the end of the paid period),
 * take a pending cancellation back (no payment, same price), or, once it has ended, subscribe again from the plans below at today's price.
 * Not shown for free or grandfathered plans: there is nothing to cancel.
 */
export default function SubscriptionCard() {
  const { billing, refreshBilling } = useAuth();
  const { addToast } = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const plan = billing?.plan;
  if (!plan || !(plan.priceCents > 0) || plan.key === "legacy" || !billing.status) return null;

  const ended = billing.status === "canceled";
  const pending = Boolean(billing.cancelAtPeriodEnd);
  const endsOn = formatLongDate(billing.endsAt);
  const renewsOn = formatLongDate(billing.currentPeriodEnd);

  const reactivate = async () => {
    setReactivating(true);
    try {
      await api.reactivateSubscription();
      await refreshBilling();
      addToast("Your subscription will continue. Nothing to pay now.");
    } catch (err) {
      addToast(err.message || "Could not reactivate your subscription");
      if (err.status === 409) await refreshBilling(); // the period ended in the meantime: the page now shows the plans to choose from
    } finally {
      setReactivating(false);
    }
  };

  const cancelled = async (_result, immediately) => {
    await refreshBilling();
    addToast(immediately ? "Your subscription has ended." : "Your subscription is cancelled. You keep access until the end of the period.");
  };

  return (
    <section aria-label="Your subscription" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your subscription</p>
          <p className="text-lg font-bold text-navy">{plan.name}</p>
          {!ended && !pending && renewsOn && <p className="text-sm text-slate-500">Renews on {renewsOn}</p>}
        </div>
        {!ended && !pending && (
          <Button variant="secondary" onClick={() => setCancelling(true)}>
            Cancel subscription
          </Button>
        )}
      </div>

      {pending && !ended && (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <span className="flex items-center gap-2">
            <CalendarClock size={16} className="shrink-0" />
            {endsOn ? (
              <>Your subscription ends on {endsOn}. You keep full access until then.</>
            ) : (
              <>Your subscription is set to end. You keep full access until the end of the period.</>
            )}
          </span>
          {billing.canReactivate ? (
            <Button variant="primary" size="sm" loading={reactivating} onClick={reactivate}>
              Keep my subscription
            </Button>
          ) : (
            <span className="font-medium">To continue, choose a plan below.</span>
          )}
        </div>
      )}

      {ended && (
        <div
          role="status"
          className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
        >
          <AlertTriangle size={16} className="shrink-0 text-gold-dark" />
          Your subscription has ended. Choose a plan below to subscribe again at today's price.
        </div>
      )}

      {billing.status === "past_due" && !ended && (
        <div
          role="status"
          className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <AlertTriangle size={16} className="shrink-0" />
          We couldn't take your last payment. We'll keep trying; your plan's features are paused until it goes through.
        </div>
      )}

      {cancelling && (
        <CancelSubscriptionModal
          planName={plan.name}
          endsAt={billing.currentPeriodEnd}
          onClose={() => setCancelling(false)}
          onCancelled={cancelled}
        />
      )}
    </section>
  );
}
