import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { SspAuthService } from '../../../core/auth/auth.service';
import { CORTE_FECHA } from '../../../core/config/institutional.constants';
import { StorageService } from '../../../core/storage/storage.service';
import { SEED_COMMITMENTS } from '../../../data/seed-commitments.data';
import { SEED_PARAMS_DEF } from '../../../data/seed-params.data';
import { buildSeedPortfolio, GeneratedSeedPortfolio } from '../../../data/seed-projects.data';
import {
  COORDINATOR_VALIDATOR_BY_UO,
  SEED_RISKS,
  SEED_SUGGESTIONS,
} from '../../../data/seed-risks.data';
import { computeAlertas } from '../../alertas/domain/alert.rules';
import {
  isActiveRisk,
  lvlOfRisk,
  nivelFromScore,
  projectRiskLevel,
  scoreRisk,
  sugForProject,
} from '../../riesgos/domain/risk.rules';
import {
  isAtrasado,
  isSegOk,
  normalizeSearchText,
} from '../domain/project-projection.rules';
import {
  AlertaSsp,
  CompromisoSsp,
  ExportKindCode,
  ExportTraceItem,
  ImpactoLabel,
  NivelRiesgo,
  ParametrosSsp,
  PriorizadoHistItem,
  PriorizadoInfo,
  PriorizadoTipo,
  ProbabilidadLabel,
  ProyectoSsp,
  RiesgoSsp,
  SeguimientoSemanal,
  SeveridadAlerta,
  SugerenciaRiesgoSsp,
  UnidadOperativa,
} from '../models/ssp.models';

export interface SspRepositorySnapshot {
  projects: ProyectoSsp[];
  risks: RiesgoSsp[];
  commitments: CompromisoSsp[];
  seguimientos: Record<string, SeguimientoSemanal>;
  revisiones: Record<string, string>;
  priorizados: Record<string, PriorizadoInfo>;
  priorizadosHist: PriorizadoHistItem[];
  parametros: ParametrosSsp;
  exportTraces: ExportTraceItem[];
  suggestions: SugerenciaRiesgoSsp[];
}

export interface ProyectosRepository {
  loadInitialSnapshot(): SspRepositorySnapshot;
  buildFreshSeedSnapshot(): SspRepositorySnapshot;
}

function cloneJson<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

@Injectable({ providedIn: 'root' })
export class LocalProyectosRepository implements ProyectosRepository {
  private readonly storage = inject(StorageService);
  private cachedSeed: GeneratedSeedPortfolio | null = null;

  private getSeedPortfolio(): GeneratedSeedPortfolio {
    if (!this.cachedSeed) {
      this.cachedSeed = buildSeedPortfolio();
    }
    return cloneJson(this.cachedSeed);
  }

  buildFreshSeedSnapshot(): SspRepositorySnapshot {
    const seed = this.getSeedPortfolio();
    return {
      projects: seed.projects,
      risks: cloneJson(SEED_RISKS),
      commitments: cloneJson(SEED_COMMITMENTS),
      seguimientos: { ...seed.seg0 },
      revisiones: { ...seed.rev0 },
      priorizados: cloneJson(seed.pri0),
      priorizadosHist: cloneJson(seed.prih0),
      parametros: cloneJson(SEED_PARAMS_DEF),
      exportTraces: [],
      suggestions: cloneJson(SEED_SUGGESTIONS),
    };
  }

  loadInitialSnapshot(): SspRepositorySnapshot {
    const fresh = this.buildFreshSeedSnapshot();
    const storedRisks = this.storage.get<RiesgoSsp[] | null>('riesgos', null);
    const storedParams = this.storage.get<ParametrosSsp | null>('params', null);
    const storedRev = this.storage.get<Record<string, string> | null>('rev', null);
    const storedComp = this.storage.get<CompromisoSsp[] | null>('comp', null);
    const storedSeg = this.storage.get<Record<string, SeguimientoSemanal> | null>('seg', null);
    const storedPri = this.storage.get<Record<string, PriorizadoInfo> | null>('pri', null);
    const storedPrih = this.storage.get<PriorizadoHistItem[] | null>('prih', null);
    const storedExp = this.storage.get<ExportTraceItem[] | null>('exp', null);

    const priorizados = storedPri ?? fresh.priorizados;
    const seguimientos = { ...fresh.seguimientos, ...(storedSeg ?? {}) };

    // Sync projects with stored priorizados and seguimientos
    fresh.projects.forEach((p) => {
      const px = priorizados[p.cui];
      p.pri = px ? px.tipo : '';
      p.priX = px || null;
      const sg = seguimientos[p.cui];
      if (sg && sg.fis != null && p.fis != null) {
        p.fis = sg.fis;
      }
    });

    return {
      projects: fresh.projects,
      risks: storedRisks ?? fresh.risks,
      commitments: storedComp ?? fresh.commitments,
      seguimientos,
      revisiones: { ...fresh.revisiones, ...(storedRev ?? {}) },
      priorizados,
      priorizadosHist: storedPrih ?? fresh.priorizadosHist,
      parametros: storedParams ?? fresh.parametros,
      exportTraces: storedExp ?? fresh.exportTraces,
      suggestions: fresh.suggestions,
    };
  }
}

