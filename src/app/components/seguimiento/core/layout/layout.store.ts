import { computed, inject, Injectable, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';

export type NavMode = 'fijo' | 'iconos' | 'oculto';

export type ActivePopover = 'bell' | 'user' | 'navMode' | null;

export type DrawerKind = 'proj' | 'risk' | 'seg' | 'comp' | 'pri';

export interface DrawerTarget {
  kind: DrawerKind;
  key: string;
  label: string;
  cui?: string;
  id?: string | null;
  tab?: string;
  hitoId?: string;
  modo?: 'nuevo' | 'edit' | 'out';
}

@Injectable({ providedIn: 'root' })
export class LayoutStore {
  private readonly storage = inject(StorageService);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly navMode = signal<NavMode>(
    this.storage.get<NavMode>('navm', 'fijo'),
  );
  readonly navPeek = signal<boolean>(false);
  readonly activePopover = signal<ActivePopover>(null);
  readonly fabOpen = signal<boolean>(false);

  readonly drawerStack = signal<DrawerTarget[]>([]);
  readonly currentDrawer = signal<DrawerTarget | null>(null);
  readonly isDrawerOpen = computed<boolean>(() => this.currentDrawer() !== null);
  readonly previousDrawer = computed<DrawerTarget | null>(() => {
    const stack = this.drawerStack();
    return stack.length > 0 ? stack[stack.length - 1] : null;
  });

  readonly toastMessage = signal<string>('');
  readonly toastVisible = signal<boolean>(false);

  setNavMode(mode: NavMode): void {
    this.navMode.set(mode);
    this.navPeek.set(false);
    this.activePopover.set(null);
    this.storage.set('navm', mode);
  }

  setNavPeek(value: boolean): void {
    this.navPeek.set(value);
  }

  togglePopover(popover: Exclude<ActivePopover, null>): void {
    this.activePopover.update((cur) => (cur === popover ? null : popover));
    this.fabOpen.set(false);
  }

  closePopovers(): void {
    this.activePopover.set(null);
    this.fabOpen.set(false);
  }

  toggleFab(): void {
    this.fabOpen.update((open) => !open);
    this.activePopover.set(null);
  }

  openDrawer(target: DrawerTarget): void {
    const cur = this.currentDrawer();
    if (!cur) {
      this.drawerStack.set([]);
    } else if (!(cur.kind === target.kind && cur.key === target.key)) {
      this.drawerStack.update((s) => [...s, cur]);
    }
    this.currentDrawer.set(target);
    this.closePopovers();
  }

  goBackDrawer(): void {
    const stack = this.drawerStack();
    if (stack.length === 0) {
      this.closeDrawer();
      return;
    }
    const prev = stack[stack.length - 1];
    this.drawerStack.set(stack.slice(0, -1));
    this.currentDrawer.set(prev);
  }

  completeCurrentDrawer(): void {
    if (this.drawerStack().length > 0) {
      this.goBackDrawer();
    } else {
      this.closeDrawer();
    }
  }

  closeDrawer(): void {
    this.drawerStack.set([]);
    this.currentDrawer.set(null);
  }

  showToast(message: string): void {
    this.toastMessage.set(message);
    this.toastVisible.set(true);
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => {
      this.toastVisible.set(false);
    }, 2600);
  }
}
