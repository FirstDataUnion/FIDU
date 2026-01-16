/**
 * Error Tracking Utility
 * Captures and reports errors to the metrics service
 */

import { MetricsService } from '../services/metrics/MetricsService';

/**
 * Get the current page/route name
 */
function getCurrentPage(): string {
  const path = window.location.pathname;
  const basePath = '/fidu-chat-lab';

  // Remove base path if present
  let cleanPath = path.startsWith(basePath)
    ? path.substring(basePath.length)
    : path;

  // Remove leading slash
  cleanPath = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;

  // Use route name or default to 'root'
  return cleanPath || 'root';
}

/**
 * Extract error type from error object
 */
function getErrorType(error: any): string {
  if (error instanceof TypeError) {
    return 'TypeError';
  }
  if (error instanceof ReferenceError) {
    return 'ReferenceError';
  }
  if (error instanceof SyntaxError) {
    return 'SyntaxError';
  }
  if (error instanceof RangeError) {
    return 'RangeError';
  }
  if (error?.name) {
    return error.name;
  }
  return 'UnknownError';
}

/**
 * Initialize global error tracking
 */
export function initializeErrorTracking(): void {
  // Track uncaught errors
  window.addEventListener('error', event => {
    const errorType = getErrorType(event.error);
    const page = getCurrentPage();

    console.error('🔴 [ErrorTracking] Uncaught error:', event.error);

    MetricsService.recordError(errorType, page, {
      message: event.message,
      filename: event.filename || 'unknown',
      lineno: String(event.lineno || 0),
      colno: String(event.colno || 0),
    });
  });

  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', event => {
    const errorType = 'UnhandledPromiseRejection';
    const page = getCurrentPage();

    console.error(
      '🔴 [ErrorTracking] Unhandled promise rejection:',
      event.reason
    );

    MetricsService.recordError(errorType, page, {
      reason: String(event.reason),
    });
  });

  console.log('✅ [ErrorTracking] Global error tracking initialized');
}

/**
 * Manually track an error
 */
export function trackError(error: any, context?: Record<string, string>): void {
  const errorType = getErrorType(error);
  const page = getCurrentPage();

  MetricsService.recordError(errorType, page, {
    message: error?.message || String(error),
    ...context,
  });
}

/**
 * Track API errors specifically
 */
export function trackApiError(
  endpoint: string,
  statusCode: number,
  errorMessage?: string
): void {
  const page = getCurrentPage();

  MetricsService.recordError('ApiError', page, {
    endpoint,
    status_code: String(statusCode),
    message: errorMessage || 'API request failed',
  });
}

/**
 * Track storage errors
 */
export function trackStorageError(
  adapter: string,
  operation: string,
  errorMessage: string
): void {
  const page = getCurrentPage();

  MetricsService.recordError('StorageError', page, {
    adapter,
    operation,
    message: errorMessage,
  });
}

/**
 * Track authentication errors
 */
export function trackAuthError(provider: string, errorMessage: string): void {
  const page = getCurrentPage();

  MetricsService.recordError('AuthError', page, {
    provider,
    message: errorMessage,
  });
}