export const PROYECTOS_REPOSITORY = new InjectionToken<ProyectosRepository>(
  'PROYECTOS_REPOSITORY',
  {
    providedIn: 'root',
    factory: () => inject(LocalProyectosRepository),
  }
);

export type PriFilterValue = '' | 'todos' | PriorizadoTipo;

export interface MatrixCellSelection {
  p: ProbabilidadLabel;
  i: ImpactoLabel;
}

export interface RiskFiltersState {
  q: string;
  niv: '' | NivelRiesgo;
  est: string;
  uo: '' | UnidadOperativa;
}

export type ProjectSortField = 'riesgo' | 'desv' | 'ejec' | 'avance' | 'nombre' | 'cui';

export interface ProjectFiltersState {
  uo: '' | UnidadOperativa;
  q: string;
  dep: string;
  prov: string;
  dist: string;
  etapa: string;
  est: string;
  niv: string;
  culm: string;
  mine: '1' | '0';
  sort: ProjectSortField;
  page: number;
}

const DEFAULT_PROJECT_FILTERS: ProjectFiltersState = {
  uo: '',
  q: '',
  dep: '',
  prov: '',
  dist: '',
  etapa: '',
  est: '',
  niv: '',
  culm: '',
  mine: '1',
  sort: 'riesgo',
  page: 1,
};

@Injectable({ providedIn: 'root' })
export class SspDomainStore {
  private readonly repo = inject(PROYECTOS_REPOSITORY);
  private readonly storage = inject(StorageService);
  private readonly auth = inject(SspAuthService);

  private readonly initial = this.repo.loadInitialSnapshot();

  readonly proyectos = signal<ProyectoSsp[]>(this.initial.projects);
  readonly riesgos = signal<RiesgoSsp[]>(this.initial.risks);
  readonly compromisos = signal<CompromisoSsp[]>(this.initial.commitments);
  readonly seguimientos = signal<Record<string, SeguimientoSemanal>>(this.initial.seguimientos);
  readonly revisiones = signal<Record<string, string>>(this.initial.revisiones);
  readonly priorizados = signal<Record<string, PriorizadoInfo>>(this.initial.priorizados);
  readonly priorizadosHist = signal<PriorizadoHistItem[]>(this.initial.priorizadosHist);
  readonly parametros = signal<ParametrosSsp>(this.initial.parametros);
  readonly exportTraces = signal<ExportTraceItem[]>(this.initial.exportTraces);
  readonly sugerencias = signal<SugerenciaRiesgoSsp[]>(this.initial.suggestions);

  // Global & view filters
  readonly uoFilter = signal<'' | UnidadOperativa>('');
  readonly priFilter = signal<PriFilterValue>('');
  readonly matrixCellFilter = signal<MatrixCellSelection | null>(null);
  readonly catFilter = signal<string>('');
  readonly alertSevFilter = signal<'' | SeveridadAlerta>('');
  readonly riskFilters = signal<RiskFiltersState>({
    q: '',
    niv: '',
    est: 'act',
    uo: '',
  });
  readonly projectFilters = signal<ProjectFiltersState>({ ...DEFAULT_PROJECT_FILTERS });
  readonly projectViewMode = signal<'tabla' | 'cards'>(
    this.storage.get<'tabla' | 'cards'>('pv', 'tabla')
  );
  readonly projectFiltersOpen = signal<boolean>(
    typeof window !== 'undefined' ? window.innerWidth > 760 : true
  );

  // Fast lookup map CUI -> ProyectoSsp
  readonly projectByCui = computed<Record<string, ProyectoSsp>>(() => {
    const map: Record<string, ProyectoSsp> = {};
    for (const p of this.proyectos()) {
      map[p.cui] = p;
    }
    return map;
  });

