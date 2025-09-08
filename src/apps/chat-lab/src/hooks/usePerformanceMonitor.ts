import { useEffect, useRef, useCallback } from 'react';

// Helper function to get environment variables - can be mocked in tests
const getEnvVar = (key: string): boolean => {
  // Check if we're in a test environment (Jest sets NODE_ENV to 'test')
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    // In test environment, return false for all env vars to disable performance monitoring
    return false;
  }
  
  // In browser/Vite environment, use import.meta.env
  return (globalThis as any).import?.meta?.env?.[key] ?? false;
};

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

/**
 * Performance monitoring hook for React components.
 * 
 * ⚠️ DEVELOPMENT ONLY: This hook is automatically disabled in production builds
 * to prevent any performance impact on end users.
 * 
 * @param componentName - Name of the component being monitored
 * @param enabled - Whether monitoring is enabled (defaults to DEV mode)
 * @param logToConsole - Whether to log metrics to console
 * @param threshold - Performance threshold in milliseconds (default: 16ms = 60fps)
 */
export const usePerformanceMonitor = ({
  componentName,
  enabled = getEnvVar('DEV'),
  logToConsole = true,
  threshold = 16 // 16ms = 60fps threshold
}: UsePerformanceMonitorOptions): PerformanceMetrics => {
  // Force disable in production builds for safety
  const isProduction = getEnvVar('PROD');
  const isActuallyEnabled = enabled && !isProduction;
  const renderStartTime = useRef<number>(0);
  const metrics = useRef<PerformanceMetricsData>({
    renderTime: 0,
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderTime: 0
  });

  // Start timing render
  const startRender = useCallback(() => {
    if (isActuallyEnabled) {
      renderStartTime.current = performance.now();
    }
  }, [isActuallyEnabled]);

  // End timing render
  const endRender = useCallback(() => {
    if (isActuallyEnabled) {
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
      if (logToConsole && getEnvVar('DEV')) {
        console.log(
          `📊 ${componentName} Performance:`,
          `Render #${current.renderCount}`,
          `Time: ${renderTime.toFixed(2)}ms`,
          `Avg: ${current.averageRenderTime.toFixed(2)}ms`
        );
      }
    }
  }, [isActuallyEnabled, logToConsole, threshold, componentName]);

  // Monitor render performance
  useEffect(() => {
    if (!isActuallyEnabled) return;
    
    startRender();
    
    // Use requestAnimationFrame to measure after render is complete
    const rafId = requestAnimationFrame(() => {
      endRender();
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isActuallyEnabled, startRender, endRender]);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    if (isActuallyEnabled) {
      metrics.current = {
        renderTime: 0,
        renderCount: 0,
        averageRenderTime: 0,
        lastRenderTime: 0
      };
    }
  }, [isActuallyEnabled]);

  // Get current metrics
  const getMetrics = useCallback((): PerformanceMetricsData => {
    return { ...metrics.current };
  }, []);

  // Log summary
  const logSummary = useCallback(() => {
    if (isActuallyEnabled && logToConsole) {
      const current = metrics.current;
      console.log(
        `📈 ${componentName} Performance Summary:`,
        `Total Renders: ${current.renderCount}`,
        `Average Time: ${current.averageRenderTime.toFixed(2)}ms`,
        `Last Render: ${current.lastRenderTime.toFixed(2)}ms`
      );
    }
  }, [isActuallyEnabled, logToConsole, componentName]);

  return {
    ...metrics.current,
    resetMetrics,
    getMetrics,
    logSummary
  };
};
