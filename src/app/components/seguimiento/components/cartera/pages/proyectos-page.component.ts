import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SspAuthService } from '../../../core/auth/auth.service';
import { CORTE_FECHA } from '../../../core/config/institutional.constants';
import { LayoutStore } from '../../../core/layout/layout.store';
import { UNIDADES_OPERATIVAS } from '../../../data/seed-projects.data';
import { IconComponent } from '../../shared/icons/icon.component';
import { computeAlertas } from '../../alertas/domain/alert.rules';
import {
  PriFilterValue,
  ProjectFiltersState,
  ProjectSortField,
  SspDomainStore,
} from '../data-access/ssp-domain.store';
import {
  isAtrasado,
  normalizeSearchText,
} from '../domain/project-projection.rules';
import { NivelRiesgo, ProyectoSsp, UnidadOperativa } from '../models/ssp.models';

const LVR: Record<NivelRiesgo, number> = {
  CRÍTICO: 4,
  ALTA: 3,
  MODERADA: 2,
  BAJA: 1,
};

const PFLAB: Record<string, string> = {
  uo: 'Unidad',
  dep: 'Región',
  prov: 'Provincia',
  dist: 'Distrito',
  etapa: 'Etapa',
  est: 'Estado',
  niv: 'Riesgo',
  culm: '¿Culmina 2026?',
};

const NIVLAB: Record<string, string> = {
  altos: 'Alto y crítico',
  CRÍTICO: 'Crítico',
  ALTA: 'Alto',
  MODERADA: 'Moderado',
  BAJA: 'Bajo',
  sin: 'Sin riesgos',
};

