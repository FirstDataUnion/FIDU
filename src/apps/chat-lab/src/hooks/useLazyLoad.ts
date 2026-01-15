import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

interface UseLazyLoadOptions<T> {
  items: T[];
  pageSize?: number;
  threshold?: number; // Distance from bottom to trigger load
  onLoadMore?: (page: number, items: T[]) => void;
  enabled?: boolean;
}

export const useLazyLoad = <T>({
  items,
  pageSize = 20,
  threshold = 100,
  onLoadMore,
  enabled = true,
}: UseLazyLoadOptions<T>) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  // Calculate paginated items
  const paginatedItems = useMemo(() => {
    const endIndex = currentPage * pageSize;
    return items.slice(0, endIndex);
  }, [items, currentPage, pageSize]);

  // Check if there are more items to load
  useEffect(() => {
    const totalPages = Math.ceil(items.length / pageSize);
    setHasMore(currentPage < totalPages);
  }, [items.length, currentPage, pageSize]);

  // Load more items
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || !enabled) return;

    setIsLoading(true);

    try {
      const nextPage = currentPage + 1;
      const startIndex = currentPage * pageSize;
      const endIndex = nextPage * pageSize;
      const newItems = items.slice(startIndex, endIndex);

      setCurrentPage(nextPage);
      onLoadMore?.(nextPage, newItems);
    } catch (error) {
      console.error('Error loading more items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, items, isLoading, hasMore, enabled, onLoadMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!enabled || !loadingRef.current) return;

    const observer = new IntersectionObserver(
      entries => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      {
        rootMargin: `${threshold}px`,
        threshold: 0.1,
      }
    );

    observer.observe(loadingRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [enabled, hasMore, isLoading, threshold, loadMore]);

  // Reset pagination
  const reset = useCallback(() => {
    setCurrentPage(1);
    setIsLoading(false);
    setHasMore(true);
  }, []);

  // Load specific page
  const goToPage = useCallback(
    (page: number) => {
      if (page < 1 || page > Math.ceil(items.length / pageSize)) return;
      setCurrentPage(page);
    },
    [items.length, pageSize]
  );

  return {
    paginatedItems,
    currentPage,
    isLoading,
    hasMore,
    loadMore,
    reset,
    goToPage,
    loadingRef,
    totalPages: Math.ceil(items.length / pageSize),
  };
};
