import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Plus, Compass, LayoutGrid, CalendarDays, Users, Clock, Upload, BarChart3 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import GlobalSearch from "./GlobalSearch";
import NotificationsDropdown from "./NotificationsDropdown";
import AddClientModal from "./AddClientModal";
import ReconnectModal from "./ReconnectModal";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/my-day", label: "My Day", icon: CalendarDays },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/follow-ups", label: "Follow-ups", icon: Clock },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/import", label: "Import", icon: Upload },
];

export default function Layout() {
  const [modalOpen, setModalOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-navy">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <NavLink to="/dashboard" className="flex shrink-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold text-navy">
              <Compass size={18} strokeWidth={2.5} />
            </div>
            <span className="text-base font-bold tracking-tight text-white">
              Advisor<span className="text-gold">Pilot</span>
            </span>
          </NavLink>

          <div className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1 sm:px-4">
            <GlobalSearch />
          </div>

          <div className="order-2 flex shrink-0 items-center gap-1 sm:order-3">
            <NotificationsDropdown />
            <NavLink
              to="/profile"
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-gold text-sm font-bold text-navy"
              title={user?.name}
            >
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </NavLink>
          </div>
        </div>

        <div className="border-t border-white/5">
          <nav className="scrollbar-none mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-1.5 sm:px-6">
            {NAV_LINKS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? "bg-white/10 text-gold" : "text-slate-300 hover:text-white"
                  }`
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6">
        <Outlet />
      </main>

      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-gold px-5 py-3.5 text-sm font-semibold text-navy shadow-lg shadow-gold/30 transition hover:scale-105 hover:bg-gold-light active:scale-95"
      >
        <Plus size={18} strokeWidth={2.5} />
        Add Client
      </button>

      <AddClientModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <ReconnectModal />
    </div>
  );
}
