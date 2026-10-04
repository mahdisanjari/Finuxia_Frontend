import { useNavigate } from "react-router-dom";
import { Lock, Mail, LogOut } from "lucide-react";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { formatDate } from "../lib/followUp";

const ADMIN_EMAIL = "soroushojagh@gmail.com";

export default function Subscribe() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const active = user?.subscriptionActive !== false;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const subject = encodeURIComponent("Finuxia subscription request");
  const body = encodeURIComponent(`Hi Soroush,\n\nI'd like to continue using Finuxia.\n\nAccount: ${user?.email || ""}\n\nThanks!`);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo size={26} plain />
          <span className="text-lg font-bold tracking-tight text-navy">
            Fin<span className="text-gold-dark">uxia</span>
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-gold-dark">
            <Lock size={22} />
          </div>

          {active ? (
            <>
              <h1 className="text-xl font-bold text-navy">You're on the free trial</h1>
              <p className="mt-1 text-sm text-slate-500">
                Your free access runs until <span className="font-semibold text-navy">{formatDate(user?.subscriptionUntil)}</span>. After
                that, contact the admin to keep going.
              </p>
              <button
                onClick={() => navigate("/dashboard")}
                className="mt-5 w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light"
              >
                Back to the app
              </button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-navy">Your free month has ended</h1>
              <p className="mt-1 text-sm text-slate-500">
                Thanks for trying Finuxia! To keep using the platform, contact the admin to activate your subscription — they'll renew your
                access right away.
              </p>

              <a
                href={`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light"
              >
                <Mail size={16} />
                Contact {ADMIN_EMAIL}
              </a>
              <p className="mt-3 text-center text-xs text-slate-400">
                Once the admin renews your account, refresh this page to get back in.
              </p>
            </>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="mt-5 flex w-full items-center justify-center gap-2 text-sm font-medium text-slate-500 transition hover:text-navy"
        >
          <LogOut size={15} />
          Log out
        </button>
      </div>
    </div>
  );
}
