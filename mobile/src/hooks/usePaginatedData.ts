// mobile/src/hooks/usePaginatedData.ts
import { useState, useEffect, useCallback, useRef } from 'react';

export interface PaginationState {
  page: number;
  limit: number;
  hasMore: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  data: any[];
  total: number;
}

export interface UsePaginatedDataOptions {
  initialPage?: number;
  initialLimit?: number;
  autoLoad?: boolean;
  dependency?: any[];
}

export function usePaginatedData<T>(
  fetchFn: (page: number, limit: number) => Promise<{ data: T[]; total: number }>,
  options: UsePaginatedDataOptions = {}
) {
  const {
    initialPage = 1,
    initialLimit = 10,
    autoLoad = true,
    dependency = [],
  } = options;

  const [state, setState] = useState<PaginationState>({
    page: initialPage,
    limit: initialLimit,
    hasMore: true,
    isLoading: false,
    isRefreshing: false,
    data: [],
    total: 0,
  });

  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadData = useCallback(
    async (page: number, refresh: boolean = false) => {
      if (!isMounted.current) return;

      setState((prev) => ({
        ...prev,
        isLoading: !refresh,
        isRefreshing: refresh,
      }));

      try {
        const result = await fetchFn(page, state.limit);

        if (!isMounted.current) return;

        setState((prev) => ({
          ...prev,
          data: refresh ? result.data : [...prev.data, ...result.data],
          total: result.total,
          page,
          hasMore: result.data.length === state.limit,
          isLoading: false,
          isRefreshing: false,
        }));
      } catch (error) {
        console.error('Error loading data:', error);
        if (isMounted.current) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isRefreshing: false,
          }));
        }
      }
    },
    [fetchFn, state.limit]
  );

  const loadNext = useCallback(() => {
    if (state.hasMore && !state.isLoading && !state.isRefreshing) {
      loadData(state.page + 1, false);
    }
  }, [state.hasMore, state.isLoading, state.isRefreshing, state.page, loadData]);

  const refresh = useCallback(() => {
    loadData(initialPage, true);
  }, [loadData, initialPage]);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      page: initialPage,
      hasMore: true,
      data: [],
      total: 0,
    }));
    loadData(initialPage, true);
  }, [loadData, initialPage]);

  // Auto load on mount
  useEffect(() => {
    if (autoLoad) {
      loadData(initialPage, true);
    }
  }, [...dependency]);

  return {
    ...state,
    loadNext,
    refresh,
    reset,
    loadData,
  };
}