// mobile/src/hooks/usePaginatedData.ts
import { useCallback, useEffect, useRef, useState } from 'react';

export interface PaginationState<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
}

export interface UsePaginatedDataOptions {
  initialPage?: number;
  initialLimit?: number;
  autoLoad?: boolean;
  /** Changing this key resets and re-fetches the list. Use a stable string per resource. */
  key?: string;
}

export function usePaginatedData<T extends { id: string }>(
  fetchFn: (page: number, limit: number) => Promise<{ data: T[]; total: number }>,
  options: UsePaginatedDataOptions = {}
) {
  const {
    initialPage = 1,
    initialLimit = 10,
    autoLoad = true,
    key = 'default',
  } = options;

  const [state, setState] = useState<PaginationState<T>>({
    data: [],
    page: initialPage,
    limit: initialLimit,
    total: 0,
    hasMore: true,
    isLoading: false,
    isRefreshing: false,
  });

  const isMounted = useRef(true);
  const inFlight = useRef(false);
  const fetchFnRef = useRef(fetchFn);

  // Keep the latest fetchFn without re-triggering effects
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const mergeUnique = (prev: T[], incoming: T[]): T[] => {
    const seen = new Set(prev.map((i) => i.id));
    const merged = [...prev];
    for (const item of incoming) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }
    return merged;
  };

  const load = useCallback(
    async (page: number, mode: 'initial' | 'refresh' | 'append') => {
      if (!isMounted.current || inFlight.current) return;
      inFlight.current = true;

      setState((prev) => ({
        ...prev,
        isLoading: mode !== 'refresh',
        isRefreshing: mode === 'refresh',
      }));

      try {
        const result = await fetchFnRef.current(page, state.limit);
        if (!isMounted.current) return;

        setState((prev) => {
          const merged =
            mode === 'append' ? mergeUnique(prev.data, result.data) : result.data;

          // hasMore derived from TOTAL, not page size
          const hasMore = merged.length < result.total && result.data.length > 0;

          return {
            ...prev,
            data: merged,
            page,
            total: result.total,
            hasMore,
            isLoading: false,
            isRefreshing: false,
          };
        });
      } catch (err) {
        console.error('usePaginatedData load error:', err);
        if (isMounted.current) {
          setState((prev) => ({ ...prev, isLoading: false, isRefreshing: false }));
        }
      } finally {
        inFlight.current = false;
      }
    },
    [state.limit]
  );

  const loadNext = useCallback(() => {
    setState((prev) => {
      const canLoad = prev.hasMore && !prev.isLoading && !prev.isRefreshing;
      if (canLoad) {
        queueMicrotask(() => load(prev.page + 1, 'append'));
      }
      return prev;
    });
  }, [load]);

  const refresh = useCallback(() => load(initialPage, 'refresh'), [load, initialPage]);

  const reset = useCallback(() => {
    setState({
      data: [],
      page: initialPage,
      limit: initialLimit,
      total: 0,
      hasMore: true,
      isLoading: false,
      isRefreshing: false,
    });
    load(initialPage, 'refresh');
  }, [load, initialPage, initialLimit]);

  useEffect(() => {
    if (autoLoad) {
      load(initialPage, 'refresh');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { ...state, loadNext, refresh, reset };
}