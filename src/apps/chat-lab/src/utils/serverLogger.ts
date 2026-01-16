/**
 * Server-side logging utility for debugging in production
 */

import { getEnvironmentInfo } from './environment';

interface LogData {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

class ServerLogger {
  private isEnabled = true;
  private logQueue: LogData[] = [];
  private isProcessing = false;
  private shouldLogToConsole = true;

  constructor() {
    const envInfo = getEnvironmentInfo();

    // Disable server logging when in local mode (no server to send logs to)
    const isLocalMode = envInfo.storageMode === 'local';

    // Enable server logging in development or when explicitly enabled, but not in local mode
    this.isEnabled =
      !isLocalMode
      && (import.meta.env.DEV
        || import.meta.env.VITE_ENABLE_SERVER_LOGGING === 'true');

    // Determine if we should log to console
    // In development mode, always log to console
    // In production mode, only log to console if VITE_KEEP_CONSOLE_LOGS is true
    this.shouldLogToConsole =
      import.meta.env.DEV || import.meta.env.VITE_KEEP_CONSOLE_LOGS === 'true';
  }

  private async sendToServer(logData: LogData): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const response = await fetch('/fidu-chat-lab/api/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData),
      });

      if (!response.ok) {
        console.warn('Failed to send log to server:', response.statusText);
      }
    } catch (error) {
      console.warn('Failed to send log to server:', error);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.logQueue.length === 0) return;

    this.isProcessing = true;

    while (this.logQueue.length > 0) {
      const logData = this.logQueue.shift();
      if (logData) {
        await this.sendToServer(logData);
      }
    }

    this.isProcessing = false;
  }

  public log(level: LogData['level'], message: string, data?: any): void {
    // Log to console only if enabled
    if (this.shouldLogToConsole) {
      console[level](message, data || '');
    }

    // Add to server queue (if server logging is enabled)
    if (this.isEnabled) {
      this.logQueue.push({ level, message, data });
      // Process queue asynchronously
      this.processQueue();
    }
  }

  public info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  public warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  public error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  public debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  public async getServerLogs(): Promise<any[]> {
    try {
      const response = await fetch('/fidu-chat-lab/api/logs');
      if (response.ok) {
        const result = await response.json();
        return result.logs || [];
      }
    } catch (error) {
      console.warn('Failed to fetch server logs:', error);
    }
    return [];
  }
}

// Export singleton instance
export const serverLogger = new ServerLogger();
