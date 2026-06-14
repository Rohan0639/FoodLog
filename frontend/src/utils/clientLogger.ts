/**
 * Environment-aware client-side console logging utility.
 * Suppresses info-level logging in production builds.
 */

const isProd = import.meta.env.PROD;

export const clientLogger = {
  info(message: string, ...optionalParams: any[]) {
    if (isProd) return;
    console.log(
      `%c[FoodLog] [INFO] [${new Date().toLocaleTimeString()}] ${message}`,
      'color: #3b82f6; font-weight: bold;',
      ...optionalParams
    );
  },

  warn(message: string, ...optionalParams: any[]) {
    console.warn(
      `%c[FoodLog] [WARN] [${new Date().toLocaleTimeString()}] ${message}`,
      'color: #f59e0b; font-weight: bold;',
      ...optionalParams
    );
  },

  error(message: string, ...optionalParams: any[]) {
    console.error(
      `%c[FoodLog] [ERROR] [${new Date().toLocaleTimeString()}] ${message}`,
      'color: #ef4444; font-weight: bold;',
      ...optionalParams
    );
  }
};
