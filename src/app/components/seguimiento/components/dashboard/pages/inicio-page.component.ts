import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SspAuthService } from '../../../core/auth/auth.service';
import { CORTE_FECHA } from '../../../core/config/institutional.constants';
import { LayoutStore } from '../../../core/layout/layout.store';
import { UNIDADES_OPERATIVAS } from '../../../data/seed-projects.data';
import { IconComponent } from '../../shared/icons/icon.component';
import { IconName } from '../../shared/icons/icon-registry';
import { CountUpComponent } from '../../shared/ui/count-up/count-up.component';
import {
  MatrixCellEvent,
  RiskMatrixComponent,
} from '../../shared/ui/risk-matrix.component';
import { RiskTableComponent } from '../../shared/ui/risk-table.component';
import {
  MapaComponent,
  MapaProjectPoint,
  MapaSeverityFilter,
} from '../../shared/visualizations/mapa/mapa.component';
import {
  PriFilterValue,
  SspDomainStore,
} from '../../cartera/data-access/ssp-domain.store';
import {
  computeProyeccion,
  diffDays,
  formatDateShort,
  formatMillions,
  isAtrasado,
  isSegOk,
} from '../../cartera/domain/project-projection.rules';
import { EstadoProyecto, UnidadOperativa } from '../../cartera/models/ssp.models';
import {
  isActiveRisk,
  isCritRisk,
  nivelFromScore,
  scoreRisk,
} from '../../riesgos/domain/risk.rules';

interface PendingItem {
  top?: number;
  t: string;
  s: string;
  f: string;
  action: 'seg' | 'risk' | 'proj' | 'comp';
  cui?: string;
  id?: string;
}

const ESTADO_LEGEND: ReadonlyArray<{ estado: EstadoProyecto; colorVar: string }> = [
  { estado: 'En ejecución', colorVar: 'var(--color-azul-institucional)' },
  { estado: 'En elaboración', colorVar: 'var(--color-celeste-agua)' },
  { estado: 'Suspendida', colorVar: 'var(--color-risk-mid)' },
  { estado: 'Paralizada', colorVar: 'var(--color-rojo-nacional)' },
];

