import { useState, useEffect, useCallback } from 'react';

interface UseApiResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

function useApi<T>(fetcher: () => Promise<T>, fallback?: T): UseApiResult<T> {
  const [data, setData] = useState<T | null>(fallback ?? null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(message);
      if (fallback) {
        setData(fallback);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetcher, fallback]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

export default useApi;