  // Visible projects for current role + global uoFilter + priFilter (`vis()` in prototype)
  readonly visibleProyectos = computed<ProyectoSsp[]>(() => {
    const me = this.auth.currentUser();
    const uo = this.uoFilter();
    const pri = this.priFilter();
    return this.proyectos().filter(
      (p) =>
        (me.rol !== 'reg' || p.uo === me.area) &&
        (!uo || p.uo === uo) &&
        (!pri || (pri === 'todos' ? !!p.pri : p.pri === pri))
    );
  });

  // Role-scoped projects (`PV()` in prototype)
  readonly roleScopedProyectos = computed<ProyectoSsp[]>(() => {
    const me = this.auth.currentUser();
    return me.rol === 'reg'
      ? this.proyectos().filter((p) => p.uo === me.area)
      : this.proyectos();
  });

  // Role-scoped risks (`RV()` in prototype)
  readonly roleScopedRiesgos = computed<RiesgoSsp[]>(() => {
    const me = this.auth.currentUser();
    const byCui = this.projectByCui();
    return me.rol === 'reg'
      ? this.riesgos().filter((r) => byCui[r.cui]?.uo === me.area)
      : this.riesgos();
  });

  // All alerts for visible projects
  readonly visibleAlertas = computed<AlertaSsp[]>(() => {
    return computeAlertas(
      this.visibleProyectos(),
      this.riesgos(),
      this.parametros(),
      this.revisiones(),
      CORTE_FECHA
    );
  });

  // All alerts for role-scoped projects (used by Bell popover)
  readonly roleAlertas = computed<AlertaSsp[]>(() => {
    return computeAlertas(
      this.roleScopedProyectos(),
      this.riesgos(),
      this.parametros(),
      this.revisiones(),
      CORTE_FECHA
    );
  });

  // Total critical alerts across all projects (used by Sidebar & Header badge `#navAl` / `#bellN`)
  readonly criticalAlertsCount = computed<number>(() => {
    const allAlerts = computeAlertas(
      this.proyectos(),
      this.riesgos(),
      this.parametros(),
      this.revisiones(),
      CORTE_FECHA
    );
    return allAlerts.filter((a) => a.sev === 'Crítica').length;
  });

  // Pending weekly registrations count (`#navSegN`)
  readonly pendingSegCount = computed<number>(() => {
    const me = this.auth.currentUser();
    const segs = this.seguimientos();
    return this.proyectos().filter(
      (p) => (me.rol !== 'reg' || this.auth.isAssignedToMe(p.uo, p.asig)) && !isSegOk(p, segs)
    ).length;
  });

  getProject(cui: string): ProyectoSsp | undefined {
    return this.projectByCui()[cui];
  }

  getProjectRisks(cui: string): RiesgoSsp[] {
    return this.riesgos().filter((r) => r.cui === cui);
  }

  getProjectActiveRisks(cui: string): RiesgoSsp[] {
    return this.riesgos().filter((r) => r.cui === cui && isActiveRisk(r));
  }

  getProjectLevel(cui: string): NivelRiesgo | null {
    return projectRiskLevel(cui, this.riesgos(), this.parametros());
  }

  getRiskScore(r: Pick<RiesgoSsp, 'p' | 'i'>): number {
    return scoreRisk(r, this.parametros());
  }

  getRiskLevel(r: Pick<RiesgoSsp, 'p' | 'i' | 'mitigable'>): NivelRiesgo {
    return lvlOfRisk(r, this.parametros());
  }

  getSuggestionsForProject(cui: string): Array<SugerenciaRiesgoSsp & { k: number }> {
    const p = this.getProject(cui);
    if (!p) return [];
    return sugForProject(p, this.getProjectRisks(cui), this.sugerencias());
  }

  setProjectViewMode(mode: 'tabla' | 'cards'): void {
    this.projectViewMode.set(mode);
    this.storage.set('pv', mode);
  }

  updateProjectFilter<K extends keyof ProjectFiltersState>(
    key: K,
    value: ProjectFiltersState[K]
  ): void {
    this.projectFilters.update((prev) => {
      const next = { ...prev, [key]: value };
      if (key !== 'page') {
        next.page = 1;
      }
      if (key === 'dep') {
        next.prov = '';
        next.dist = '';
      }
      if (key === 'prov') {
        next.dist = '';
      }
      return next;
    });
  }

