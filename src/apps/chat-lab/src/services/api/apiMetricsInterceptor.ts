/**
 * API Metrics Interceptor
 * Tracks API latency and errors for monitoring
 */

import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { MetricsService } from '../metrics/MetricsService';
import { trackApiError } from '../../utils/errorTracking';

// Store request start times
const requestTimings = new Map<string, number>();

/**
 * Check if user has opted out of metrics collection
 */
function isUserOptedOut(): boolean {
  try {
    const stored = localStorage.getItem('fidu-chat-lab-settings');
    if (stored) {
      const settings = JSON.parse(stored);
      // If shareAnalytics is false, user has opted out
      return settings.privacySettings?.shareAnalytics === false;
    }
  } catch (error) {
    console.warn('[Metrics] Failed to check user opt-out preference:', error);
  }
  // Default to opted in (collect metrics)
  return false;
}

/**
 * Generate a unique request ID for timing tracking
 */
function generateRequestId(config: InternalAxiosRequestConfig): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Extract endpoint from URL for metrics (simplified)
 */
function getEndpointFromUrl(url?: string): string {
  if (!url) return 'unknown';
  
  try {
    // Remove query parameters and fragments
    const cleanUrl = url.split('?')[0].split('#')[0];
    
    // Extract path
    const urlObj = new URL(cleanUrl, 'http://dummy');
    const path = urlObj.pathname;
    
    // Simplify path by removing IDs (UUIDs, numeric IDs)
    const simplifiedPath = path
      .split('/')
      .map(segment => {
        // Replace UUIDs with :id
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
          return ':id';
        }
        // Replace numeric IDs with :id
        if (/^\d+$/.test(segment)) {
          return ':id';
        }
        return segment;
      })
      .join('/');
    
    return simplifiedPath || '/';
  } catch (e) {
    return url;
  }
}

/**
 * Request interceptor to track start time
 */
export function metricsRequestInterceptor(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const requestId = generateRequestId(config);
  
  // Store start time
  requestTimings.set(requestId, Date.now());
  
  // Attach request ID to config for response matching
  config.headers.set('X-Request-ID', requestId);
  
  return config;
}

/**
 * Response interceptor to track latency
 */
export function metricsResponseInterceptor(response: AxiosResponse): AxiosResponse {
  // Skip if user has opted out
  if (isUserOptedOut()) {
    return response;
  }

  const requestId = response.config.headers.get('X-Request-ID') as string;
  const startTime = requestTimings.get(requestId);
  
  if (startTime) {
    const latency = (Date.now() - startTime) / 1000; // Convert to seconds
    const endpoint = getEndpointFromUrl(response.config.url);
    
    // Record latency metric
    MetricsService.recordApiLatency(endpoint, latency);
    
    // Clean up timing data
    requestTimings.delete(requestId);
    
    console.log(`📊 [Metrics] API latency: ${endpoint} - ${latency.toFixed(3)}s`);
  }
  
  return response;
}

/**
 * Error interceptor to track API errors
 */
export function metricsErrorInterceptor(error: AxiosError): Promise<AxiosError> {
  // Skip if user has opted out
  if (isUserOptedOut()) {
    return Promise.reject(error);
  }

  const requestId = error.config?.headers?.get('X-Request-ID') as string;
  
  // Track timing even for errors
  if (requestId) {
    const startTime = requestTimings.get(requestId);
    if (startTime) {
      const latency = (Date.now() - startTime) / 1000;
      const endpoint = getEndpointFromUrl(error.config?.url);
      
      MetricsService.recordApiLatency(endpoint, latency);
      requestTimings.delete(requestId);
    }
  }
  
  // Track error
  if (error.response) {
    const endpoint = getEndpointFromUrl(error.config?.url);
    const statusCode = error.response.status;
    const errorMessage = error.message || 'API request failed';
    
    trackApiError(endpoint, statusCode, errorMessage);
    
    console.error(`🔴 [Metrics] API error: ${endpoint} - ${statusCode} - ${errorMessage}`);
  }
  
  return Promise.reject(error);
}

/**
 * Setup metrics interceptors on an Axios instance
 */
export function setupMetricsInterceptors(axiosInstance: AxiosInstance): void {
  // Request interceptor (runs before auth interceptor if added first)
  axiosInstance.interceptors.request.use(
    metricsRequestInterceptor,
    (error) => Promise.reject(error)
  );
  
  // Response interceptor (runs after auth interceptor if added last)
  axiosInstance.interceptors.response.use(
    metricsResponseInterceptor,
    metricsErrorInterceptor
  );
  
  console.log('✅ [Metrics] API metrics interceptors installed');
}

