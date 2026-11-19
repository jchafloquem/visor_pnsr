import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageService } from './storage.service';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe('StorageService', () => {
  let service: StorageService;
  let originalLocalStorage: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    });
    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageService);
    service.clearAll();
  });

  afterEach(() => {
    service.clearAll();
    if (originalLocalStorage) {
      Object.defineProperty(window, 'localStorage', originalLocalStorage);
    }
  });

  it('stores, retrieves, removes, and clears prefixed keys without affecting unrelated keys', () => {
    window.localStorage.setItem('unrelated-key', 'keep-me');

    expect(service.get('missing', 'fallback')).toBe('fallback');

    service.set('sample', { count: 42 });
    expect(service.get('sample', { count: 0 })).toEqual({ count: 42 });

    service.remove('sample');
    expect(service.get('sample', null)).toBeNull();

    service.set('a', 1);
    service.set('b', 2);
    service.clearAll();

    expect(service.get('a', null)).toBeNull();
    expect(service.get('b', null)).toBeNull();
    expect(window.localStorage.getItem('unrelated-key')).toBe('keep-me');
  });
});
