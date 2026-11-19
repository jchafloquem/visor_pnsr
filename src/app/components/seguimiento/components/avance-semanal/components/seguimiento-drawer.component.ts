import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { SspAuthService } from '../../../core/auth/auth.service';
import { CORTE_FECHA } from '../../../core/config/institutional.constants';
import { LayoutStore } from '../../../core/layout/layout.store';
import { IconComponent } from '../../shared/icons/icon.component';
import { SspDomainStore } from '../../cartera/data-access/ssp-domain.store';
import {
  diffDays,
  formatDateShort,
} from '../../cartera/domain/project-projection.rules';

@Component({
  selector: 'app-seguimiento-drawer',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col flex-auto min-h-0 overflow-hidden' },
  templateUrl: './seguimiento-drawer.component.html',
  styleUrl: './seguimiento-drawer.component.css',
})
export class SeguimientoDrawerComponent {
  readonly store = inject(SspDomainStore);
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);

  readonly cui = input.required<string>();
  readonly corte = CORTE_FECHA;
  readonly previousDrawer = this.layout.previousDrawer;

  readonly fisValue = signal<number>(0);
  readonly detValue = signal<string>('');
  readonly checkedHitos = signal<Record<string, boolean>>({});
  readonly reviewedRisks = signal<boolean>(false);
  readonly evidenceFile = signal<string>('');

  readonly project = computed(() => this.store.getProject(this.cui()));

  readonly readOnly = computed(() => {
    const p = this.project();
    return p ? !this.auth.canEditUnit(p.uo) : true;
  });

  readonly pendingHitos = computed(() => {
    const p = this.project();
    if (!p) return [];
    return p.hitos
      .filter((h) => h.est !== 'Cumplido' && !h.real)
      .map((h) => ({
        ...h,
        daysLeft: diffDays(h.f, CORTE_FECHA),
      }));
  });

  readonly activeRisks = computed(() => this.store.getProjectActiveRisks(this.cui()));

  readonly activeRisksSummary = computed(() => {
    return this.activeRisks()
      .map((r) => `${r.id} (${this.store.getRiskLevel(r).toLowerCase()})`)
      .join(', ');
  });

  constructor() {
    effect(() => {
      const p = this.project();
      if (!p) return;
      const existingSeg = this.store.seguimientos()[p.cui];
      this.fisValue.set(p.fis ?? 0);
      this.detValue.set(existingSeg?.det || '');
      this.checkedHitos.set({});
      this.reviewedRisks.set(false);
      this.evidenceFile.set('');
    });
  }

  formatDate(iso: string | undefined | null): string {
    return formatDateShort(iso);
  }

  onFisInput(event: Event): void {
    const val = +(event.target as HTMLInputElement).value;
    this.fisValue.set(val);
  }

  onDetInput(event: Event): void {
    this.detValue.set((event.target as HTMLTextAreaElement).value);
  }

  toggleHito(hitoId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.checkedHitos.update((prev) => ({ ...prev, [hitoId]: checked }));
  }

  onReviewToggle(event: Event): void {
    this.reviewedRisks.set((event.target as HTMLInputElement).checked);
  }

  onFileSelected(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    if (file) {
      this.evidenceFile.set(file.name);
      this.layout.showToast('Evidencia adjuntada');
    }
  }

  openNewRisk(): void {
    const p = this.project();
    if (!p) return;
    this.layout.openDrawer({
      kind: 'risk',
      key: 'n-' + p.cui,
      cui: p.cui,
      label: 'Volver al nuevo riesgo',
    });
  }

  saveSeguimiento(): void {
    const p = this.project();
    if (!p) return;
    if (!this.detValue().trim()) {
      this.layout.showToast('Escribe qué pasó esta semana');
      return;
    }

    this.store.saveSeguimiento({
      cui: p.cui,
      fis: p.fis != null ? this.fisValue() : null,
      det: this.detValue().trim(),
      completedHitoIds: this.checkedHitos(),
      reviewedRisks: this.reviewedRisks(),
      ev: this.evidenceFile(),
    });

    this.layout.completeCurrentDrawer();
    this.layout.showToast(
      `Registro de ${p.corto} guardado por ${this.auth.currentUser().nombre}`
    );
  }

  goBack(): void {
    this.layout.goBackDrawer();
  }

  close(): void {
    this.layout.closeDrawer();
  }
}
