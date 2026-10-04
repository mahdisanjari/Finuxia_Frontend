import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads something when a component mounts (and again when `deps` change): the effect, the loading flag, the error and
 * the guard against a stale answer, which four pages each wrote out by hand.
 *
 *   const { data, loading, error, reload, setData } = useAsync(() => api.getTickets(), [], { initialData: [] });
 *
 * - `loading` is true from the start, so a page never flashes "empty" before its first load.
 * - An answer that arrives after the component left, or after `deps` changed, is ignored (no stale data, no
 *   state update on an unmounted component).
 * - `reload()` fetches again (keeping the current data on screen while it does) and resolves when done.
 * - `setData` updates the loaded data locally (e.g. after a reply or an edit) without another request.
 */
export default function useAsync(fetcher, deps = [], { initialData = null } = {}) {
  const [state, setState] = useState({ data: initialData, loading: true, error: null });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const runId = useRef(0);

  const run = useCallback(async () => {
    const id = ++runId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      if (id === runId.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (id === runId.current) setState((s) => ({ ...s, loading: false, error }));
    }
  }, []);

  useEffect(() => {
    run();
    return () => {
      runId.current += 1; // whatever is still in flight is now stale
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller's `deps` decide when to load again; `run` is stable and reads the latest fetcher from a ref
  }, deps);

  const setData = useCallback((next) => setState((s) => ({ ...s, data: typeof next === "function" ? next(s.data) : next })), []);

  return { ...state, reload: run, setData };
}
