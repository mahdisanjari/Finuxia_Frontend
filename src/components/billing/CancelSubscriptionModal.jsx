import { useState } from "react";
import Modal, { ModalTitle } from "../ui/Modal";
import { Button } from "../ui";
import { api } from "../../lib/api";
import { formatLongDate } from "../../lib/dates";

export const CANCEL_REASONS = [
  "It costs too much",
  "I don't use it enough",
  "I'm missing a feature I need",
  "I'm switching to another tool",
  "I'm closing or pausing my practice",
  "Other",
];
const MAX_REASON = 300;

/**
 * Cancelling a subscription. The default, and the recommended choice, is to stop renewing and keep using the plan until the end of the
 * period already paid for. Ending it right now is offered, but only behind a second, explicit confirmation, because it forfeits the rest
 * of the period. Neither choice refunds anything, and the dialog says so before the customer commits.
 *
 *   <CancelSubscriptionModal planName="Elite" endsAt="2026-02-01T00:00:00Z" onClose={close} onCancelled={(result, immediate) => ...} />
 */
export default function CancelSubscriptionModal({ planName, endsAt, onClose, onCancelled }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [endNow, setEndNow] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const endDate = formatLongDate(endsAt);
  const until = endDate || "the end of your billing period";
  const reasonText = (reason === "Other" ? (details.trim() ? `Other: ${details.trim()}` : "Other") : reason).slice(0, MAX_REASON);

  const submit = async (e) => {
    e.preventDefault();
    if (endNow && !understood) return;
    setSaving(true);
    setError("");
    try {
      const result = await api.cancelSubscription({ reason: reasonText, immediately: endNow, confirmImmediate: endNow && understood });
      onCancelled(result, endNow);
      onClose();
    } catch (err) {
      setError(err.message || "Could not cancel your subscription. Nothing has changed.");
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} dismissOnBackdrop={!saving} panelClassName="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-6">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ModalTitle className="text-lg font-bold text-navy">Cancel your subscription</ModalTitle>
        <p className="text-sm text-slate-600">
          {endNow ? (
            <>Your {planName} plan will end right now.</>
          ) : (
            <>
              You keep your {planName} plan, with everything in it, until <strong>{until}</strong>. It won't renew after that, and you won't
              be charged again.
            </>
          )}{" "}
          Cancelling doesn't refund what you've already paid.
        </p>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Why are you leaving? (optional)</legend>
          {CANCEL_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="cancel-reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
              {r}
            </label>
          ))}
          {reason === "Other" && (
            <textarea
              aria-label="Tell us more"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={MAX_REASON - "Other: ".length}
              rows={2}
              placeholder="Anything we could have done better?"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-gold"
            />
          )}
        </fieldset>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={endNow}
              onChange={(e) => {
                setEndNow(e.target.checked);
                setUnderstood(false);
              }}
            />
            <span>End it now instead of at the end of the period</span>
          </label>
          {endNow && (
            <label className="mt-2 flex items-start gap-2 text-sm font-medium text-av-red">
              <input type="checkbox" className="mt-0.5" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              <span>I understand I lose access to {planName} immediately and the rest of the paid period is not refunded.</span>
            </label>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-av-red/10 px-3 py-2 text-sm text-av-red">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Keep my plan
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            disabled={endNow && !understood}
            className="bg-av-red hover:bg-av-red/90"
          >
            {endNow ? "End my subscription now" : "Cancel at period end"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
