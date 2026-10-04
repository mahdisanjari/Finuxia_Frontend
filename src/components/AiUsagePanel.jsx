import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Wallet } from "lucide-react";
import AiBlockedNotice from "./AiBlockedNotice";
import AiUsageInline from "./AiUsageInline";
import useAiUsage from "../hooks/useAiUsage";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { creditsLabel, formatCents, formatReset } from "../lib/aiUsage";

const TOP_UPS = [500, 1000, 2500];

function ProgressBar({ percent, level }) {
  const color = level === "exhausted" || level === "critical" ? "bg-av-red" : level === "warning" ? "bg-gold" : "bg-av-green";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.min(percent, 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

/** Profile → AI usage: what AI the advisor has used this billing period and what is left, in credits. */
export default function AiUsagePanel() {
  const { usage, error, refresh } = useAiUsage();
  const { addToast } = useToast();
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const [toppingUp, setToppingUp] = useState(null);

  useEffect(() => {
    api.getBillingPlans().then((res) => setPurchasesOpen(res.purchasesOpen !== false)).catch(() => {});
  }, []);

  const handleTopUp = async (cents) => {
    setToppingUp(cents);
    try {
      const result = await api.topUpWallet(cents);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        addToast(`Added ${formatCents(cents)} to your AI wallet (test top-up — no real charge).`);
        await refresh();
      }
    } catch (err) {
      addToast(err.message || "Could not add credit");
    } finally {
      setToppingUp(null);
    }
  };

  if (error && !usage) return <section className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">AI usage isn't available right now. Try again in a moment.</section>;
  if (!usage) return <section className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">Loading your AI usage…</section>;

  const { credits, unlimited } = usage;
  const exhausted = usage.warning === "exhausted";

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2 text-navy">
          <Sparkles size={16} className="text-gold-dark" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">AI credits this period</h2>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Credits are what AI features use each time you draft a letter, summarise a document or send an automated follow-up.
        </p>

        {!usage.aiIncluded && (
          <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
            Your {usage.plan} plan doesn't include the AI features.{" "}
            <Link to="/billing" className="font-semibold text-gold-dark underline">See plans</Link>
          </p>
        )}

        {usage.aiIncluded && unlimited && (
          <p className="rounded-lg bg-av-green/10 px-3 py-3 text-sm text-navy">Your plan includes unlimited AI. There is nothing to run out of.</p>
        )}

        {usage.aiIncluded && !unlimited && credits.total > 0 && (
          <>
            <div className="mb-2 flex items-end justify-between">
              <p className="text-2xl font-bold text-navy">
                {credits.remaining} <span className="text-sm font-medium text-slate-500">of {credits.total} credits left</span>
              </p>
              <p className="text-xs text-slate-500">Resets {formatReset(usage.period.resetsAt)}</p>
            </div>
            <ProgressBar percent={usage.percentUsed ?? 0} level={usage.warning} />
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
              <span>{credits.used} used{credits.inFlight ? ` · ${credits.inFlight} in progress` : ""}</span>
              <span>{credits.included} included{credits.extra ? ` + ${credits.extra} extra` : ""}</span>
            </div>
            {!exhausted && <AiUsageInline usage={usage} className="mt-3" />}
          </>
        )}

        {usage.aiIncluded && !unlimited && credits.total === 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
            Your plan doesn't include a monthly AI allowance, so AI actions are paid from your wallet below.
          </p>
        )}

        {exhausted && (
          <AiBlockedNotice
            className="mt-3"
            error={{ message: "You've used your AI credits for this period. Add credit to your wallet or upgrade your plan to keep using AI.", data: { actions: ["top_up", "upgrade"] } }}
          />
        )}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-navy">
          <Wallet size={16} className="text-gold-dark" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">AI wallet</h2>
        </div>
        <p className="text-2xl font-bold text-navy">{formatCents(usage.wallet.balanceCents)}</p>
        <p className="mb-3 text-xs text-slate-500">Covers AI use beyond your included credits.</p>
        {purchasesOpen ? (
          <div className="flex flex-wrap gap-2">
            {TOP_UPS.map((cents) => (
              <button
                key={cents}
                type="button"
                disabled={toppingUp !== null}
                onClick={() => handleTopUp(cents)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy transition hover:bg-slate-50 disabled:opacity-60"
              >
                {toppingUp === cents ? "Adding…" : `Add ${formatCents(cents)}`}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Adding credit isn't open yet.</p>
        )}
      </section>

      {usage.byFeature.length > 0 && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy">This period by feature</h2>
          <ul className="flex flex-col divide-y divide-slate-100 text-sm">
            {usage.byFeature.map((f) => (
              <li key={f.feature} className="flex items-center justify-between py-2">
                <span className="text-navy">{f.label}</span>
                <span className="text-slate-500">
                  {f.calls} {f.calls === 1 ? "use" : "uses"} · {creditsLabel(f.credits)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy">Recent AI use</h2>
        {usage.recentUsage.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing yet. Your AI use will show up here.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 text-sm">
            {usage.recentUsage.map((r, i) => (
              <li key={`${r.createdAt}-${i}`} className="flex items-center justify-between gap-3 py-2">
                <span className="text-navy">{r.label}</span>
                <span className="text-xs text-slate-500">
                  {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="w-24 text-right text-slate-600">
                  {creditsLabel(r.credits)}
                  {r.costCents > 0 && <span className="block text-[11px] text-slate-400">{formatCents(r.costCents)} from wallet</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
