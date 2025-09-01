import { useEffect, useRef, useCallback } from 'react';

interface PerformanceMetricsData {
  renderTime: number;
  renderCount: number;
  averageRenderTime: number;
  lastRenderTime: number;
}

interface PerformanceMetrics extends PerformanceMetricsData {
  resetMetrics: () => void;
  getMetrics: () => PerformanceMetricsData;
  logSummary: () => void;
}

interface UsePerformanceMonitorOptions {
  componentName: string;
  enabled?: boolean;
  logToConsole?: boolean;
  threshold?: number; // Log warnings if render time exceeds this threshold
}

export const usePerformanceMonitor = ({
  componentName,
  enabled = process.env.NODE_ENV === 'development',
  logToConsole = true,
  threshold = 16 // 16ms = 60fps threshold
}: UsePerformanceMonitorOptions): PerformanceMetrics => {
  const renderStartTime = useRef<number>(0);
  const metrics = useRef<PerformanceMetricsData>({
    renderTime: 0,
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderTime: 0
  });

  // Start timing render
  const startRender = useCallback(() => {
    if (enabled) {
      renderStartTime.current = performance.now();
    }
  }, [enabled]);

  // End timing render
  const endRender = useCallback(() => {
    if (enabled) {
      const renderTime = performance.now() - renderStartTime.current;
      const current = metrics.current;
      
      current.renderCount++;
      current.lastRenderTime = renderTime;
      current.renderTime = renderTime;
      current.averageRenderTime = (current.averageRenderTime * (current.renderCount - 1) + renderTime) / current.renderCount;

      // Log performance warnings
      if (logToConsole && renderTime > threshold) {
        console.warn(
          `🚨 Performance Warning: ${componentName} took ${renderTime.toFixed(2)}ms to render ` +
          `(threshold: ${threshold}ms). Consider optimizing this component.`
        );
      }

      // Log detailed metrics in development
      if (logToConsole && process.env.NODE_ENV === 'development') {
        console.log(
          `📊 ${componentName} Performance:`,
          `Render #${current.renderCount}`,
          `Time: ${renderTime.toFixed(2)}ms`,
          `Avg: ${current.averageRenderTime.toFixed(2)}ms`
        );
      }
    }
  }, [enabled, logToConsole, threshold, componentName]);

  // Monitor render performance
  useEffect(() => {
    startRender();
    
    // Use requestAnimationFrame to measure after render is complete
    const rafId = requestAnimationFrame(() => {
      endRender();
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  });

  // Reset metrics
  const resetMetrics = useCallback(() => {
    if (enabled) {
      metrics.current = {
        renderTime: 0,
        renderCount: 0,
        averageRenderTime: 0,
        lastRenderTime: 0
      };
    }
  }, [enabled]);

  // Get current metrics
  const getMetrics = useCallback((): PerformanceMetricsData => {
    return { ...metrics.current };
  }, []);

  // Log summary
  const logSummary = useCallback(() => {
    if (enabled && logToConsole) {
      const current = metrics.current;
      console.log(
        `📈 ${componentName} Performance Summary:`,
        `Total Renders: ${current.renderCount}`,
        `Average Time: ${current.averageRenderTime.toFixed(2)}ms`,
        `Last Render: ${current.lastRenderTime.toFixed(2)}ms`
      );
    }
  }, [enabled, logToConsole, componentName]);

  return {
    ...metrics.current,
    resetMetrics,
    getMetrics,
    logSummary
  };
};
