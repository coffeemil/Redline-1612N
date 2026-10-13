import { LEGACY_STORAGE_KEY, STORAGE_KEY } from './config.js';

/**
 * Best-distance persistence.
 *
 * Every access is wrapped because `localStorage` throws in private browsing
 * modes and in sandboxed iframes; a missing high score must never break the
 * game.
 */

/** Minimal storage surface, so tests can inject a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Read the stored best distance, migrating the legacy key if needed. */
export function loadBest(storage: StorageLike | null = defaultStorage()): number {
  if (!storage) return 0;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const value = Number.parseFloat(raw);
      return Number.isFinite(value) && value > 0 ? value : 0;
    }

    const legacy = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      const value = Number.parseFloat(legacy);
      if (Number.isFinite(value) && value > 0) {
        storage.setItem(STORAGE_KEY, String(value));
        return value;
      }
    }
  } catch {
    /* storage unavailable — fall through to 0 */
  }
  return 0;
}

/** Persist the best distance. Silently ignores storage failures. */
export function saveBest(value: number, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* quota or privacy mode — the score simply will not persist */
  }
}
