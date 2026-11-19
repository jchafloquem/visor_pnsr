import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SspHeaderComponent } from './header.component';

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

describe('SspHeaderComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders search input, filters corpus, and closes dropdown on outside click', () => {
    TestBed.configureTestingModule({
      imports: [SspHeaderComponent],
      providers: [provideRouter([])],
    });

    const fixture = TestBed.createComponent(SspHeaderComponent);
    fixture.componentRef.setInput('searchCorpus', [
      {
        kind: 'proj',
        id: '2451001',
        title: 'Chota Rural',
        subtitle: 'CUI 2451001 · Cajamarca',
        icon: 'drop',
      },
    ]);
    fixture.componentRef.setInput('criticalAlertsCount', 3);
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    const inputEl = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    expect(inputEl).toBeTruthy();

    inputEl.value = 'Chota';
    inputEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(comp.searchOpen()).toBe(true);
    expect(comp.filteredResults().length).toBe(1);

    // Click outside search root dismisses dropdown
    document.body.click();
    fixture.detectChanges();
    expect(comp.searchOpen()).toBe(false);
  });
});