@Component({
  selector: 'app-inicio-page',
  standalone: true,
  imports: [IconComponent, CountUpComponent, MapaComponent, RiskMatrixComponent, RiskTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[18px] w-full min-w-0' },
  templateUrl: './inicio-page.component.html',
  styleUrl: './inicio-page.component.css',
})
export class InicioPageComponent {
  readonly store = inject(SspDomainStore);
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);
  private readonly router = inject(Router);

  readonly corte = CORTE_FECHA;
  readonly unidades = UNIDADES_OPERATIVAS;
  readonly estadoLegend = ESTADO_LEGEND;

  readonly mapSeverityFilter = signal<MapaSeverityFilter>('todos');

  readonly priOptions: ReadonlyArray<{ value: PriFilterValue; label: string }> = [
    { value: '', label: 'Toda la cartera' },
    { value: 'todos', label: 'Priorizados' },
    { value: 'Compromiso', label: 'Compromisos' },
    { value: 'Contingencia', label: 'Contingencias' },
  ];

  readonly greeting = computed(() => {
    const me = this.auth.currentUser();
    return me.rol === 'dir' ? 'Bienvenido, Director' : 'Hola, ' + me.nombre.split(' ')[0];
  });

  readonly activeVisibleRisks = computed(() => {
    const cuiSet = new Set(this.store.visibleProyectos().map((p) => p.cui));
    return this.store.riesgos().filter((r) => isActiveRisk(r) && cuiSet.has(r.cui));
  });

  readonly criticalVisibleAlertsCount = computed(
    () => this.store.visibleAlertas().filter((a) => a.sev === 'Crítica').length
  );

  readonly prioritizedCompromisosCount = computed(
    () => this.store.visibleProyectos().filter((p) => p.pri === 'Compromiso').length
  );

  readonly pendingItems = computed<PendingItem[]>(() => {
    const me = this.auth.currentUser();
    const proys = this.store.proyectos();
    const byCui = this.store.projectByCui();
    const risks = this.store.riesgos();
    const comps = this.store.compromisos();
    const segs = this.store.seguimientos();
    const params = this.store.parametros();
    const pend: PendingItem[] = [];

    if (me.rol === 'reg') {
      proys
        .filter((p) => this.auth.isAssignedToMe(p.uo, p.asig) && !isSegOk(p, segs))
        .forEach((p) =>
          pend.push({
            t: 'Registrar el avance de la semana',
            s: p.corto,
            f: '',
            action: 'seg',
            cui: p.cui,
          })
        );
      risks
        .filter((r) => isActiveRisk(r) && byCui[r.cui]?.uo === me.area)
        .forEach((r) =>
          r.acc.forEach((a) => {
            if (a.est !== 'Atendida' && a.f && diffDays(a.f, CORTE_FECHA) <= 7) {
              pend.push({
                t: a.t,
                s: `${byCui[r.cui]?.corto} · ${r.id}`,
                f: a.f,
                action: 'risk',
                id: r.id,
              });
            }
          })
        );
    } else if (me.rol === 'upp') {
      proys
        .filter((p) => !isSegOk(p, segs))
        .forEach((p) =>
          pend.push({
            t: 'Sin registro semanal',
            s: `${p.corto} · ${this.auth.formatAreaLabel(p.uo)}`,
            f: '',
            action: 'proj',
            cui: p.cui,
          })
        );
      risks
        .filter(
          (r) =>
            isActiveRisk(r) &&
            nivelFromScore(scoreRisk(r, params), params) === 'ALTA' &&
            !r.acc.length
        )
        .forEach((r) =>
          pend.push({
            t: 'Riesgo alto sin plan',
            s: `${byCui[r.cui]?.corto} · ${r.id}`,
            f: r.flim,
            action: 'risk',
            id: r.id,
          })
        );
    } else {
      comps
        .filter((c) => c.est !== 'Cumplido')
        .forEach((c) =>
          pend.push({
            t: c.dec,
            s: `${byCui[c.cui]?.corto} · ${c.resp}`,
            f: c.f,
            action: 'comp',
            id: c.id,
          })
        );
      risks
        .filter((r) => isActiveRisk(r) && isCritRisk(r, params))
        .forEach((r) =>
          pend.push({
            t: 'Decidir: ' + r.evento,
            s: `${byCui[r.cui]?.corto} · ${r.id}`,
            f: r.flim,
            action: 'risk',
            id: r.id,
          })
        );
    }

    if (me.rol === 'reg') {
      risks
        .filter((r) => r.estado === 'Propuesto' && byCui[r.cui]?.uo === me.area)
        .forEach((r) =>
          pend.push({
            top: 1,
            t: 'Revisar riesgo notificado por la UPP',
            s: `${byCui[r.cui]?.corto} · ${r.id}`,
            f: '',
            action: 'risk',
            id: r.id,
          })
        );
      risks
        .filter(
          (r) => isActiveRisk(r) && r.val === 'Observado' && (r.act || r.por) === me.id
        )
        .forEach((r) =>
          pend.push({
            top: 1,
            t: 'Corregir la observación de ' + this.auth.getUserById(r.valBy).nombre,
            s: `${byCui[r.cui]?.corto} · ${r.id}`,
            f: '',
            action: 'risk',
            id: r.id,
          })
        );
      if (me.valida) {
        risks
          .filter(
            (r) => isActiveRisk(r) && r.val === 'Por validar' && byCui[r.cui]?.uo === me.area
          )
          .forEach((r) =>
            pend.push({
              top: 1,
              t: 'Validar riesgo de ' + this.auth.getUserById(r.act || r.por).nombre,
              s: `${byCui[r.cui]?.corto} · ${r.id}`,
              f: '',
              action: 'risk',
              id: r.id,
            })
          );
      }
    }

    if (me.rol === 'upp') {
      risks
        .filter((r) => r.estado === 'Propuesto' && r.por === me.id)
        .forEach((r) =>
          pend.push({
            top: 1,
            t: 'Notificación sin respuesta de ' + this.auth.formatAreaLabel(byCui[r.cui]?.uo || ''),
            s: `${byCui[r.cui]?.corto} · ${r.id}`,
            f: '',
            action: 'risk',
            id: r.id,
          })
        );
    }

    return pend.sort(
      (a, b) => (b.top ? 1 : 0) - (a.top ? 1 : 0) || ((a.f || '9') > (b.f || '9') ? 1 : -1)
    );
  });

  readonly kpiSummary = computed(() => {
    const ps = this.store.visibleProyectos();
    const pr = ps.filter((p) => p.pri === 'Compromiso');
    const pcg = ps.filter((p) => p.pri === 'Contingencia');
    const prPim = pr.reduce((a, p) => a + p.pim, 0);
    const prDev = pr.reduce((a, p) => a + p.dev, 0);
    return {
      prCount: pr.length,
      pcgCount: pcg.length,
      prExecPct: prPim ? ((prDev / prPim) * 100).toFixed(1) : '0',
    };
  });

  readonly standardKpiCards = computed<
    ReadonlyArray<{
      icon: IconName;
      iconWrapClass: string;
      valueColorClass: string;
      label: string;
      value: number;
      decimals: number;
      suffix: string;
      sub: string;
      route: string;
      goText: string;
    }>
  >(() => {
    const ps = this.store.visibleProyectos();
    const act = this.activeVisibleRisks();
    const al = this.store.visibleAlertas();
    const params = this.store.parametros();

    const pim = ps.reduce((a, p) => a + p.pim, 0);
    const dev = ps.reduce((a, p) => a + p.dev, 0);
    const ejec = ps.filter((p) => p.etapa === 'Ejecución de obra').length;
    const estudios = ps.filter(
      (p) => p.etapa === 'Expediente técnico' || p.etapa === 'Ficha técnica'
    ).length;
    const par = ps.filter(
      (p) => p.estado === 'Paralizada' || p.estado === 'Suspendida'
    ).length;
    const atr = ps.filter((p) => isAtrasado(p)).length;
    const altos = act.filter(
      (r) => nivelFromScore(scoreRisk(r, params), params) === 'ALTA'
    ).length;
    const crits = act.filter((r) => isCritRisk(r, params)).length;
    const pc = (dmax: number): number =>
      ps.filter(
        (p) =>
          p.finObra &&
          diffDays(p.finObra, CORTE_FECHA) >= 0 &&
          diffDays(p.finObra, CORTE_FECHA) <= dmax
      ).length;

    return [
      {
        icon: 'drop',
        iconWrapClass: 'bg-azul-soft text-azul-institucional',
        valueColorClass: 'text-azul-institucional',
        label: 'Proyectos en cartera',
        value: ps.length,
        decimals: 0,
        suffix: '',
        sub: `${ejec} en obra · ${estudios} en estudios`,
        route: '/seguimiento/cartera',
        goText: 'Ver proyectos',
      },
      {
        icon: 'money',
        iconWrapClass: 'bg-risk-low-bg text-risk-low-text',
        valueColorClass: 'text-risk-low-text',
        label: 'Ejecución presupuestal',
        value: +(pim ? (dev / pim) * 100 : 0).toFixed(1),
        decimals: 1,
        suffix: ' %',
        sub: `${formatMillions(dev)} de ${formatMillions(pim)}`,
        route: '/seguimiento/cartera',
        goText: 'Ver detalle',
      },
      {
        icon: 'flag',
        iconWrapClass: 'bg-risk-high-bg text-risk-high-text',
        valueColorClass: 'text-risk-high-text',
        label: 'Paralizados o suspendidos',
        value: par,
        decimals: 0,
        suffix: '',
        sub: `${atr} atrasados más de 10 puntos`,
        route: '/seguimiento/cartera',
        goText: 'Ver cuáles',
      },
      {
        icon: 'check',
        iconWrapClass: 'bg-azul-soft text-azul-institucional-dark',
        valueColorClass: 'text-azul-institucional-dark',
        label: 'Por culminar',
        value: pc(30),
        decimals: 0,
        suffix: '',
        sub: `en 30 días · ${pc(60)} en 60 · ${pc(90)} en 90`,
        route: '/seguimiento/cartera',
        goText: 'Ver cuáles',
      },
      {
        icon: 'alert-triangle',
        iconWrapClass: 'bg-risk-high-bg text-risk-high-text',
        valueColorClass: 'text-risk-high-text',
        label: 'Riesgos altos',
        value: altos,
        decimals: 0,
        suffix: '',
        sub: `${crits} críticos (no mitigables)`,
        route: '/seguimiento/riesgos',
        goText: 'Ver riesgos',
      },
      {
        icon: 'bell',
        iconWrapClass: 'bg-risk-mid-bg text-risk-mid-text',
        valueColorClass: 'text-risk-mid-text',
        label: 'Alertas críticas',
        value: al.filter((a) => a.sev === 'Crítica').length,
        decimals: 0,
        suffix: '',
        sub: `${al.length} alertas en total`,
        route: '/seguimiento/alertas',
        goText: 'Ver alertas',
      },
    ];
  });

  readonly mapaPoints = computed<MapaProjectPoint[]>(() => {
    return this.store.visibleProyectos().map((p) => ({
      cui: p.cui,
      corto: p.corto,
      dist: p.dist,
      dep: p.dep,
      uoLabel: this.auth.formatAreaLabel(p.uo),
      lat: p.lat,
      lng: p.lng,
      riskLevel: this.store.getProjectLevel(p.cui),
      activeRiskCount: this.store.getProjectActiveRisks(p.cui).length,
    }));
  });

  readonly unitBreakdown = computed(() => {
    const all = this.store.proyectos();
    return this.unidades.map((uo) => {
      const list = all.filter((p) => p.uo === uo);
      const pim = list.reduce((a, p) => a + p.pim, 0);
      const dev = list.reduce((a, p) => a + p.dev, 0);
      let acc = 0;
      const segments = ESTADO_LEGEND.map(({ estado, colorVar }) => {
        const count = list.filter((p) => p.estado === estado).length;
        const x = acc;
        acc += count;
        return { estado, colorVar, x, width: count };
      }).filter((s) => s.width > 0);
      return {
        uo,
        total: list.length,
        totalSafe: list.length || 1,
        pim,
        dev,
        execPct: pim ? (dev / pim) * 100 : 0,
        segments,
      };
    });
  });

  readonly closingSoonProjects = computed(() => {
    return this.store
      .visibleProyectos()
      .filter(
        (p) =>
          p.finObra &&
          diffDays(p.finObra, CORTE_FECHA) >= 0 &&
          diffDays(p.finObra, CORTE_FECHA) <= 90
      )
      .slice()
      .sort((a, b) => (a.finObra > b.finObra ? 1 : -1))
      .slice(0, 8)
      .map((p) => ({
        p,
        llega: computeProyeccion(p, CORTE_FECHA).llega,
      }));
  });

  readonly matrixFilteredRisks = computed(() => {
    const cell = this.store.matrixCellFilter();
    if (!cell) return [];
    return this.activeVisibleRisks().filter((r) => r.p === cell.p && r.i === cell.i);
  });

  formatDate(iso: string | undefined | null): string {
    return formatDateShort(iso);
  }

  formatMillions(amount: number): string {
    return formatMillions(amount);
  }

  isExpired(iso: string): boolean {
    return !!iso && diffDays(iso, CORTE_FECHA) < 0;
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  toggleUoFilter(uo: UnidadOperativa): void {
    this.store.uoFilter.set(this.store.uoFilter() === uo ? '' : uo);
  }

  onSelectMatrixCell(cell: MatrixCellEvent): void {
    this.store.toggleMatrixCell(cell.p, cell.i);
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

  onPendingClick(item: PendingItem): void {
    if (item.action === 'seg' && item.cui) {
      this.layout.openDrawer({
        kind: 'seg',
        key: item.cui,
        cui: item.cui,
        label: 'Volver al registro semanal',
      });
    } else if (item.action === 'risk' && item.id) {
      this.layout.openDrawer({
        kind: 'risk',
        key: item.id,
        id: item.id,
        label: `Volver al riesgo ${item.id}`,
      });
    } else if (item.action === 'comp' && item.id) {
      this.layout.openDrawer({
        kind: 'comp',
        key: item.id,
        id: item.id,
        label: `Volver al compromiso ${item.id}`,
      });
    } else if (item.cui) {
      this.openProject(item.cui);
    }
  }
}
