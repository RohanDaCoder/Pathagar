/* hooks/useAsyncData.ts — fetch-with-cancel + error/reload state for views.
   Pass a stable fetcher (useCallback) — the effect re-runs when the fetcher
   identity changes or on reload(). */

import { useCallback, useEffect, useState } from "react";
import { errMessage } from "@/lib/errors";

export function useAsyncData<T>(fetcher: () => Promise<T>): {
  data: T | null;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const d = await fetcher();
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(errMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // tick is the intentional refetch trigger (not read in the body)
    // eslint-disable-next-line react-hooks/exhaustive-effect-dependencies
  }, [fetcher, tick]);

  const reload = useCallback(() => {
    setData(null);
    setError(null);
    setTick((t) => t + 1);
  }, []);

  return { data, error, reload };
}
