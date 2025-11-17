/**
 * Mock for MetricsService
 * Used in Jest tests to avoid import.meta issues
 */

export interface MetricData {
  name: string;
  value: number;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export class MetricsService {
  private enabled = false;

  constructor(shareAnalytics: boolean = false) {
    this.enabled = shareAnalytics;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  async recordMetric(_metric: MetricData): Promise<void> {
    // Mock implementation - do nothing
  }

  async recordPageView(_path: string): Promise<void> {
    // Mock implementation - do nothing
  }

  async recordError(_error: Error, _context?: Record<string, any>): Promise<void> {
    // Mock implementation - do nothing
  }

  async recordTiming(_name: string, _duration: number): Promise<void> {
    // Mock implementation - do nothing
  }

  async flush(): Promise<void> {
    // Mock implementation - do nothing
  }

  static recordGoogleApiRequest(_service: string, _operation: string, _status: string): void {
    // Mock implementation - do nothing
  }
}