  clearAllProjectFilters(): void {
    this.projectFilters.update((prev) => ({
      ...DEFAULT_PROJECT_FILTERS,
      mine: prev.mine,
      sort: prev.sort,
    }));
    this.priFilter.set('');
  }

  updateRiskFilter<K extends keyof RiskFiltersState>(key: K, value: RiskFiltersState[K]): void {
    this.riskFilters.update((prev) => ({ ...prev, [key]: value }));
  }

  toggleMatrixCell(p: ProbabilidadLabel, i: ImpactoLabel): void {
    const cur = this.matrixCellFilter();
    if (cur && cur.p === p && cur.i === i) {
      this.matrixCellFilter.set(null);
    } else {
      this.matrixCellFilter.set({ p, i });
    }
  }

  clearMatrixAndCatFilters(): void {
    this.matrixCellFilter.set(null);
    this.catFilter.set('');
  }

  // Global search results (commitments, projects, risks)
  searchGlobal(rawQuery: string): {
    commitments: CompromisoSsp[];
    projects: ProyectoSsp[];
    risks: RiesgoSsp[];
  } {
    const q = normalizeSearchText(rawQuery.trim());
    if (q.length < 2) {
      return { commitments: [], projects: [], risks: [] };
    }
    const projects = this.proyectos()
      .filter((p) =>
        normalizeSearchText(`${p.cui} ${p.corto} ${p.dist} ${p.dep}`).includes(q)
      )
      .slice(0, 5);
    const risks = this.riesgos()
      .filter((r) =>
        normalizeSearchText(`${r.id} ${r.evento} ${r.causa}`).includes(q)
      )
      .slice(0, 5);
    const commitments = this.compromisos()
      .filter((c) =>
        normalizeSearchText(`${c.id} ${c.dec} ${c.prob}`).includes(q)
      )
      .slice(0, 3);
    return { commitments, projects, risks };
  }

  // --- Mutations ---

  recordWeeklyRiskReview(cui: string): void {
    const me = this.auth.currentUser();
    this.revisiones.update((prev) => {
      const next = { ...prev, [cui]: CORTE_FECHA };
      this.storage.set('rev', next);
      return next;
    });
    this.storage.set('revby-' + cui, me.id);
  }

  saveSeguimiento(input: {
    cui: string;
    fis: number | null;
    det: string;
    completedHitoIds: Record<string, boolean>;
    reviewedRisks: boolean;
    ev: string;
  }): ProyectoSsp | null {
    const me = this.auth.currentUser();
    let updatedProj: ProyectoSsp | null = null;

    this.proyectos.update((list) =>
      list.map((p) => {
        if (p.cui !== input.cui) return p;
        const copy: ProyectoSsp = {
          ...p,
          hitos: p.hitos.map((h) =>
            input.completedHitoIds[h.id] ? { ...h, est: 'Cumplido', real: CORTE_FECHA } : h
          ),
          hist: [...p.hist],
        };
        if (copy.fis != null && input.fis != null) {
          copy.fis = +input.fis;
          if (copy.hist.length && copy.hist[copy.hist.length - 1].f === CORTE_FECHA) {
            copy.hist[copy.hist.length - 1] = {
              ...copy.hist[copy.hist.length - 1],
              fis: +input.fis,
            };
          } else {
            copy.hist.push({ f: CORTE_FECHA, fis: +input.fis, prog: copy.prog ?? 0 });
          }
        }
        updatedProj = copy;
        return copy;
      })
    );

    if (input.reviewedRisks) {
      this.revisiones.update((prev) => {
        const next = { ...prev, [input.cui]: CORTE_FECHA };
        this.storage.set('rev', next);
        return next;
      });
    }

    this.seguimientos.update((prev) => {
      const next: Record<string, SeguimientoSemanal> = {
        ...prev,
        [input.cui]: {
          f: CORTE_FECHA,
          u: me.id,
          fis: input.fis,
          det: input.det,
          ev: input.ev,
        },
      };
      this.storage.set('seg', next);
      return next;
    });

    return updatedProj;
  }

