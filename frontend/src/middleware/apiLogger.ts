/**
 * Structured, environment-aware logging utility.
 * Prepends [FoodLog] prefix, timestamps, and automatically suppresses info level logs in production.
 */

const isProd = import.meta.env.PROD;

export const apiLogger = {
  /**
   * General info/debug logging.
   * Suppressed in production builds.
   */
  info(message: string, ...optionalParams: any[]) {
    if (isProd) return;
    console.log(
      `%c[FoodLog] [INFO] [${new Date().toISOString()}] ${message}`,
      'color: #3b82f6; font-weight: bold;',
      ...optionalParams
    );
  },

  /**
   * Warning logs (e.g., fallback paths, cached data returns).
   * Always visible.
   */
  warn(message: string, ...optionalParams: any[]) {
    console.warn(
      `%c[FoodLog] [WARN] [${new Date().toISOString()}] ${message}`,
      'color: #f59e0b; font-weight: bold;',
      ...optionalParams
    );
  },

  /**
   * Critical error logs.
   * Always visible.
   */
  error(message: string, ...optionalParams: any[]) {
    console.error(
      `%c[FoodLog] [ERROR] [${new Date().toISOString()}] ${message}`,
      'color: #ef4444; font-weight: bold;',
      ...optionalParams
    );
  }
};
