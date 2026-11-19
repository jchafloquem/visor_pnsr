import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SspAuthService } from '../../../core/auth/auth.service';
import { CORTE_FECHA } from '../../../core/config/institutional.constants';
import { LayoutStore } from '../../../core/layout/layout.store';
import { IconComponent } from '../../shared/icons/icon.component';
import { SspDomainStore } from '../../cartera/data-access/ssp-domain.store';
import {
  computeProyeccion,
  formatDateShort,
  formatMillions,
} from '../../cartera/domain/project-projection.rules';
import { ProyectoSsp } from '../../cartera/models/ssp.models';

@Component({
  selector: 'app-priorizados-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[18px] w-full min-w-0' },
  templateUrl: './priorizados-page.component.html',
  styleUrl: './priorizados-page.component.css',
})
export class PriorizadosPageComponent {
  readonly store = inject(SspDomainStore);
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);

  private checkLlega(p: ProyectoSsp): { llega: boolean | null; fecha: string | null } {
    if (!p.priX || p.priX.meta !== 'Culminar la obra' || p.fis == null || p.ritmo == null) {
      return { llega: null, fecha: null };
    }
    if (!p.ritmo) return { llega: false, fecha: null };
    const o = computeProyeccion(p, CORTE_FECHA);
    return {
      llega: o.fecha ? o.fecha <= p.priX.fm : null,
      fecha: o.fecha,
    };
  }

  readonly prioritizedRows = computed(() => {
    return this.store
      .proyectos()
      .filter((p) => !!p.pri && !!p.priX)
      .slice()
      .sort((a, b) => (a.pri > b.pri ? 1 : -1))
      .map((p) => {
        const res = this.checkLlega(p);
        return {
          p,
          priX: p.priX!,
          llega: res.llega,
          projFecha: res.fecha,
        };
      });
  });

  readonly nonPrioritizedProjects = computed(() =>
    this.store.proyectos().filter((p) => !p.pri)
  );

  readonly kpis = computed(() => {
    const rows = this.prioritizedRows();
    const cm = rows.filter((r) => r.p.pri === 'Compromiso');
    const ct = rows.filter((r) => r.p.pri === 'Contingencia');
    const pim = cm.reduce((a, r) => a + r.p.pim, 0);
    const dev = cm.reduce((a, r) => a + r.p.dev, 0);
    const noLlegan = rows.filter((r) => r.llega === false).length;
    return {
      compromisosCount: cm.length,
      contingenciasCount: ct.length,
      pim,
      dev,
      execPct: pim ? ((dev / pim) * 100).toFixed(1) : '0.0',
      noLleganCount: noLlegan,
    };
  });

  readonly sortedHistory = computed(() => {
    const byCui = this.store.projectByCui();
    return this.store
      .priorizadosHist()
      .slice()
      .sort((a, b) => (a.f < b.f ? 1 : -1))
      .map((h) => ({
        h,
        projectCorto: byCui[h.cui]?.corto || h.cui,
        dotClass:
          h.acc === 'Inclusión'
            ? 'before:bg-verde-eficiencia'
            : h.acc === 'Retiro'
              ? 'before:bg-rojo-nacional'
              : 'before:bg-risk-mid',
      }));
  });

  formatDate(iso: string | undefined | null): string {
    return formatDateShort(iso);
  }

  formatMillions(amount: number): string {
    return formatMillions(amount);
  }

  openProject(cui: string): void {
    const p = this.store.getProject(cui);
    this.layout.openDrawer({
      kind: 'proj',
      key: cui,
      cui,
      tab: 'res',
      label: `Volver a ${p ? p.corto : cui}`,
    });
  }

  openPriorizadoDrawer(cui: string | undefined, modo: 'nuevo' | 'edit' | 'out'): void {
    this.layout.openDrawer({
      kind: 'pri',
      key: `${cui || ''}-${modo}`,
      cui,
      modo,
      label: 'Volver a la priorización',
    });
  }
}
