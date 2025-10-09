/**
 * MetricsService - Collects and batches metrics from the frontend and sends them to the backend API
 * which then forwards them to VictoriaMetrics.
 */

export interface Metric {
  type: 'error' | 'page_view' | 'message_sent' | 'google_api_request' | 'api_latency' | 'active_users';
  labels: Record<string, string>;
  value?: number;
  timestamp?: number;
}

interface MetricsServiceConfig {
  batchSize: number;
  flushInterval: number; // milliseconds
  maxRetries: number;
  enabled: boolean;
}

class MetricsServiceClass {
  private buffer: Metric[] = [];
  private config: MetricsServiceConfig;
  private flushIntervalId: number | null = null;
  private isInitialized = false;
  private baseUrl: string;

  constructor() {
    // Check privacy settings on initialization
    const shareAnalytics = this.getPrivacySetting();
    
    this.config = {
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      maxRetries: 3,
      enabled: shareAnalytics,
    };

    // Get the base URL from environment or use current location
    const basePath = (import.meta.env.BASE_URL || '/fidu-chat-lab').replace(/\/$/, '');
    this.baseUrl = `${basePath}/api/metrics`;
    
    // Listen for settings changes
    this.setupSettingsListener();
  }
  
  /**
   * Get the current privacy setting for analytics
   */
  private getPrivacySetting(): boolean {
    try {
      const stored = localStorage.getItem('fidu-chat-lab-settings');
      if (stored) {
        const settings = JSON.parse(stored);
        return settings.privacySettings?.shareAnalytics ?? true;
      }
    } catch (error) {
      console.warn('Failed to read privacy settings:', error);
    }
    return true; // Default to enabled
  }
  
  /**
   * Setup a listener for settings changes
   */
  private setupSettingsListener(): void {
    if (typeof window === 'undefined') return;
    
    // Listen for storage events (when settings change in another tab)
    window.addEventListener('storage', (e) => {
      if (e.key === 'fidu-chat-lab-settings') {
        const shareAnalytics = this.getPrivacySetting();
        if (shareAnalytics !== this.config.enabled) {
          if (shareAnalytics) {
            this.enable();
            console.log('📊 [MetricsService] Metrics collection enabled by user preference');
          } else {
            this.disable();
            console.log('🔒 [MetricsService] Metrics collection disabled by user preference');
          }
        }
      }
    });
  }


  /**
   * Initialize the metrics service
   */
  public initialize(): void {
    if (this.isInitialized) {
      return;
    }

    console.log('📊 [MetricsService] Initializing...');
    
    // Check privacy setting again on initialization
    const shareAnalytics = this.getPrivacySetting();
    this.config.enabled = shareAnalytics;
    
    if (!shareAnalytics) {
      console.log('🔒 [MetricsService] Metrics collection disabled by user preference');
      this.isInitialized = true;
      return;
    }

    // Start periodic flush
    this.flushIntervalId = window.setInterval(() => {
      this.flush();
    }, this.config.flushInterval);

    // Flush on page unload (use sendBeacon for reliability)
    window.addEventListener('beforeunload', () => {
      this.flushSync();
    });

    // Flush on visibility change (user switches tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flush();
      }
    });

    this.isInitialized = true;
    console.log('✅ [MetricsService] Initialized successfully (metrics enabled)');
  }

  /**
   * Record a metric
   */
  public record(metric: Metric): void {
    // Check if service is disabled
    if (!this.config.enabled) {
      return;
    }

    // Add timestamp if not provided
    const metricWithTimestamp: Metric = {
      ...metric,
      timestamp: metric.timestamp || Date.now(),
    };

    this.buffer.push(metricWithTimestamp);

    // Flush if buffer is full
    if (this.buffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Record an error metric
   */
  public recordError(errorType: string, page: string, additionalLabels?: Record<string, string>): void {
    this.record({
      type: 'error',
      labels: {
        error_type: errorType,
        page,
        ...additionalLabels,
      },
    });
  }

  /**
   * Record a page view
   */
  public recordPageView(page: string): void {
    this.record({
      type: 'page_view',
      labels: {
        page,
      },
    });
  }

  /**
   * Record a message sent to an AI model
   */
  public recordMessageSent(model: string, status: 'success' | 'error' = 'success'): void {
    this.record({
      type: 'message_sent',
      labels: {
        model,
        status,
      },
    });
  }

  /**
   * Record a Google API request
   */
  public recordGoogleApiRequest(
    api: string,
    operation: string,
    status: 'success' | 'error' = 'success'
  ): void {
    this.record({
      type: 'google_api_request',
      labels: {
        api,
        operation,
        status,
      },
    });
  }

  /**
   * Record API latency
   */
  public recordApiLatency(endpoint: string, latencySeconds: number): void {
    this.record({
      type: 'api_latency',
      labels: {
        endpoint,
      },
      value: latencySeconds,
    });
  }

  /**
   * Set the number of active users
   */
  public setActiveUsers(count: number): void {
    this.record({
      type: 'active_users',
      labels: {},
      value: count,
    });
  }

  /**
   * Flush metrics asynchronously (preferred method)
   */
  public async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const metricsToSend = [...this.buffer];
    this.buffer = [];

    console.log(`📤 [MetricsService] Flushing ${metricsToSend.length} metrics...`);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics: metricsToSend,
        }),
      });

      if (!response.ok) {
        console.error(`❌ [MetricsService] Failed to send metrics: ${response.status} ${response.statusText}`);
        // Put metrics back in buffer for retry (up to max retries)
        this.buffer.unshift(...metricsToSend);
      } else {
        const result = await response.json();
        console.log(`✅ [MetricsService] Successfully sent ${result.processed} metrics`);
      }
    } catch (error) {
      console.error('❌ [MetricsService] Error sending metrics:', error);
      // Put metrics back in buffer for retry
      this.buffer.unshift(...metricsToSend);
    }
  }

  /**
   * Flush metrics synchronously using sendBeacon (for page unload)
   */
  private flushSync(): void {
    if (this.buffer.length === 0) {
      return;
    }

    const metricsToSend = [...this.buffer];
    this.buffer = [];

    console.log(`📤 [MetricsService] Sync flushing ${metricsToSend.length} metrics...`);

    // Use sendBeacon for reliable delivery during page unload
    const blob = new Blob(
      [
        JSON.stringify({
          metrics: metricsToSend,
        }),
      ],
      {
        type: 'application/json',
      }
    );

    const success = navigator.sendBeacon(this.baseUrl, blob);

    if (!success) {
      console.warn('⚠️  [MetricsService] sendBeacon failed');
    }
  }

  /**
   * Update configuration
   */
  public configure(config: Partial<MetricsServiceConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    // Restart flush interval if it changed
    if (config.flushInterval && this.flushIntervalId !== null) {
      window.clearInterval(this.flushIntervalId);
      this.flushIntervalId = window.setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  /**
   * Disable metrics collection
   */
  public disable(): void {
    this.config.enabled = false;
    if (this.flushIntervalId !== null) {
      window.clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
  }

  /**
   * Enable metrics collection
   */
  public enable(): void {
    this.config.enabled = true;
    if (this.flushIntervalId === null) {
      this.flushIntervalId = window.setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  /**
   * Get current buffer size
   */
  public getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Clear the buffer
   */
  public clearBuffer(): void {
    this.buffer = [];
  }
}

// Export singleton instance
export const MetricsService = new MetricsServiceClass();

// Auto-initialize on import (can be disabled if needed)
if (typeof window !== 'undefined') {
  MetricsService.initialize();
}

