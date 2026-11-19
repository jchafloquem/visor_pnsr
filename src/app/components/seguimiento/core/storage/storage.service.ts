import { Injectable } from '@angular/core';
import { INSTITUTIONAL_CONFIG } from '../config/institutional.constants';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly prefix = INSTITUTIONAL_CONFIG.storagePrefix;

  private isAvailable(): boolean {
    try {
      return (
        typeof window !== 'undefined' &&
        typeof window.localStorage !== 'undefined' &&
        typeof window.localStorage.getItem === 'function'
      );
    } catch {
      return false;
    }
  }

  get<T>(key: string, fallback: T): T {
    if (!this.isAvailable()) {
      return fallback;
    }
    try {
      const raw = window.localStorage.getItem(this.prefix + key);
      if (raw === null) {
        return fallback;
      }
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    if (!this.isAvailable()) {
      return;
    }
    try {
      window.localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      // Ignora cuotas excedidas o modos privados restringidos
    }
  }

  remove(key: string): void {
    if (!this.isAvailable()) {
      return;
    }
    try {
      window.localStorage.removeItem(this.prefix + key);
    } catch {
      // Ignora errores de acceso
    }
  }

  clearAll(): void {
    if (!this.isAvailable()) {
      return;
    }
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        window.localStorage.removeItem(k);
      }
    } catch {
      // Ignora errores de acceso
    }
  }
}
