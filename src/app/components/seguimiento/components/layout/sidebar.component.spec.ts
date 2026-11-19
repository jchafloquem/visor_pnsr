import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SspAuthService } from '../../core/auth/auth.service';
import { LayoutStore } from '../../core/layout/layout.store';
import { SspSidebarComponent } from './sidebar.component';

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

describe('SspSidebarComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hides Parámetros for non-UPP users and shows it for UPP', () => {
    TestBed.configureTestingModule({
      imports: [SspSidebarComponent],
      providers: [provideRouter([])],
    });

    const auth = TestBed.inject(SspAuthService);
    const fixture = TestBed.createComponent(SspSidebarComponent);

    const nonUpp = auth.allUsers.find((u) => u.rol !== 'upp')!;
    const upp = auth.allUsers.find((u) => u.rol === 'upp')!;

    auth.loginAsUser(nonUpp.id);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Parámetros');

    auth.loginAsUser(upp.id);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Parámetros');
  });

  it('updates navMode and emits toast feedback', () => {
    TestBed.configureTestingModule({
      imports: [SspSidebarComponent],
      providers: [provideRouter([])],
    });

    const layout = TestBed.inject(LayoutStore);
    const toastSpy = vi.spyOn(layout, 'showToast');
    const fixture = TestBed.createComponent(SspSidebarComponent);
    fixture.detectChanges();

    fixture.componentInstance.setMode('iconos');
    expect(layout.navMode()).toBe('iconos');
    expect(toastSpy).toHaveBeenCalledWith(
      'Menú solo con íconos: se abre al pasar el mouse',
    );
  });
});
