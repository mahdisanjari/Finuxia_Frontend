import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearLegacyToken, setSessionExpiredHandler } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // `initializing` covers the boot-time /me call so ProtectedRoute doesn't
  // bounce a logged-in user to /login before their session is restored.
  const [initializing, setInitializing] = useState(true);
  // { plan, status, moduleKeys, currentPeriodEnd } — which modules this
  // account's plan unlocks. null while unknown (still loading, or logged out).
  const [billing, setBilling] = useState(null);

  const refreshBilling = async () => {
    try {
      const status = await api.getMyBillingStatus();
      setBilling(status);
      return status;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    clearLegacyToken();
    async function restore() {
      try {
        const { user: me } = await api.me();
        if (!cancelled) {
          setUser(me);
          refreshBilling();
        }
      } catch {
        // No valid session cookie (or it couldn't be refreshed) — stay logged out.
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (identifier, password) => {
    const { user: u } = await api.login(identifier, password);
    setUser(u);
    refreshBilling();
    return u;
  };

  const register = async (name, email, password) => {
    const { user: u } = await api.register({ name, email, password });
    setUser(u);
    refreshBilling();
    return u;
  };

  const requestPasswordReset = async (email) => {
    await api.forgotPassword(email);
    return true;
  };

  const updateProfile = async (patch) => {
    const { user: u } = await api.updateMe(patch);
    setUser(u);
    return u;
  };

  const updateComplianceProfile = async (patch) => {
    const { user: u } = await api.updateComplianceProfile(patch);
    setUser(u);
    return u;
  };

  const uploadAvatar = async (file) => {
    const { user: u } = await api.uploadAvatar(file);
    setUser(u);
    return u;
  };

  const removeAvatar = async () => {
    const { user: u } = await api.deleteAvatar();
    setUser(u);
    return u;
  };

  const logout = () => {
    // The refresh cookie is httpOnly, so only the server can clear and revoke it.
    api.logout().catch(() => {});
    setUser(null);
    setBilling(null);
  };

  useEffect(() => {
    // The API reports a session that can no longer be refreshed (expired/revoked).
    setSessionExpiredHandler(() => {
      setUser(null);
      setBilling(null);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const hasModule = (moduleKey) => (billing?.moduleKeys || []).includes(moduleKey);

  const value = useMemo(
    () => ({
      user,
      initializing,
      billing,
      refreshBilling,
      hasModule,
      login,
      register,
      logout,
      requestPasswordReset,
      updateProfile,
      updateComplianceProfile,
      uploadAvatar,
      removeAvatar,
    }),
    [user, initializing, billing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
