import { useState, useEffect } from 'react';

/**
 * Fetches from Dataverse. If useMockFallback=true (default false),
 * falls back to mock data on error. Otherwise shows empty state.
 */
export function useDataverse<T>(
  fetchFn: () => Promise<T[]>,
  mockData: T[],
  deps: any[] = [],
  useMockFallback: boolean = false
): { data: T[]; loading: boolean; refetch: () => void; isLive: boolean } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const doFetch = async () => {
    setLoading(true);
    try {
      const results = await fetchFn();
      setData(results);
      setIsLive(true);
    } catch (err) {
      console.error('[useDataverse] Fetch failed:', err);
      if (useMockFallback) {
        setData(mockData);
        setIsLive(false);
      } else {
        setData([]);
        setIsLive(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    doFetch();
  }, deps);

  return { data, loading, refetch: doFetch, isLive };
}
