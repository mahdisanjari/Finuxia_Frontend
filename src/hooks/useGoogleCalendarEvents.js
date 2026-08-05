import { useCallback, useEffect, useState } from "react";
import { GoogleApiError } from "../services/googleApiClient";
import { createEvent, deleteEvent, isAppEvent, listUpcomingEvents, updateEvent } from "../services/googleCalendarApi";
import { readCachedEvents, writeCachedEvents } from "../services/eventCache";

/**
 * Event CRUD against the connected user's primary calendar. Takes the
 * `useGoogleAuth` result so token access and expiry handling stay in one
 * place. `cacheKey` (the app user's email) scopes an offline cache so the
 * last-known events render instantly on load, before any live fetch.
 */
export function useGoogleCalendarEvents(auth, cacheKey) {
  // Hydrate synchronously from cache so the UI never starts empty.
  const [events, setEvents] = useState(() => readCachedEvents(cacheKey)?.events ?? []);
  const [cachedAt, setCachedAt] = useState(() => readCachedEvents(cacheKey)?.cachedAt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Re-hydrate whenever the app user changes (never leak one user's cache).
  useEffect(() => {
    const cached = readCachedEvents(cacheKey);
    setEvents(cached?.events ?? []);
    setCachedAt(cached?.cachedAt ?? null);
  }, [cacheKey]);

  const withToken = useCallback(
    async (fn) => {
      const token = auth.getAccessToken();
      if (!token) {
        auth.handleExpired();
        const err = new Error("Your Google Calendar connection expired. Reconnect to continue.");
        err.needsReconnect = true;
        throw err;
      }
      try {
        return await fn(token);
      } catch (err) {
        if (err instanceof GoogleApiError && (err.type === "expired" || err.type === "forbidden")) {
          auth.handleExpired();
          err.needsReconnect = true;
        }
        if (err instanceof GoogleApiError && err.type === "rate_limited") {
          err.retryable = true;
        }
        throw err;
      }
    },
    [auth]
  );

  /**
   * Refetch. `silent` keeps the previous list on screen while loading (used by
   * background polling) so a sync never blanks the UI or disrupts the user.
   */
  const refresh = useCallback(
    async (options = {}, { silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const items = await withToken((token) => listUpcomingEvents(token, options));
        setEvents(items); // full replace only *after* data is in hand — no flicker
        setCachedAt(Date.now());
        writeCachedEvents(cacheKey, items);
        return items;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [withToken, cacheKey]
  );

  // Optimistic local mutations so CRUD reflects instantly, then reconcile.
  const create = useCallback(
    async (payload) => {
      const created = await withToken((token) => createEvent(token, payload));
      setEvents((prev) => {
        const next = [...prev, created].sort(byStart);
        writeCachedEvents(cacheKey, next);
        return next;
      });
      return created;
    },
    [withToken, cacheKey]
  );

  const update = useCallback(
    async (eventId, patch) => {
      const updated = await withToken((token) => updateEvent(token, eventId, patch));
      setEvents((prev) => {
        const next = prev.map((e) => (e.id === eventId ? updated : e)).sort(byStart);
        writeCachedEvents(cacheKey, next);
        return next;
      });
      return updated;
    },
    [withToken, cacheKey]
  );

  const remove = useCallback(
    async (eventId) => {
      await withToken((token) => deleteEvent(token, eventId));
      setEvents((prev) => {
        const next = prev.filter((e) => e.id !== eventId);
        writeCachedEvents(cacheKey, next);
        return next;
      });
    },
    [withToken, cacheKey]
  );

  /**
   * Historical fetch for a bounded window (Reports). Returns the items without
   * touching the shared `events` list, so the My Day "upcoming" view is never
   * disturbed by a report query.
   */
  const fetchRange = useCallback(
    (startISO, endISO, maxResults = 250) =>
      withToken((token) => listUpcomingEvents(token, { timeMin: startISO, timeMax: endISO, maxResults })),
    [withToken]
  );

  return { events, cachedAt, loading, error, refresh, fetchRange, create, update, remove, isAppEvent };
}

function byStart(a, b) {
  const av = a.start?.dateTime || a.start?.date || "";
  const bv = b.start?.dateTime || b.start?.date || "";
  return av.localeCompare(bv);
}
