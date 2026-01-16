import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import { Box } from '@mui/material';

interface VirtualListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
}

function VirtualList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  overscan = 5,
  className,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(height / itemHeight);
    const end = start + visibleCount;

    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length, end + overscan),
    };
  }, [scrollTop, height, itemHeight, items.length, overscan]);

  // Calculate total height for scrollbar
  const totalHeight = items.length * itemHeight;

  // Handle scroll events
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, []);

  // Auto-scroll to top when items change
  useEffect(() => {
    scrollToTop();
  }, [items.length, scrollToTop]);

  // Render only visible items
  const visibleItems = useMemo(() => {
    const { start, end } = visibleRange;
    const itemsToRender = [];

    for (let i = start; i < end; i++) {
      if (items[i]) {
        itemsToRender.push(
          <Box
            key={i}
            style={{
              position: 'absolute',
              top: i * itemHeight,
              height: itemHeight,
              width: '100%',
            }}
          >
            {renderItem(items[i], i)}
          </Box>
        );
      }
    }

    return itemsToRender;
  }, [items, visibleRange, itemHeight, renderItem]);

  return (
    <Box
      ref={containerRef}
      className={className}
      style={{
        height,
        overflow: 'auto',
        position: 'relative',
      }}
      onScroll={handleScroll}
    >
      <Box style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems}
      </Box>
    </Box>
  );
}

export default React.memo(VirtualList) as <T>(
  props: VirtualListProps<T>
) => React.ReactElement;
