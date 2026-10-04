import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

/** The advisor's AI usage for the current billing period. `refresh()` after an AI call to update it. */
export default function useAiUsage() {
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setUsage(await api.getAiUsage());
      setError(false);
    } catch {
      setError(true); // the usage view is a courtesy: never block the page that embeds it
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { usage, error, refresh };
}
