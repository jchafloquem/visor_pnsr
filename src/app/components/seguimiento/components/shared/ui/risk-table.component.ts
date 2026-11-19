import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SspAuthService } from '../../../core/auth/auth.service';
import { CORTE_FECHA } from '../../../core/config/institutional.constants';
import { LayoutStore } from '../../../core/layout/layout.store';
import { SspDomainStore } from '../../cartera/data-access/ssp-domain.store';
import {
  diffDays,
  formatDateShort,
} from '../../cartera/domain/project-projection.rules';
import { NivelRiesgo, RiesgoSsp } from '../../cartera/models/ssp.models';
import { isActiveRisk } from '../../riesgos/domain/risk.rules';

@Component({
  selector: 'app-risk-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './risk-table.component.html',
  styleUrl: './risk-table.component.css',
})
export class RiskTableComponent {
  private readonly store = inject(SspDomainStore);
  private readonly auth = inject(SspAuthService);
  private readonly layout = inject(LayoutStore);

  readonly risks = input.required<readonly RiesgoSsp[]>();
  readonly showProject = input<boolean>(true);

  readonly enrichedRows = computed(() => {
    const byCui = this.store.projectByCui();
    return this.risks().map((r) => {
      const p = byCui[r.cui];
      const level = this.store.getRiskLevel(r);
      const score = this.store.getRiskScore(r);
      const doneCount = r.acc.filter((a) => a.est === 'Atendida').length;
      const progressPct = r.acc.length ? (doneCount / r.acc.length) * 100 : 0;
      const h = p?.hitos.find((x) => x.id === r.hito);
      const hitoLabel = h ? `${h.h} · ${formatDateShort(h.f)}` : '';
      return {
        r,
        level,
        score,
        doneCount,
        progressPct,
        hitoLabel,
        projectCorto: p ? p.corto : r.cui,
        uoLabel: p ? this.auth.formatAreaLabel(p.uo) : '',
        flimFormatted: formatDateShort(r.flim),
        isActive: isActiveRisk(r),
        isExpired: diffDays(r.flim, CORTE_FECHA) < 0,
      };
    });
  });

  openRisk(id: string): void {
    this.layout.openDrawer({
      kind: 'risk',
      key: id,
      id,
      label: `Volver al riesgo ${id}`,
    });
  }

  getBadgeClass(level: NivelRiesgo): string {
    switch (level) {
      case 'CRÍTICO':
        return 'bg-risk-crit text-white';
      case 'ALTA':
        return 'bg-risk-high-bg text-risk-high-text';
      case 'MODERADA':
        return 'bg-risk-mid-bg text-risk-mid-text';
      case 'BAJA':
        return 'bg-risk-low-bg text-risk-low-text';
    }
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'Materializado':
        return 'bg-risk-high-bg text-risk-high-text';
      case 'Cerrado':
      case 'Rechazado':
        return 'bg-surface-subtle text-ink-muted';
      case 'Propuesto':
        return 'bg-risk-mid-bg text-risk-mid-text';
      default:
        return 'bg-azul-soft text-azul-institucional-dark';
    }
  }
}
