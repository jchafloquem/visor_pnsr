import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SspAuthService } from '../../core/auth/auth.service';
import { Usuario } from '../../core/auth/auth.models';
import { INSTITUTIONAL_CONFIG } from '../../core/config/institutional.constants';
import { LayoutStore } from '../../core/layout/layout.store';
import { IconComponent } from '../shared/icons/icon.component';
import { IconName } from '../shared/icons/icon-registry';

export interface GlobalSearchItem {
  kind: 'proj' | 'risk' | 'comp';
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
}

export interface BellAlertItem {
  id: string;
  cui: string;
  riskId?: string;
  severity: 'Crítica' | 'Alta' | 'Media';
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-ssp-header',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class SspHeaderComponent {
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);
  private readonly router = inject(Router);
  readonly config = INSTITUTIONAL_CONFIG;

  readonly searchCorpus = input<GlobalSearchItem[]>([]);
  readonly topAlerts = input<BellAlertItem[]>([]);
  readonly criticalAlertsCount = input<number>(0);

  readonly selectSearchItem = output<GlobalSearchItem>();
  readonly selectAlertItem = output<BellAlertItem>();
  readonly userSwitched = output<Usuario>();
  readonly resetDemoData = output<void>();

  readonly query = signal<string>('');
  readonly activeIndex = signal<number>(-1);
  readonly searchDismissed = signal<boolean>(false);

  readonly filteredResults = computed<GlobalSearchItem[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (q.length < 2) return [];
    return this.searchCorpus()
      .filter((item) =>
        `${item.id} ${item.title} ${item.subtitle}`.toLowerCase().includes(q),
      )
      .slice(0, 12);
  });

  readonly searchOpen = computed<boolean>(
    () => !this.searchDismissed() && this.query().trim().length >= 2,
  );

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.searchOpen() && (!target || !target.closest('[data-search-root]'))) {
      this.searchDismissed.set(true);
      this.activeIndex.set(-1);
    }
  }

  onQueryInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.query.set(val);
    this.searchDismissed.set(false);
    this.activeIndex.set(-1);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (!this.searchOpen()) return;
    const list = this.filteredResults();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.update((i) => (list.length ? (i + 1) % list.length : -1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update((i) =>
        list.length ? (i <= 0 ? list.length - 1 : i - 1) : -1,
      );
    } else if (event.key === 'Enter') {
      const idx = this.activeIndex();
      if (idx >= 0 && idx < list.length) {
        event.preventDefault();
        this.selectResult(list[idx]);
      }
    } else if (event.key === 'Escape') {
      this.query.set('');
      this.activeIndex.set(-1);
    }
  }

  selectResult(item: GlobalSearchItem): void {
    this.query.set('');
    this.activeIndex.set(-1);
    this.selectSearchItem.emit(item);
  }

  onAlertClick(alert: BellAlertItem): void {
    this.layout.closePopovers();
    this.selectAlertItem.emit(alert);
  }

  switchUser(user: Usuario): void {
    this.auth.loginAsUser(user.id);
    this.layout.closePopovers();
    this.userSwitched.emit(user);
    this.layout.showToast(`Ahora estás como ${user.nombre}`);
  }

  onResetData(): void {
    this.layout.closePopovers();
    this.resetDemoData.emit();
  }

  onLogout(): void {
    this.layout.closePopovers();
    this.auth.logout();
    this.router.navigate(['/seguimiento/acceso']);
  }
}
