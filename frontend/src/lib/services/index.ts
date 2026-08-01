/**
 * The application's data API.
 *
 * Components import from here and nowhere else for persistence. Nothing above
 * this layer knows that the store happens to be localStorage.
 */

export * as chatService from './chatService';
export * as favoritesService from './favoritesService';
export * as goalService from './goalService';
export * as logService from './logService';
export * as parseCacheService from './parseCacheService';
export * as profileService from './profileService';
export * as settingsService from './settingsService';
export * as statsService from './statsService';