  saveRiesgo(
    draft: RiesgoSsp,
    previousP?: ProbabilidadLabel,
    previousI?: ImpactoLabel
  ): { saved: RiesgoSsp; toastMsg: string } {
    const me = this.auth.currentUser();
    const copy: RiesgoSsp = cloneJson(draft);
    const list = this.riesgos();

    if (copy.id && previousP && previousI && (copy.p !== previousP || copy.i !== previousI)) {
      copy.hist.push({
        f: CORTE_FECHA,
        p: copy.p,
        i: copy.i,
        n: 'Re-evaluación',
        u: me.id,
      });
    }

    if (!copy.id) {
      const maxNum = Math.max(0, ...list.map((x) => +x.id.slice(5) || 0));
      copy.id = 'R-26-' + String(maxNum + 1).padStart(4, '0');
      copy.hist = [
        {
          f: CORTE_FECHA,
          p: copy.p,
          i: copy.i,
          n: copy.estado === 'Propuesto' ? 'Notificado por la UPP' : 'Registro inicial',
          u: me.id,
        },
      ];
      if (copy.acc.length && copy.estado === 'Identificado') {
        copy.estado = 'En tratamiento';
      }
    }

    if (me.rol === 'reg') {
      copy.val = me.valida ? 'Validado' : 'Por validar';
      copy.valBy = me.valida ? me.id : '';
      copy.valF = me.valida ? CORTE_FECHA : '';
      if (!me.valida) {
        copy.obs = '';
      }
    }
    copy.act = me.id;
    copy.actF = CORTE_FECHA;

    this.upsertRiskInStore(copy);

    const p = this.getProject(copy.cui);
    const uoLabel = p ? this.auth.formatAreaLabel(p.uo) : '';
    const validatorId = p ? COORDINATOR_VALIDATOR_BY_UO[p.uo] : 'luis';
    const validatorName = this.auth.getUserById(validatorId).nombre;

    const toastMsg =
      copy.estado === 'Propuesto'
        ? `Riesgo ${copy.id} notificado a ${uoLabel}: queda Propuesto`
        : me.rol === 'reg' && !me.valida
          ? `Riesgo ${copy.id} guardado. Pasa a validación de ${validatorName}`
          : `Riesgo ${copy.id} guardado y validado por ${me.nombre}`;

    return { saved: copy, toastMsg };
  }

  rejectProposedRisk(risk: RiesgoSsp, motivo: string): RiesgoSsp {
    const me = this.auth.currentUser();
    const copy: RiesgoSsp = cloneJson(risk);
    copy.estado = 'Rechazado';
    copy.rech = { u: me.id, f: CORTE_FECHA, mot: motivo.trim() };
    copy.hist.push({
      f: CORTE_FECHA,
      p: copy.p,
      i: copy.i,
      n: 'Rechazado: ' + motivo.trim(),
      u: me.id,
    });
    copy.act = me.id;
    copy.actF = CORTE_FECHA;
    this.upsertRiskInStore(copy);
    return copy;
  }

  validateRisk(risk: RiesgoSsp): RiesgoSsp {
    const me = this.auth.currentUser();
    const copy: RiesgoSsp = cloneJson(risk);
    copy.val = 'Validado';
    copy.valBy = me.id;
    copy.valF = CORTE_FECHA;
    copy.obs = '';
    this.upsertRiskInStore(copy);
    return copy;
  }

  observeRisk(risk: RiesgoSsp, observacion: string): RiesgoSsp {
    const me = this.auth.currentUser();
    const copy: RiesgoSsp = cloneJson(risk);
    copy.val = 'Observado';
    copy.valBy = me.id;
    copy.valF = CORTE_FECHA;
    copy.obs = observacion.trim();
    this.upsertRiskInStore(copy);
    return copy;
  }

  private upsertRiskInStore(risk: RiesgoSsp): void {
    this.riesgos.update((prev) => {
      const idx = prev.findIndex((x) => x.id === risk.id);
      const next = idx >= 0 ? prev.map((x, i) => (i === idx ? risk : x)) : [...prev, risk];
      this.storage.set('riesgos', next);
      return next;
    });
  }

  saveCompromiso(draft: CompromisoSsp): CompromisoSsp {
    const copy: CompromisoSsp = cloneJson(draft);
    const list = this.compromisos();
    if (!copy.id) {
      const maxNum = Math.max(0, ...list.map((x) => +x.id.slice(2) || 0));
      copy.id = 'C-' + String(maxNum + 1).padStart(3, '0');
    }
    this.compromisos.update((prev) => {
      const idx = prev.findIndex((x) => x.id === copy.id);
      const next = idx >= 0 ? prev.map((x, i) => (i === idx ? copy : x)) : [...prev, copy];
      this.storage.set('comp', next);
      return next;
    });
    return copy;
  }

