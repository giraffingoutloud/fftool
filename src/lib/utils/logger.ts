/**
 * Centralized logging utility for the application
 * Provides consistent logging with different levels and context
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private level: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 log entries in memory

  constructor() {
    // Set log level based on environment
    this.level = this.getLogLevelFromEnv();
  }

  private getLogLevelFromEnv(): LogLevel {
    if (typeof window !== 'undefined') {
      // Browser environment
      const isDev = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
      return isDev ? LogLevel.DEBUG : LogLevel.WARN;
    }
    return LogLevel.INFO;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const levelStr = LogLevel[level];
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${levelStr}] ${message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (level < this.level) {
      return; // Skip logs below current level
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error
    };

    // Store in memory
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest entry
    }

    const formattedMessage = this.formatMessage(level, message, context);

    // Output to console
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, context);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, context);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, context);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, error || context);
        if (error?.stack) {
          console.error(error.stack);
        }
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, contextOrError?: LogContext | Error): void {
    if (contextOrError instanceof Error) {
      this.log(LogLevel.ERROR, message, undefined, contextOrError);
    } else {
      this.log(LogLevel.ERROR, message, contextOrError);
    }
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get recent logs for debugging
   */
  getRecentLogs(count = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear stored logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs to JSON for debugging
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Log CSV parsing specific events
   */
  logCSVParse(filename: string, rowCount: number, errorCount: number = 0): void {
    this.info('CSV Parse Complete', {
      filename,
      rowCount,
      errorCount,
      status: errorCount === 0 ? 'success' : 'partial'
    });
  }

  /**
   * Log data validation events
   */
  logValidation(entityType: string, valid: number, invalid: number): void {
    const level = invalid > 0 ? LogLevel.WARN : LogLevel.INFO;
    this.log(level, `Data Validation: ${entityType}`, {
      valid,
      invalid,
      total: valid + invalid,
      successRate: ((valid / (valid + invalid)) * 100).toFixed(2) + '%'
    });
  }

  /**
   * Performance logging helper
   */
  startTimer(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.debug(`Performance: ${label}`, {
        duration: `${duration.toFixed(2)}ms`
      });
    };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for testing or advanced usage
export { Logger };
export type { LogContext, LogEntry };