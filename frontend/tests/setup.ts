/**
 * Browser globals the storage layer needs, installed before any module under
 * test is imported. `localDb` registers a `storage` listener at module scope,
 * so `window` has to exist by then.
 */

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

const storage = new MemoryStorage();
const globals = globalThis as unknown as Record<string, unknown>;

globals.localStorage = storage;
globals.window = {
  localStorage: storage,
  addEventListener: () => {},
  removeEventListener: () => {},
};

/** Wipes the store between tests. */
export function resetStore(): void {
  storage.clear();
}
