import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/**
 * Wraps a page that requires a specific plan module. Shows the page once
 * the account's plan includes it; otherwise shows an upgrade prompt instead
 * — mirrors what the backend itself enforces (HasModuleAccess), so this is
 * about a clean UI, not the actual security boundary.
 */
export default function ModuleGate({ moduleKey, moduleName, children }) {
  const { billing, hasModule } = useAuth();

  // Billing status hasn't loaded yet — avoid a locked-page flash.
  if (!billing) return null;

  if (hasModule(moduleKey)) return children;

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-gold-dark">
        <Lock size={24} />
      </div>
      <div>
        <p className="text-lg font-semibold text-navy">{moduleName} isn't included in your current plan</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">Upgrade to a plan that includes {moduleName} to use this page.</p>
      </div>
      <Link
        to="/billing"
        className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
      >
        View Plans
      </Link>
    </div>
  );
}
