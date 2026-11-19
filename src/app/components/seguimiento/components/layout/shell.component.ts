import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { Usuario } from '../../core/auth/auth.models';
import { SspAuthService } from '../../core/auth/auth.service';
import { LayoutStore } from '../../core/layout/layout.store';
import { SspDomainStore } from '../cartera/data-access/ssp-domain.store';
import { IconComponent } from '../shared/icons/icon.component';
import { DrawerHostComponent } from './drawer-host.component';
import { SspFooterComponent } from './footer.component';
import {
  BellAlertItem,
  GlobalSearchItem,
  SspHeaderComponent,
} from './header.component';
import { SspSidebarComponent } from './sidebar.component';
import { SspToastComponent } from './toast.component';

@Component({
  selector: 'app-ssp-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SspHeaderComponent,
    SspSidebarComponent,
    SspFooterComponent,
    SspToastComponent,
    DrawerHostComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class SspShellComponent {
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);
  readonly store = inject(SspDomainStore);
  private readonly router = inject(Router);

  readonly searchCorpus = computed<GlobalSearchItem[]>(() => {
    const byCui = this.store.projectByCui();
    const cs: GlobalSearchItem[] = this.store.compromisos().map((c) => ({
      kind: 'comp',
      id: c.id,
      title: `${c.id} · ${c.dec}`,
      subtitle: `Compromiso · ${byCui[c.cui]?.corto || c.cui}`,
      icon: 'check',
    }));
    const ps: GlobalSearchItem[] = this.store.proyectos().map((p) => ({
      kind: 'proj',
      id: p.cui,
      title: p.corto,
      subtitle: `Proyecto · ${p.dist}, ${p.dep} · CUI ${p.cui}`,
      icon: 'drop',
    }));
    const rs: GlobalSearchItem[] = this.store.riesgos().map((r) => ({
      kind: 'risk',
      id: r.id,
      title: `${r.id} · ${r.evento}`,
      subtitle: `Riesgo · ${byCui[r.cui]?.corto || r.cui}`,
      icon: 'alert-triangle',
    }));
    return [...cs, ...ps, ...rs];
  });

  readonly topBellAlerts = computed<BellAlertItem[]>(() => {
    return this.store
      .roleAlertas()
      .slice(0, 6)
      .map((a, idx) => ({
        id: `${a.k}-${a.p.cui}-${idx}`,
        cui: a.p.cui,
        riskId: a.rk?.id,
        severity: a.sev,
        title: a.txt,
        subtitle: `${a.p.corto} · ${a.sit}`,
      }));
  });

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.layout.isDrawerOpen()) {
      this.layout.closeDrawer();
    }
    this.layout.closePopovers();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.layout.activePopover() && !this.layout.fabOpen()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target || !target.closest('[data-popover-root]')) {
      this.layout.closePopovers();
    }
  }

  onUserSwitched(user: Usuario): void {
    this.store.uoFilter.set('');
    if (user.rol !== 'upp' && this.router.url.startsWith('/seguimiento/parametros')) {
      this.router.navigate(['/seguimiento/dashboard']);
    }
  }

  onSelectSearchItem(item: GlobalSearchItem): void {
    if (item.kind === 'proj') {
      const p = this.store.getProject(item.id);
      this.layout.openDrawer({
        kind: 'proj',
        key: item.id,
        cui: item.id,
        tab: 'res',
        label: `Volver a ${p ? p.corto : item.id}`,
      });
    } else if (item.kind === 'risk') {
      this.layout.openDrawer({
        kind: 'risk',
        key: item.id,
        id: item.id,
        label: `Volver al riesgo ${item.id}`,
      });
    } else {
      this.layout.openDrawer({
        kind: 'comp',
        key: item.id,
        id: item.id,
        label: `Volver al compromiso ${item.id}`,
      });
    }
  }

  onSelectAlertItem(alert: BellAlertItem): void {
    if (alert.riskId) {
      this.layout.openDrawer({
        kind: 'risk',
        key: alert.riskId,
        id: alert.riskId,
        label: `Volver al riesgo ${alert.riskId}`,
      });
    } else {
      const p = this.store.getProject(alert.cui);
      this.layout.openDrawer({
        kind: 'proj',
        key: alert.cui,
        cui: alert.cui,
        tab: 'res',
        label: `Volver a ${p ? p.corto : alert.cui}`,
      });
    }
  }

  onResetDemoData(): void {
    this.store.resetAllDemoData();
    this.layout.closeDrawer();
    this.layout.showToast('Datos de ejemplo restablecidos');
  }

  onFabAction(action: 'seg' | 'risk' | 'comp'): void {
    this.layout.closePopovers();
    const currentDrawerCui = this.layout.currentDrawer()?.cui;
    if (action === 'seg') {
      this.router.navigate(['/seguimiento/avance-semanal']);
    } else if (action === 'risk') {
      this.layout.openDrawer({
        kind: 'risk',
        key: 'n-' + (currentDrawerCui || ''),
        cui: currentDrawerCui,
        label: 'Volver al nuevo riesgo',
      });
    } else {
      this.layout.openDrawer({
        kind: 'comp',
        key: 'n-' + (currentDrawerCui || ''),
        cui: currentDrawerCui,
        label: 'Volver al nuevo compromiso',
      });
    }
  }
}
