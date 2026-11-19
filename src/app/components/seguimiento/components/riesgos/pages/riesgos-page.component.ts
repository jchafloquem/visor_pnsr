import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SspAuthService } from '../../../core/auth/auth.service';
import { UNIDADES_OPERATIVAS } from '../../../data/seed-projects.data';
import { RiskTableComponent } from '../../shared/ui/risk-table.component';
import { SspDomainStore } from '../../cartera/data-access/ssp-domain.store';
import { NivelRiesgo } from '../../cartera/models/ssp.models';
import { isActiveRisk } from '../domain/risk.rules';

@Component({
  selector: 'app-riesgos-page',
  standalone: true,
  imports: [RouterLink, RiskTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[18px] w-full min-w-0' },
  templateUrl: './riesgos-page.component.html',
  styleUrl: './riesgos-page.component.css',
})
export class RiesgosPageComponent {
  readonly store = inject(SspDomainStore);
  readonly auth = inject(SspAuthService);

  readonly unidades = UNIDADES_OPERATIVAS;
  readonly filters = this.store.riskFilters;

  readonly nivelOptions: ReadonlyArray<{ value: '' | NivelRiesgo; label: string }> = [
    { value: '', label: 'Todos' },
    { value: 'CRÍTICO', label: 'Crítico' },
    { value: 'ALTA', label: 'Alta' },
    { value: 'MODERADA', label: 'Moderada' },
    { value: 'BAJA', label: 'Baja' },
  ];

  readonly estadoOptions = [
    { value: 'act', label: 'Activos' },
    { value: '', label: 'Todos' },
    { value: 'val', label: 'Por validar u observados' },
    { value: 'Propuesto', label: 'Propuestos por la UPP' },
    { value: 'Identificado', label: 'Identificado' },
    { value: 'En tratamiento', label: 'En tratamiento' },
    { value: 'Materializado', label: 'Materializado' },
    { value: 'Cerrado', label: 'Cerrado' },
    { value: 'Rechazado', label: 'Rechazados' },
  ];

  onSearchInput(event: Event): void {
    this.store.updateRiskFilter('q', (event.target as HTMLInputElement).value);
  }

  onEstadoChange(event: Event): void {
    this.store.updateRiskFilter('est', (event.target as HTMLSelectElement).value);
  }

  readonly filteredRisks = computed(() => {
    const f = this.filters();
    const cell = this.store.matrixCellFilter();
    const cat = this.store.catFilter();
    const byCui = this.store.projectByCui();
    const q = f.q.trim().toLowerCase();

    return this.store
      .roleScopedRiesgos()
      .filter((r) => {
        const p = byCui[r.cui];
        if (!p) return false;
        const l = this.store.getRiskLevel(r);
        if (f.uo && p.uo !== f.uo) return false;
        if (f.niv && l !== f.niv) return false;
        if (f.est === 'act' && !isActiveRisk(r)) return false;
        if (f.est === 'val') {
          if (!(isActiveRisk(r) && (r.val === 'Por validar' || r.val === 'Observado'))) {
            return false;
          }
        } else if (f.est && f.est !== 'act' && r.estado !== f.est) {
          return false;
        }
        if (cell && !(r.p === cell.p && r.i === cell.i)) return false;
        if (cat && !r.cats.includes(cat)) return false;
        if (q) {
          const hay =
            `${r.id} ${p.corto} ${p.cui} ${r.causa} ${r.evento} ${r.consec} ${r.cats.join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => this.store.getRiskScore(b) - this.store.getRiskScore(a));
  });
}