  savePriorizado(input: {
    modo: 'nuevo' | 'edit' | 'out';
    cui: string;
    tipo: PriorizadoTipo;
    meta: string;
    fm: string;
    sust: string;
    mot: string;
  }): void {
    const me = this.auth.currentUser();
    const currentPris = { ...this.priorizados() };
    const currentHist = [...this.priorizadosHist()];
    const ant = currentPris[input.cui];

    if (input.modo === 'out') {
      if (ant) {
        currentHist.push({
          f: CORTE_FECHA,
          cui: input.cui,
          acc: 'Retiro',
          de: ant.tipo,
          a: '',
          mot: input.mot,
          u: me.id,
        });
      }
      delete currentPris[input.cui];
    } else if (input.modo === 'nuevo') {
      currentPris[input.cui] = {
        tipo: input.tipo,
        meta: input.meta,
        fm: input.fm,
        sust: input.sust,
        desde: CORTE_FECHA,
        u: me.id,
      };
      currentHist.push({
        f: CORTE_FECHA,
        cui: input.cui,
        acc: 'Inclusión',
        de: '',
        a: input.tipo,
        mot: input.mot || 'Incluido en la cartera priorizada',
        u: me.id,
      });
    } else {
      const oldTipo = ant ? ant.tipo : input.tipo;
      currentHist.push({
        f: CORTE_FECHA,
        cui: input.cui,
        acc: oldTipo !== input.tipo ? 'Cambio de tipo' : 'Cambio de meta',
        de: oldTipo,
        a: input.tipo,
        mot: input.mot,
        u: me.id,
      });
      currentPris[input.cui] = {
        ...(ant || { desde: CORTE_FECHA, u: me.id }),
        tipo: input.tipo,
        meta: input.meta,
        fm: input.fm,
        sust: input.sust,
      };
    }

    this.priorizados.set(currentPris);
    this.priorizadosHist.set(currentHist);
    this.storage.set('pri', currentPris);
    this.storage.set('prih', currentHist);

    // Sync projects pri & priX
    this.proyectos.update((list) =>
      list.map((p) => {
        const px = currentPris[p.cui] || null;
        return {
          ...p,
          pri: px ? px.tipo : '',
          priX: px,
        };
      })
    );
  }

  updateParametros(updater: (current: ParametrosSsp) => ParametrosSsp): void {
    this.parametros.update((curr) => {
      const next = updater(cloneJson(curr));
      this.storage.set('params', next);
      return next;
    });
  }

  resetParametrosOece(): void {
    const def = cloneJson(SEED_PARAMS_DEF);
    this.parametros.set(def);
    this.storage.set('params', def);
  }

  recordExportTrace(kind: ExportKindCode, label: string, fmt: string, payload: string): ExportTraceItem {
    const me = this.auth.currentUser();
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    const fecha = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    const hora = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const raw = `${kind}|${label}|${fmt}|${me.id}|${fecha}|${hora}|${payload.length}|${payload.slice(0, 240)}`;
    let h = 0x811c9dc5;
    for (let i = 0; i < raw.length; i++) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    const cod = `PNSR-${kind}-${(h >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
    const rec: ExportTraceItem = {
      cod,
      kind,
      label,
      fmt,
      u: me.id,
      fecha,
      hora,
      corte: CORTE_FECHA,
    };

    this.exportTraces.update((prev) => {
      const next = [rec, ...prev].slice(0, 60);
      this.storage.set('exp', next);
      return next;
    });

    return rec;
  }

  verifyExportCode(rawCode: string): ExportTraceItem | false | null {
    const c = (rawCode || '').trim().toUpperCase();
    if (!c) return null;
    return this.exportTraces().find((x) => x.cod === c) || false;
  }

  resetAllDemoData(): void {
    this.storage.clearAll();
    const fresh = this.repo.buildFreshSeedSnapshot();
    this.proyectos.set(fresh.projects);
    this.riesgos.set(fresh.risks);
    this.compromisos.set(fresh.commitments);
    this.seguimientos.set(fresh.seguimientos);
    this.revisiones.set(fresh.revisiones);
    this.priorizados.set(fresh.priorizados);
    this.priorizadosHist.set(fresh.priorizadosHist);
    this.parametros.set(fresh.parametros);
    this.exportTraces.set([]);
    this.uoFilter.set('');
    this.priFilter.set('');
    this.matrixCellFilter.set(null);
    this.catFilter.set('');
    this.alertSevFilter.set('');
    this.projectFilters.set({ ...DEFAULT_PROJECT_FILTERS });
    this.auth.switchDemoUser('ana');
  }
}
