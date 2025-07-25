/**
 * Centralized logging utility for Bandcamp Workflow Extension
 */
export class Logger {
  private static readonly PREFIX = '[Bandcamp Workflow Extension]';
  
  // Log levels for filtering output
  public static readonly LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    DEBUG: 2,
    TIMING: 3,
  };
  
  // Current log level - set to WARN for production (reduces verbose logging)
  private static currentLogLevel = this.LOG_LEVELS.WARN;
  
  /**
   * Set the current log level
   */
  public static setLogLevel(level: number): void {
    this.currentLogLevel = level;
  }

  /**
   * Get timestamp string for performance tracking
   */
  private static getTimestamp(): string {
    return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm format
  }

  /**
   * Log a warning message with timestamp
   */
  public static warn(message: string, ...args: any[]): void {
    if (this.currentLogLevel >= this.LOG_LEVELS.WARN) {
      console.warn(`${this.PREFIX} [${this.getTimestamp()}] ${message}`, ...args);
    }
  }

  /**
   * Log an error message with timestamp
   */
  public static error(message: string, ...args: any[]): void {
    if (this.currentLogLevel >= this.LOG_LEVELS.ERROR) {
      console.error(`${this.PREFIX} [${this.getTimestamp()}] ${message}`, ...args);
    }
  }

  /**
   * Log a debug message with timestamp (only if log level allows)
   */
  public static debug(message: string, ...args: any[]): void {
    if (this.currentLogLevel >= this.LOG_LEVELS.DEBUG) {
      console.log(`${this.PREFIX} [${this.getTimestamp()}] DEBUG: ${message}`, ...args);
    }
  }

  /**
   * Log timing information for performance analysis (only if log level allows)
   */
  public static timing(operation: string, startTime: number, ...args: any[]): void {
    if (this.currentLogLevel >= this.LOG_LEVELS.TIMING) {
      const duration = Date.now() - startTime;
      console.log(`${this.PREFIX} [${this.getTimestamp()}] TIMING: ${operation} took ${duration}ms`, ...args);
    }
  }

  /**
   * Start a timing operation (only if log level allows)
   */
  public static startTiming(operation: string): number {
    const startTime = Date.now();
    if (this.currentLogLevel >= this.LOG_LEVELS.TIMING) {
      console.log(`${this.PREFIX} [${this.getTimestamp()}] TIMING: Starting ${operation}`);
    }
    return startTime;
  }

  /**
   * Check if debug logging is enabled
   */
  public static isDebugEnabled(): boolean {
    return this.currentLogLevel >= this.LOG_LEVELS.DEBUG;
  }
}
