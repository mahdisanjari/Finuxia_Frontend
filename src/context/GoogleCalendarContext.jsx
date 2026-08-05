import { createContext, useContext, useEffect, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useGoogleAuth } from "../hooks/useGoogleAuth";
import { useGoogleCalendarEvents } from "../hooks/useGoogleCalendarEvents";
import { isOnDate } from "../services/googleCalendarApi";

const POLL_MS = 60_000; // near-realtime without a backend: poll once a minute

const GoogleCalendarContext = createContext(null);

export function GoogleCalendarProvider({ children }) {
  const { user } = useAuth();
  const cacheKey = user?.email;
  const auth = useGoogleAuth(cacheKey);
  const cal = useGoogleCalendarEvents(auth, cacheKey);

  const { status } = auth;
  const { refresh } = cal;

  // Initial load the moment a connection goes live.
  useEffect(() => {
    if (status === "connected") refresh().catch(() => {});
  }, [status, refresh]);

  // Background polling — no page reload, keeps the on-screen list during fetch.
  useEffect(() => {
    if (status !== "connected") return undefined;
    const id = setInterval(() => refresh({}, { silent: true }).catch(() => {}), POLL_MS);
    return () => clearInterval(id);
  }, [status, refresh]);

  // Refetch when the tab regains focus — the common "came back after a meeting"
  // case, so the list is fresh without waiting for the next poll tick.
  useEffect(() => {
    if (status !== "connected") return undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh({}, { silent: true }).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [status, refresh]);

  const value = useMemo(
    () => ({
      // connection state
      status: auth.status, // 'disconnected' | 'connecting' | 'connected' | 'expired' | 'error'
      googleEmail: auth.googleEmail,
      isConfigured: auth.isConfigured,
      authError: auth.error,
      connect: auth.connect,
      disconnect: auth.disconnect,

      // events (events + cachedAt survive across sessions via the cache)
      events: cal.events,
      cachedAt: cal.cachedAt,
      todaysEvents: cal.events.filter((event) => isOnDate(event)),
      eventsLoading: cal.loading,
      eventsError: cal.error,
      refreshEvents: cal.refresh,
      fetchEventsInRange: cal.fetchRange,
      createEvent: cal.create,
      updateEvent: cal.update,
      deleteEvent: cal.remove,
      isAppEvent: cal.isAppEvent,
    }),
    [auth, cal]
  );

  return <GoogleCalendarContext.Provider value={value}>{children}</GoogleCalendarContext.Provider>;
}

export function useGoogleCalendar() {
  const ctx = useContext(GoogleCalendarContext);
  if (!ctx) throw new Error("useGoogleCalendar must be used within GoogleCalendarProvider");
  return ctx;
}
