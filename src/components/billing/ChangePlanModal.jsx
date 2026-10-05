import { useEffect, useState } from "react";
import Modal, { ModalTitle } from "../ui/Modal";
import { Button } from "../ui";
import { api } from "../../lib/api";
import { formatCents } from "../../lib/currency";
import { formatLongDate } from "../../lib/dates";

/**
 * Moving to another plan, after showing exactly what it does.
 *
 *   - An upgrade applies now. The figure is Stripe's own prorated one (credit for the unused time on the current plan, the new plan for the rest
 *     of the period), and the billing date does not move. Confirming sends back the total that was shown and the instant it was worked out at;
 *     if the figure has moved in the meantime the server refuses and this shows the new one to confirm again.
 *   - A downgrade waits for the end of the paid period. Until then nothing changes, what is lost is named, and nothing is deleted.
 *
 *   <ChangePlanModal plan={plan} onClose={close} onChanged={(result) => ...} />
 */
export default function ChangePlanModal({ plan, onClose, onChanged }) {
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [moved, setMoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setPreview(null);
    setLoadError("");
    api
      .previewPlanChange(plan.id)
      .then((p) => current && setPreview(p))
      .catch((err) => current && setLoadError(err.message || "Could not work out the price. Nothing has changed."));
    return () => {
      current = false;
    };
  }, [plan.id, attempt]);

  const confirm = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await api.changePlan({
        planId: plan.id,
        expectedTotalCents: preview.totalCents,
        prorationDate: preview.prorationDate ?? undefined,
      });
      onChanged(result, preview);
      onClose();
    } catch (err) {
      if (err.status === 409 && err.data?.code === "price_changed" && err.data.preview) {
        setPreview((old) => ({ ...old, ...err.data.preview }));
        setMoved(true);
      } else {
        setError(err.message || "Could not change your plan. Nothing has changed.");
      }
      setSaving(false);
    }
  };

  const upgrade = preview?.kind === "upgrade";
  const when = formatLongDate(preview?.effectiveAt) || "the end of your billing period";
  const money = (cents) => formatCents(cents, preview?.currency);

  return (
    <Modal onClose={onClose} dismissOnBackdrop={!saving} panelClassName="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-6">
      <div className="flex flex-col gap-4">
        <ModalTitle className="text-lg font-bold text-navy">
          {preview ? (upgrade ? `Switch to ${plan.name} now` : `Switch to ${plan.name} on ${when}`) : `Switch to ${plan.name}`}
        </ModalTitle>

        {!preview && !loadError && <p className="text-sm text-slate-500">Working out the price...</p>}

        {loadError && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg bg-av-red/10 px-3 py-2 text-sm text-av-red">
            {loadError}
            <button type="button" className="w-fit text-xs font-semibold underline" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </div>
        )}

        {preview && upgrade && (
          <>
            {moved && (
              <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                The price changed since you last looked. Check the new amount, then confirm.
              </p>
            )}
            <p className="text-sm text-slate-600">
              {preview.totalCents > 0 ? (
                <>
                  Today you pay <strong>{money(preview.amountDueCents)}</strong>. That is the new plan for the rest of this billing period,
                  less credit for the time you haven't used on {preview.currentPlan.name}.
                </>
              ) : (
                <>
                  Nothing to pay today.
                  {preview.totalCents < 0 && (
                    <>
                      {" "}
                      A credit of <strong>{money(-preview.totalCents)}</strong> goes towards your next invoice.
                    </>
                  )}
                </>
              )}{" "}
              Your billing date stays <strong>{formatLongDate(preview.billingDate) || "the same"}</strong>.
            </p>
            {preview.lines.length > 0 && (
              <ul
                className="flex flex-col gap-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"
                aria-label="How the price is worked out"
              >
                {preview.lines.map((line, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{line.description}</span>
                    <span className="shrink-0 font-medium text-navy">{money(line.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
            {preview.modulesGained.length > 0 && <p className="text-sm text-slate-600">You get: {preview.modulesGained.join(", ")}.</p>}
          </>
        )}

        {preview && !upgrade && (
          <>
            {preview.warnings.map((w) => (
              <p key={w} className="text-sm text-slate-600">
                {w}
              </p>
            ))}
            {preview.alreadyScheduled && <p className="text-sm font-medium text-navy">This change is already scheduled.</p>}
          </>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-av-red/10 px-3 py-2 text-sm text-av-red">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Not now
          </Button>
          <Button variant="primary" loading={saving} disabled={!preview || (!upgrade && preview.alreadyScheduled)} onClick={confirm}>
            {!preview ? "Confirm" : upgrade ? "Upgrade now" : "Schedule the change"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
