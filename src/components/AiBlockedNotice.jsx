import { Link } from "react-router-dom";
import { Ban } from "lucide-react";

/**
 * Shown when an AI action is blocked (allowance used up and the wallet can't cover it, or the plan has no
 * AI). It says WHICH limit was hit — the server's own sentence — and offers the way out, instead of a bare
 * error code or an unexplained failure.
 */
export default function AiBlockedNotice({ error, onDismiss, className = "" }) {
  const actions = error?.data?.actions || [];
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-lg border border-av-red/40 bg-av-red/10 px-3 py-2.5 text-xs text-av-red ${className}`}
    >
      <Ban size={15} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>{error?.message}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.includes("top_up") && (
            <Link to="/profile?tab=ai-usage" className="rounded-md bg-navy px-3 py-1 font-semibold text-white hover:bg-navy-light">
              Add credit
            </Link>
          )}
          {actions.includes("upgrade") && (
            <Link to="/billing" className="rounded-md border border-slate-300 bg-white px-3 py-1 font-semibold text-navy hover:bg-slate-50">
              See plans
            </Link>
          )}
        </div>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="font-semibold underline">
          Dismiss
        </button>
      )}
    </div>
  );
}
