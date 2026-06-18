import { GeminiResponse } from '../../shared/types';

const cache = new Map<string, GeminiResponse>();

export function getCache(key: string): GeminiResponse | undefined {
  return cache.get(key);
}

export function setCache(key: string, value: GeminiResponse): void {
  cache.set(key, value);
}
