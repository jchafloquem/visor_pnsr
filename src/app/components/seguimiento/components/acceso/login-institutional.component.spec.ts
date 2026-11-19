import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthLoginInstitutionalComponent } from './login-institutional.component';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
  };
}

describe('AuthLoginInstitutionalComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates invalid credentials and navigates on demo user click', () => {
    TestBed.configureTestingModule({
      imports: [AuthLoginInstitutionalComponent],
      providers: [provideRouter([])],
    });

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(AuthLoginInstitutionalComponent);
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    comp.enviar();
    expect(comp.error()).toContain('correo institucional válido');

    const firstDemo = comp.sspAuth.allUsers[0];
    comp.entrarComoDemo(firstDemo);
    expect(comp.error()).toBeNull();
    expect(comp.sspAuth.isLoggedIn()).toBe(true);
    expect(navSpy).toHaveBeenCalledWith(['/seguimiento/dashboard']);
  });
});
