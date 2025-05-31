/**
 * Centralized logging utility for Bandcamp+ extension
 */
export class Logger {
  private static readonly PREFIX = '[Bandcamp+]';

  /**
   * Log an info message
   */
  public static info(message: string, ...args: any[]): void {
    console.log(`${this.PREFIX} ${message}`, ...args);
  }

  /**
   * Log a warning message
   */
  public static warn(message: string, ...args: any[]): void {
    console.warn(`${this.PREFIX} ${message}`, ...args);
  }

  /**
   * Log an error message
   */
  public static error(message: string, ...args: any[]): void {
    console.error(`${this.PREFIX} ${message}`, ...args);
  }

  /**
   * Log a debug message (regular console.log without prefix for debugging)
   */
  public static debug(message: string, ...args: any[]): void {
    console.log(message, ...args);
  }
}
