import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SspAuthService } from '../../../core/auth/auth.service';
import { LayoutStore } from '../../../core/layout/layout.store';
import { UNIDADES_OPERATIVAS } from '../../../data/seed-projects.data';
import { RiskMatrixComponent } from '../../shared/ui/risk-matrix.component';
import { SspDomainStore } from '../../cartera/data-access/ssp-domain.store';
import {
  ImpactoLabel,
  ProbabilidadLabel,
  UnidadOperativa,
} from '../../cartera/models/ssp.models';
import {
  IMPACTO_LABELS,
  isActiveRisk,
  PROBABILIDAD_LABELS,
} from '../../riesgos/domain/risk.rules';

@Component({
  selector: 'app-parametros-page',
  standalone: true,
  imports: [RouterLink, RiskMatrixComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[18px] w-full min-w-0' },
  templateUrl: './parametros-page.component.html',
  styleUrl: './parametros-page.component.css',
})
export class ParametrosPageComponent {
  readonly store = inject(SspDomainStore);
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);

  readonly params = this.store.parametros;
  readonly unidades = UNIDADES_OPERATIVAS;
  readonly probabilidadLabels = PROBABILIDAD_LABELS;
  readonly impactoLabels = IMPACTO_LABELS;
  readonly diasOptions = [5, 15, 30];

  readonly selectedExcCui = signal<string>('');
  readonly newCategory = signal<string>('');

  readonly activeRisks = computed(() =>
    this.store.riesgos().filter((r) => isActiveRisk(r))
  );

  readonly exceptionRows = computed(() => {
    const exc = this.params().exc;
    const byCui = this.store.projectByCui();
    return Object.keys(exc).map((cui) => ({
      cui,
      corto: byCui[cui]?.corto || cui,
      hito: exc[cui].hito,
      accion: exc[cui].accion,
    }));
  });

  readonly availableExceptionProjects = computed(() => {
    const exc = this.params().exc;
    return this.store.proyectos().filter((p) => !exc[p.cui]);
  });

  readonly effectiveExcCui = computed(() => {
    const avail = this.availableExceptionProjects();
    const cur = this.selectedExcCui();
    if (avail.some((p) => p.cui === cur)) return cur;
    return avail[0]?.cui || '';
  });

  onUpdateProb(pLab: ProbabilidadLabel, event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    if (isNaN(val)) return;
    this.store.updateParametros((pr) => ({
      ...pr,
      P: { ...pr.P, [pLab]: val },
    }));
    this.layout.showToast('Listo: todo el sistema se recalculó');
  }

  onUpdateImp(iLab: ImpactoLabel, event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    if (isNaN(val)) return;
    this.store.updateParametros((pr) => ({
      ...pr,
      I: { ...pr.I, [iLab]: val },
    }));
    this.layout.showToast('Listo: todo el sistema se recalculó');
  }

  onUpdateCutoff(key: 'cBaja' | 'cAlta', event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    if (isNaN(val)) return;
    this.store.updateParametros((pr) => ({
      ...pr,
      [key]: val,
    }));
    this.layout.showToast('Listo: todo el sistema se recalculó');
  }

  onUpdateUoDias(u: UnidadOperativa, kind: 'hito' | 'accion', event: Event): void {
    const days = Number((event.target as HTMLSelectElement).value);
    if (Number.isNaN(days)) return;
    this.store.updateParametros((pr) => ({
      ...pr,
      dias: {
        ...pr.dias,
        [u]: { ...pr.dias[u], [kind]: days },
      },
    }));
  }

  onUpdateExcDias(cui: string, kind: 'hito' | 'accion', event: Event): void {
    const days = Number((event.target as HTMLSelectElement).value);
    if (Number.isNaN(days)) return;
    this.store.updateParametros((pr) => ({
      ...pr,
      exc: {
        ...pr.exc,
        [cui]: { ...pr.exc[cui], [kind]: days },
      },
    }));
  }

  onExcCuiChange(event: Event): void {
    this.selectedExcCui.set((event.target as HTMLSelectElement).value);
  }

  onNewCategoryInput(event: Event): void {
    this.newCategory.set((event.target as HTMLInputElement).value);
  }

  addException(): void {
    const cui = this.effectiveExcCui();
    if (!cui) return;
    this.store.updateParametros((pr) => ({
      ...pr,
      exc: { ...pr.exc, [cui]: { hito: 5, accion: 5 } },
    }));
  }

  removeException(cui: string): void {
    this.store.updateParametros((pr) => {
      const nextExc = { ...pr.exc };
      delete nextExc[cui];
      return { ...pr, exc: nextExc };
    });
  }

  addCategory(): void {
    const val = this.newCategory().trim();
    if (!val || this.params().cats.includes(val)) return;
    this.store.updateParametros((pr) => ({
      ...pr,
      cats: [...pr.cats, val],
    }));
    this.newCategory.set('');
  }

  resetOece(): void {
    this.store.resetParametrosOece();
    this.layout.showToast('Valores OECE restablecidos');
  }
}
