/**
 * Centralized logging utility for Bandcamp Workflow Extension
 */
export class Logger {
  private static readonly PREFIX = '[Bandcamp Workflow Extension]';

  /**
   * Get timestamp string for performance tracking
   */
  private static getTimestamp(): string {
    return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm format
  }

  /**
   * Log an info message with timestamp
   */
  public static info(message: string, ...args: any[]): void {
    console.log(`${this.PREFIX} [${this.getTimestamp()}] ${message}`, ...args);
  }

  /**
   * Log a warning message with timestamp
   */
  public static warn(message: string, ...args: any[]): void {
    console.warn(`${this.PREFIX} [${this.getTimestamp()}] ${message}`, ...args);
  }

  /**
   * Log an error message with timestamp
   */
  public static error(message: string, ...args: any[]): void {
    console.error(`${this.PREFIX} [${this.getTimestamp()}] ${message}`, ...args);
  }

  /**
   * Log a debug message with timestamp
   */
  public static debug(message: string, ...args: any[]): void {
    console.log(`${this.PREFIX} [${this.getTimestamp()}] ${message}`, ...args);
  }

  /**
   * Log timing information for performance analysis
   */
  public static timing(operation: string, startTime: number, ...args: any[]): void {
    const duration = Date.now() - startTime;
    console.log(`${this.PREFIX} [${this.getTimestamp()}] ⏱️ ${operation} took ${duration}ms`, ...args);
  }

  /**
   * Start a timing operation
   */
  public static startTiming(operation: string): number {
    const startTime = Date.now();
    console.log(`${this.PREFIX} [${this.getTimestamp()}] ⏱️ Starting ${operation}`);
    return startTime;
  }
}
