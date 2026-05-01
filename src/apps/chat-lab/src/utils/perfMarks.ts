/**
 * ChatLab dev-only performance sampling (Vite: `import.meta.env.DEV === true`).
 *
 * **Production builds:** This module’s `setupPerfMarks()` is a no-op, `window.__chatlabPerf`
 * is not installed, and `startPerfMark` / `recordPerfMetric` / `runAfterNextFrame` return
 * immediately without touching `performance` or storing samples. Dead-code elimination may
 * shrink some call sites further; there is no runtime profiling surface in prod.
 *
 * **How to use (local `npm run dev` only):**
 *
 * 1. Turn on collection (either works):
 *    - Append `?chatlabPerf=1` to the URL once, or
 *    - `localStorage.setItem('chatlab_perf_enabled', '1')` and reload.
 * 2. In the devtools console:
 *    - `window.__chatlabPerf.summarize()` — all metrics with count/min/max/p50/p95/p99.
 *    - `window.__chatlabPerf.summarize('app_open_total_ms')` — one metric.
 *    - `window.__chatlabPerf.getSamples('promptlab_open_to_first_paint_ms')` — raw ms values.
 *    - `window.__chatlabPerf.setEnabled(false)` / `setEnabled(true)` — toggle + persist flag.
 *    - `window.__chatlabPerf.clear()` — reset in-memory samples and open marks.
 * 3. Optional long-task logging (Chromium): set
 *    `localStorage.setItem('chatlab_longtask_debug', '1')` and reload. Tasks longer than
 *    ~120ms log as `[ChatLabPerf] Long task detected`. Disable with `'0'` or remove the key.
 *
 * **Where metrics are defined:** Search the codebase for `startPerfMark(` and
 * `recordPerfMetric(` (e.g. `app_open_*`, `promptlab_open_*`, `conversations_open_*`).
 */

type PerfMetricSummary = {
  count: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  over16ms: number;
  over50ms: number;
};

type PerfStore = Record<string, number[]>;

type PerfConsoleApi = {
  setEnabled: (enabled: boolean) => void;
  clear: () => void;
  summarize: (metricName?: string) => PerfMetricSummary | Record<string, PerfMetricSummary> | null;
  getSamples: (metricName: string) => number[];
};

const PERF_ENABLED_STORAGE_KEY = 'chatlab_perf_enabled';
const LONGTASK_DEBUG_STORAGE_KEY = 'chatlab_longtask_debug';
const MAX_SAMPLES_PER_METRIC = 500;
const markStarts = new Map<string, number>();
const perfStore: PerfStore = {};
let longTaskObserverInstalled = false;

declare global {
  interface Window {
    __chatlabPerf?: PerfConsoleApi;
  }
}

const hasWindow = (): boolean => typeof window !== 'undefined';

const isDevBuild = (): boolean => import.meta.env.DEV;

const isDebugProfilingRequested = (): boolean => {
  if (!isDevBuild() || !hasWindow()) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('chatlabPerf') === '1') return true;
  return localStorage.getItem(PERF_ENABLED_STORAGE_KEY) === '1';
};

let enabled = isDebugProfilingRequested();

const percentile = (sortedValues: number[], p: number): number => {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((p / 100) * sortedValues.length))
  );
  return sortedValues[index];
};

const summarizeValues = (values: number[]): PerfMetricSummary => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    over16ms: values.filter(v => v > 16.7).length,
    over50ms: values.filter(v => v > 50).length,
  };
};

const installConsoleApi = (): void => {
  if (!hasWindow() || window.__chatlabPerf) return;
  window.__chatlabPerf = {
    setEnabled(nextEnabled: boolean) {
      if (!isDevBuild()) return;
      enabled = nextEnabled;
      localStorage.setItem(PERF_ENABLED_STORAGE_KEY, nextEnabled ? '1' : '0');
      console.info(
        `[ChatLabPerf] Profiling ${nextEnabled ? 'enabled' : 'disabled'}`
      );
    },
    clear() {
      if (!isDevBuild()) return;
      Object.keys(perfStore).forEach(key => {
        delete perfStore[key];
      });
      markStarts.clear();
      console.info('[ChatLabPerf] Cleared all metric samples');
    },
    summarize(metricName?: string) {
      if (!isDevBuild()) return metricName ? null : {};
      if (metricName) {
        const values = perfStore[metricName];
        return values?.length ? summarizeValues(values) : null;
      }
      return Object.fromEntries(
        Object.entries(perfStore)
          .filter(([, values]) => values.length > 0)
          .map(([name, values]) => [name, summarizeValues(values)])
      );
    },
    getSamples(metricName: string) {
      if (!isDevBuild()) return [];
      return [...(perfStore[metricName] ?? [])];
    },
  };
};

const installLongTaskDebugObserver = (): void => {
  if (!hasWindow() || longTaskObserverInstalled || !('PerformanceObserver' in window)) {
    return;
  }
  if (!isDevBuild()) return;
  if (localStorage.getItem(LONGTASK_DEBUG_STORAGE_KEY) !== '1') return;

  try {
    const observer = new PerformanceObserver(list => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.duration < 120) return;
        const route = window.location.pathname;
        const visibility = document.visibilityState;
        console.warn(
          '[ChatLabPerf] Long task detected',
          {
            name: entry.name,
            durationMs: Math.round(entry.duration * 10) / 10,
            startTimeMs: Math.round(entry.startTime * 10) / 10,
            route,
            visibility,
          }
        );
      });
    });

    // Supported in Chromium; no-op fallback via catch on unsupported types.
    observer.observe({ type: 'longtask', buffered: true } as PerformanceObserverInit);
    longTaskObserverInstalled = true;
    console.info(
      '[ChatLabPerf] Long-task debug active. Disable via localStorage.chatlab_longtask_debug=0'
    );
  } catch (_err) {
    // Ignore if unsupported in current browser/runtime.
  }
};

export const setupPerfMarks = (): void => {
  if (!isDevBuild() || !hasWindow()) return;
  installConsoleApi();
  installLongTaskDebugObserver();
  if (enabled) {
    console.info(
      '[ChatLabPerf] Active. Use window.__chatlabPerf.summarize() for stats.'
    );
  }
};

export const startPerfMark = (metricName: string): string | null => {
  if (!isDevBuild() || !enabled || !hasWindow()) return null;
  const id = `${metricName}-${performance.now().toFixed(3)}`;
  markStarts.set(id, performance.now());
  return id;
};

export const endPerfMark = (markId: string | null): number | null => {
  if (!isDevBuild() || !markId || !enabled || !hasWindow()) return null;
  const start = markStarts.get(markId);
  markStarts.delete(markId);
  if (start === undefined) return null;
  return performance.now() - start;
};

export const recordPerfMetric = (
  metricName: string,
  valueMs: number | null
): void => {
  if (
    !isDevBuild()
    || !enabled
    || !hasWindow()
    || valueMs === null
    || !Number.isFinite(valueMs)
  ) {
    return;
  }
  const next = perfStore[metricName] ?? [];
  next.push(valueMs);
  if (next.length > MAX_SAMPLES_PER_METRIC) {
    next.splice(0, next.length - MAX_SAMPLES_PER_METRIC);
  }
  perfStore[metricName] = next;
};

export const runAfterNextFrame = (callback: () => void): void => {
  if (!isDevBuild() || !enabled || !hasWindow()) return;
  requestAnimationFrame(() => {
    callback();
  });
};