@Component({
  selector: 'app-proyectos-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[18px] w-full min-w-0' },
  templateUrl: './proyectos-page.component.html',
  styleUrl: './proyectos-page.component.css',
})
export class ProyectosPageComponent {
  readonly store = inject(SspDomainStore);
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);

  readonly unidades = UNIDADES_OPERATIVAS;
  readonly filters = this.store.projectFilters;

  readonly sortOptions: ReadonlyArray<{ value: ProjectSortField; label: string }> = [
    { value: 'riesgo', label: 'Mayor riesgo primero' },
    { value: 'desv', label: 'Más atrasados primero' },
    { value: 'ejec', label: 'Menor ejecución primero' },
    { value: 'avance', label: 'Mayor avance primero' },
    { value: 'nombre', label: 'Nombre (A–Z)' },
    { value: 'cui', label: 'CUI' },
  ];

  readonly nivelFilterOptions = Object.keys(NIVLAB).map((k) => ({
    value: k,
    label: NIVLAB[k],
  }));

  readonly priOptions: ReadonlyArray<{ value: PriFilterValue; label: string }> = [
    { value: '', label: 'Toda la cartera' },
    { value: 'todos', label: 'Priorizados' },
    { value: 'Compromiso', label: 'Compromisos' },
    { value: 'Contingencia', label: 'Contingencias' },
  ];

  readonly myAssignedCount = computed(() => {
    const me = this.auth.currentUser();
    return this.store.proyectos().filter((p) => p.asig === me.id).length;
  });

  readonly myUnitCount = computed(() => {
    const me = this.auth.currentUser();
    return this.store.proyectos().filter((p) => p.uo === me.area).length;
  });

  readonly baseProjects = computed<ProyectoSsp[]>(() => {
    const me = this.auth.currentUser();
    const f = this.filters();
    if (me.rol === 'reg') {
      return this.store
        .proyectos()
        .filter((p) => p.uo === me.area && (me.valida || f.mine !== '1' || p.asig === me.id));
    }
    return this.store.proyectos();
  });

  readonly pageSubtitle = computed(() => {
    const me = this.auth.currentUser();
    if (me.rol === 'reg') {
      return me.valida
        ? `Los ${this.baseProjects().length} proyectos de ${this.auth.formatAreaLabel(me.area)}.`
        : `Tus proyectos asignados o toda ${me.area === 'UTP' ? 'la UTP' : 'tu unidad'}.`;
    }
    return `Toda la cartera del PNSR: ${this.store.proyectos().length} proyectos.`;
  });

  private uniqSorted(arr: string[]): string[] {
    return [...new Set(arr)].sort((a, b) => a.localeCompare(b, 'es'));
  }

  readonly depOptions = computed(() => this.uniqSorted(this.baseProjects().map((p) => p.dep)));

  readonly provOptions = computed(() => {
    const dep = this.filters().dep;
    if (!dep) return [];
    return this.uniqSorted(
      this.baseProjects()
        .filter((p) => p.dep === dep)
        .map((p) => p.prov)
    );
  });

  readonly distOptions = computed(() => {
    const { dep, prov } = this.filters();
    if (!prov) return [];
    return this.uniqSorted(
      this.baseProjects()
        .filter((p) => p.dep === dep && p.prov === prov)
        .map((p) => p.dist)
    );
  });

  readonly etapaOptions = computed(() => this.uniqSorted(this.baseProjects().map((p) => p.etapa)));

  readonly estadoOptions = computed(() =>
    this.uniqSorted(this.baseProjects().map((p) => p.estado))
  );

  readonly filteredProjects = computed<ProyectoSsp[]>(() => {
    const f = this.filters();
    const pri = this.store.priFilter();
    const q = normalizeSearchText(f.q.trim());

    return this.baseProjects().filter((p) => {
      if (pri && !(pri === 'todos' ? !!p.pri : p.pri === pri)) return false;
      if (f.uo && p.uo !== f.uo) return false;
      if (f.dep && p.dep !== f.dep) return false;
      if (f.prov && p.prov !== f.prov) return false;
      if (f.dist && p.dist !== f.dist) return false;
      if (f.etapa && p.etapa !== f.etapa) return false;
      if (f.est && p.estado !== f.est) return false;
      if (f.culm && p.culm !== f.culm) return false;
      if (f.niv) {
        const l = this.store.getProjectLevel(p.cui);
        if (f.niv === 'sin') {
          if (l) return false;
        } else if (f.niv === 'altos') {
          if (!(l === 'ALTA' || l === 'CRÍTICO')) return false;
        } else if (l !== f.niv) {
          return false;
        }
      }
      if (q) {
        const hay = normalizeSearchText(
          `${p.cui} ${p.corto} ${p.nombre} ${p.dist} ${p.prov} ${p.dep}`
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  readonly sortedProjects = computed<ProyectoSsp[]>(() => {
    const list = this.filteredProjects().slice();
    const sort = this.filters().sort;
    const dv = (p: ProyectoSsp): number =>
      p.fis != null && p.prog != null ? p.prog - p.fis : -99;
    const ex = (p: ProyectoSsp): number => (p.pim ? p.dev / p.pim : 1);

    const comparators: Record<ProjectSortField, (x: ProyectoSsp, y: ProyectoSsp) => number> = {
      riesgo: (x, y) => {
        const lx = this.store.getProjectLevel(x.cui);
        const ly = this.store.getProjectLevel(y.cui);
        return (
          (ly ? LVR[ly] : 0) - (lx ? LVR[lx] : 0) ||
          (y.pri ? 1 : 0) - (x.pri ? 1 : 0) ||
          dv(y) - dv(x)
        );
      },
      desv: (x, y) => dv(y) - dv(x),
      ejec: (x, y) => ex(x) - ex(y),
      avance: (x, y) => (y.fis == null ? -1 : y.fis) - (x.fis == null ? -1 : x.fis),
      nombre: (x, y) => x.corto.localeCompare(y.corto, 'es'),
      cui: (x, y) => x.cui.localeCompare(y.cui),
    };

    return list.sort(comparators[sort]);
  });

  readonly pageSize = computed(() => (this.store.projectViewMode() === 'tabla' ? 25 : 24));

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.sortedProjects().length / this.pageSize()))
  );

  readonly currentPage = computed(() =>
    Math.max(1, Math.min(this.filters().page, this.totalPages()))
  );

  readonly pageRange = computed(() => {
    const total = this.sortedProjects().length;
    if (!total) return { start: 0, end: 0 };
    const start = (this.currentPage() - 1) * this.pageSize() + 1;
    const end = Math.min(total, start + this.pageSize() - 1);
    return { start, end };
  });

  readonly pageNumbers = computed<Array<number | '…'>>(() => {
    const cur = this.currentPage();
    const pages = this.totalPages();
    const nums: Array<number | '…'> = [];
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - cur) <= 2) {
        nums.push(i);
      } else if (nums[nums.length - 1] !== '…') {
        nums.push('…');
      }
    }
    return nums;
  });

  readonly pagedRows = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    const slice = this.sortedProjects().slice(start, start + this.pageSize());
    const allRisks = this.store.riesgos();
    const params = this.store.parametros();
    const revs = this.store.revisiones();

    return slice.map((p) => {
      const lvl = this.store.getProjectLevel(p.cui);
      const execPct = p.pim ? (p.dev / p.pim) * 100 : 0;
      const activeRisks = this.store.getProjectActiveRisks(p.cui).length;
      const critAlerts = computeAlertas([p], allRisks, params, revs, CORTE_FECHA).filter(
        (a) => a.sev === 'Crítica'
      ).length;
      const riskLabel = lvl
        ? { CRÍTICO: 'Crítico', ALTA: 'Alta', MODERADA: 'Moderada', BAJA: 'Baja' }[lvl]
        : 'Sin riesgos';
      const riskColorVar = lvl
        ? {
            CRÍTICO: 'var(--color-risk-crit)',
            ALTA: 'var(--color-rojo-nacional)',
            MODERADA: 'var(--color-risk-mid)',
            BAJA: 'var(--color-verde-eficiencia)',
          }[lvl]
        : 'var(--color-ink-muted)';

      return {
        p,
        execPct,
        activeRisks,
        critAlerts,
        atras: isAtrasado(p),
        riskLabel,
        riskColorVar,
      };
    });
  });

  readonly activeFilterCount = computed(() => {
    const f = this.filters();
    const keys = Object.keys(PFLAB) as Array<keyof ProjectFiltersState>;
    const count = keys.filter((k) => !!f[k]).length;
    return count + (this.store.priFilter() ? 1 : 0);
  });

  readonly activeFilterPills = computed<Array<{ key: string; label: string }>>(() => {
    const f = this.filters();
    const pri = this.store.priFilter();
    const pills: Array<{ key: string; label: string }> = [];

    if (f.q) {
      pills.push({ key: 'q', label: `Texto: «${f.q}»` });
    }
    for (const k of Object.keys(PFLAB)) {
      const val = f[k as keyof ProjectFiltersState] as string;
      if (val) {
        const display =
          k === 'uo'
            ? this.auth.formatAreaLabel(val)
            : k === 'niv'
              ? NIVLAB[val] || val
              : val;
        pills.push({ key: k, label: `${PFLAB[k]}: ${display}` });
      }
    }
    if (pri) {
      pills.push({
        key: 'pri',
        label: pri === 'todos' ? 'Priorizados' : `${pri}s`,
      });
    }
    return pills;
  });

  readonly stageFacets = computed(() => {
    const fac: Record<string, number> = {};
    for (const p of this.sortedProjects()) {
      fac[p.etapa] = (fac[p.etapa] || 0) + 1;
    }
    return Object.keys(fac)
      .sort((x, y) => fac[y] - fac[x])
      .map((etapa) => ({ etapa, count: fac[etapa] }));
  });

  getCulminaClass(culm: string): string {
    if (culm === 'No') return 'text-risk-high-text';
    if (culm === 'Duda') return 'text-risk-mid-text';
    return 'text-risk-low-text';
  }

  onFilterEvent<K extends keyof ProjectFiltersState>(key: K, event: Event): void {
    const val = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.store.updateProjectFilter(key, val as ProjectFiltersState[K]);
  }

  onDetailsToggle(event: Event): void {
    this.store.projectFiltersOpen.set((event.target as HTMLDetailsElement).open);
  }

  setPriFilter(val: PriFilterValue): void {
    this.store.priFilter.set(val);
    this.store.updateProjectFilter('page', 1);
  }

  removeFilterPill(key: string): void {
    if (key === 'pri') {
      this.store.priFilter.set('');
      this.store.updateProjectFilter('page', 1);
    } else {
      this.store.updateProjectFilter(key as keyof ProjectFiltersState, '' as never);
    }
  }

  toggleStageFacet(etapa: string): void {
    const cur = this.filters().etapa;
    this.store.updateProjectFilter('etapa', cur === etapa ? '' : etapa);
  }

  goToPage(page: number): void {
    this.store.updateProjectFilter('page', page);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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

  openAyudaMemoria(cui: string, event: Event): void {
    event.stopPropagation();
    const p = this.store.getProject(cui);
    this.layout.openDrawer({
      kind: 'proj',
      key: cui,
      cui,
      tab: 'am',
      label: `Volver a ${p ? p.corto : cui}`,
    });
  }
}
