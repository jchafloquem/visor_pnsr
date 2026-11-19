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
import {
  COORDINATOR_VALIDATOR_BY_UO,
  SEED_SUGGESTIONS,
} from '../../../data/seed-risks.data';
import { IconComponent } from '../../shared/icons/icon.component';
import { ProjectPickerComponent } from '../../shared/ui/project-picker/project-picker.component';
import {
  MatrixCellEvent,
  RiskMatrixComponent,
} from '../../shared/ui/risk-matrix.component';
import { SspDomainStore } from '../../cartera/data-access/ssp-domain.store';
import {
  diffDays,
  formatDateShort,
} from '../../cartera/domain/project-projection.rules';
import {
  AccionRiesgoSsp,
  EstadoRiesgo,
  EstrategiaRiesgo,
  ImpactoLabel,
  NivelRiesgo,
  ProbabilidadLabel,
  RiesgoSsp,
} from '../../cartera/models/ssp.models';
import {
  IMPACTO_LABELS,
  nivelFromScore,
  PROBABILIDAD_LABELS,
  scoreRisk,
} from '../domain/risk.rules';

@Component({
  selector: 'app-riesgo-drawer',
  standalone: true,
  imports: [IconComponent, ProjectPickerComponent, RiskMatrixComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col flex-auto min-h-0 overflow-hidden' },
  templateUrl: './riesgo-drawer.component.html',
  styleUrl: './riesgo-drawer.component.css',
})
export class RiesgoDrawerComponent {
  readonly store = inject(SspDomainStore);
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);

  readonly riskId = input<string | undefined>(undefined);
  readonly initialCui = input<string | undefined>(undefined);
  readonly initialHitoId = input<string | undefined>(undefined);

  readonly activeStep = signal<number>(1);
  readonly draft = signal<RiesgoSsp | null>(null);
  readonly originalP = signal<ProbabilidadLabel>('Moderada');
  readonly originalI = signal<ImpactoLabel>('Moderado');
  readonly rejectReason = signal<string>('');
  readonly observeComment = signal<string>('');

  readonly previousDrawer = this.layout.previousDrawer;
  readonly probabilidadLabels = PROBABILIDAD_LABELS;
  readonly impactoLabels = IMPACTO_LABELS;

  readonly componentesList = [
    'General',
    'Captación',
    'Línea de conducción',
    'Reservorio',
    'Redes de distribución',
    'UBS / alcantarillado',
    'PTAR',
  ];

  readonly origenesList = [
    'Seguimiento semanal',
    'Matriz del expediente técnico',
    'Visita de monitoreo',
    'Notificado por la UPP',
  ];

  readonly estrategiasList: readonly EstrategiaRiesgo[] = [
    'Mitigar',
    'Evitar',
    'Transferir',
    'Aceptar',
  ];

  readonly estadosRiesgoList: readonly EstadoRiesgo[] = [
    'Identificado',
    'En tratamiento',
    'Materializado',
    'Cerrado',
  ];

  constructor() {
    effect(() => {
      const id = this.riskId();
      const cuiArg = this.initialCui();
      const hitoArg = this.initialHitoId() || '';
      const me = this.auth.currentUser();

      this.activeStep.set(1);
      this.rejectReason.set('');
      this.observeComment.set('');

      if (id) {
        const found = this.store.riesgos().find((r) => r.id === id);
        if (found) {
          const clone = JSON.parse(JSON.stringify(found)) as RiesgoSsp;
          this.draft.set(clone);
          this.originalP.set(clone.p);
          this.originalI.set(clone.i);
          return;
        }
      }

      const defaultProj =
        (cuiArg ? this.store.getProject(cuiArg) : null) ||
        this.store.proyectos().find((p) => this.auth.canEditUnit(p.uo)) ||
        this.store.proyectos()[0];

      const isSug = hitoArg.startsWith('sug:');
      const sugIdx = isSug ? +hitoArg.slice(4) : -1;
      const sug = sugIdx >= 0 ? SEED_SUGGESTIONS[sugIdx] : null;

      const newDraft: RiesgoSsp = {
        id: '',
        cui: defaultProj.cui,
        hito: isSug ? '' : hitoArg,
        comp: 'General',
        cats: sug ? [...sug.cats] : me.rol === 'upp' ? ['Financieros'] : [],
        origen: me.rol === 'upp' ? 'Notificado por la UPP' : 'Seguimiento semanal',
        mitigable: true,
        causa: sug ? sug.causa : '',
        evento: sug ? sug.evento : '',
        consec: sug ? sug.consec : '',
        p: sug ? sug.p : 'Moderada',
        i: sug ? sug.i : 'Moderado',
        estado: me.rol === 'upp' ? 'Propuesto' : 'Identificado',
        estrategia: me.rol === 'upp' ? '' : 'Mitigar',
        resp: '',
        flim: '',
        acc: [],
        hist: [],
        creado: CORTE_FECHA,
        por: me.id,
        act: me.id,
        actF: CORTE_FECHA,
        val: '',
        valBy: '',
        valF: '',
        obs: '',
      };

      this.draft.set(newDraft);
      this.originalP.set(newDraft.p);
      this.originalI.set(newDraft.i);
    });
  }

  readonly project = computed(() => {
    const r = this.draft();
    return r ? this.store.getProject(r.cui) : undefined;
  });

  readonly isUppNotificationDraft = computed(() => {
    const r = this.draft();
    const me = this.auth.currentUser();
    if (!r) return false;
    return me.rol === 'upp' && r.estado === 'Propuesto' && (!r.id || r.por === me.id);
  });

  readonly readOnly = computed(() => {
    const p = this.project();
    if (!p) return true;
    return !(this.auth.canEditUnit(p.uo) || this.isUppNotificationDraft());
  });

  readonly currentScore = computed(() => {
    const r = this.draft();
    return r ? this.store.getRiskScore(r) : 0;
  });

  readonly currentBaseNivel = computed(() => {
    return nivelFromScore(this.currentScore(), this.store.parametros());
  });

  readonly currentLevel = computed<NivelRiesgo>(() => {
    const r = this.draft();
    return r ? this.store.getRiskLevel(r) : 'MODERADA';
  });

  readonly stepTabs = computed(() => {
    const r = this.draft();
    if (!r) return [];
    const cur = this.activeStep();
    const isStepOk = (n: number): boolean => {
      if (n === 1) {
        return !!(
          r.cats.length &&
          r.causa.trim() &&
          r.evento.trim() &&
          r.consec.trim()
        );
      }
      if (n === 2) return true;
      if (n === 3) {
        return this.currentBaseNivel() !== 'ALTA' || r.acc.length > 0;
      }
      return true;
    };

    const base = [
      { num: 1, label: 'Identificar', done: cur !== 1 && isStepOk(1) && (!!r.id || 1 < cur) },
      { num: 2, label: 'Evaluar', done: cur !== 2 && isStepOk(2) && (!!r.id || 2 < cur) },
      { num: 3, label: 'Plan de acción', done: cur !== 3 && isStepOk(3) && (!!r.id || 3 < cur) },
    ];
    if (r.id) {
      base.push({ num: 4, label: 'Historial', done: false });
    }
    return base;
  });

  readonly authorUser = computed(() => {
    const r = this.draft();
    return this.auth.getUserById(r?.por);
  });

  readonly authorInitials = computed(() => {
    return this.auth.getInitials(this.authorUser().nombre);
  });

  readonly updaterUser = computed(() => {
    const r = this.draft();
    return this.auth.getUserById(r?.act || r?.por);
  });

  readonly validatorUser = computed(() => {
    const r = this.draft();
    return this.auth.getUserById(r?.valBy);
  });

  readonly coordinatorName = computed(() => {
    const p = this.project();
    if (!p) return '—';
    return this.auth.getUserById(COORDINATOR_VALIDATOR_BY_UO[p.uo]).nombre;
  });

  readonly suggestions = computed(() => {
    const p = this.project();
    return p ? this.store.getSuggestionsForProject(p.cui) : [];
  });

  readonly selectableProjects = computed(() => {
    const r = this.draft();
    const upN = this.isUppNotificationDraft();
    return this.store
      .proyectos()
      .filter((x) => this.auth.canEditUnit(x.uo) || x.cui === r?.cui || (upN && !r?.id));
  });

  readonly reversedHistory = computed(() => {
    const r = this.draft();
    const params = this.store.parametros();
    if (!r || !r.hist) return [];
    return r.hist
      .slice()
      .reverse()
      .map((h) => {
        const sc = scoreRisk({ p: h.p, i: h.i }, params);
        const lv = nivelFromScore(sc, params);
        const u = this.auth.getUserById(h.u);
        const dotClass =
          lv === 'ALTA'
            ? 'before:bg-rojo-nacional'
            : lv === 'MODERADA'
              ? 'before:bg-risk-mid'
              : 'before:bg-verde-eficiencia';
        return {
          h,
          score: sc,
          level: lv,
          dotClass,
          userName: u.nombre,
          userArea: this.auth.formatAreaLabel(u.area),
        };
      });
  });

  readonly canShowSaveButton = computed(() => {
    const r = this.draft();
    if (!r) return false;
    const upN = this.isUppNotificationDraft();
    if (this.readOnly() || (r.estado === 'Propuesto' && !upN)) return false;
    const step = this.activeStep();
    return step >= 3 || !!r.id || (upN && step >= 2);
  });

  formatDate(iso: string | undefined | null): string {
    return formatDateShort(iso);
  }

  isActionExpired(a: AccionRiesgoSsp): boolean {
    return a.est !== 'Atendida' && !!a.f && diffDays(a.f, CORTE_FECHA) < 0;
  }

  getRiskBadgeClass(level: NivelRiesgo): string {
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

  getResultBoxClass(nivel: 'ALTA' | 'MODERADA' | 'BAJA'): string {
    switch (nivel) {
      case 'ALTA':
        return 'bg-risk-high-bg text-risk-high-text';
      case 'MODERADA':
        return 'bg-risk-mid-bg text-risk-mid-text';
      case 'BAJA':
        return 'bg-risk-low-bg text-risk-low-text';
    }
  }

  onRejectReasonInput(event: Event): void {
    this.rejectReason.set((event.target as HTMLTextAreaElement).value);
  }

  onObserveCommentInput(event: Event): void {
    this.observeComment.set((event.target as HTMLTextAreaElement).value);
  }

  updateFieldFromEvent<K extends keyof RiesgoSsp>(key: K, event: Event): void {
    const val = (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
    this.updateField(key, val as RiesgoSsp[K]);
  }

  onMitigableChange(event: Event): void {
    this.updateField('mitigable', (event.target as HTMLSelectElement).value === 'true');
  }

  updateActionFromEvent<K extends keyof AccionRiesgoSsp>(
    index: number,
    key: K,
    event: Event
  ): void {
    const val = (event.target as HTMLInputElement).value;
    this.updateAction(index, key, val as AccionRiesgoSsp[K]);
  }

  onActionProgressChange(index: number, event: Event): void {
    const av = Number((event.target as HTMLInputElement).value);
    if (!Number.isNaN(av)) {
      this.updateActionProgress(index, av);
    }
  }

  updateField<K extends keyof RiesgoSsp>(key: K, value: RiesgoSsp[K]): void {
    this.draft.update((curr) => {
      if (!curr) return curr;
      const next = { ...curr, [key]: value };
      if (key === 'cui') {
        next.hito = '';
      }
      return next;
    });
  }

  toggleCategory(cat: string): void {
    if (this.readOnly()) return;
    this.draft.update((curr) => {
      if (!curr) return curr;
      const cats = curr.cats.includes(cat)
        ? curr.cats.filter((x) => x !== cat)
        : [...curr.cats, cat];
      return { ...curr, cats };
    });
  }

  applySuggestion(sugIdx: number): void {
    const sug = SEED_SUGGESTIONS[sugIdx];
    if (!sug) return;
    this.draft.update((curr) => {
      if (!curr) return curr;
      return {
        ...curr,
        cats: [...sug.cats],
        causa: sug.causa,
        evento: sug.evento,
        consec: sug.consec,
        p: sug.p,
        i: sug.i,
      };
    });
    this.layout.showToast('Sugerencia cargada: ajústala a tu proyecto');
  }

  onPickMatrixCell(cell: MatrixCellEvent): void {
    if (this.readOnly()) return;
    this.draft.update((curr) => (curr ? { ...curr, p: cell.p, i: cell.i } : curr));
  }

  addAction(): void {
    this.draft.update((curr) => {
      if (!curr) return curr;
      return {
        ...curr,
        acc: [...curr.acc, { t: '', r: '', f: '', av: 0, est: 'Pendiente', ev: '' }],
      };
    });
  }

  removeAction(index: number): void {
    this.draft.update((curr) => {
      if (!curr) return curr;
      return {
        ...curr,
        acc: curr.acc.filter((_, i) => i !== index),
      };
    });
  }

  updateAction<K extends keyof AccionRiesgoSsp>(
    index: number,
    key: K,
    value: AccionRiesgoSsp[K]
  ): void {
    this.draft.update((curr) => {
      if (!curr) return curr;
      const acc = curr.acc.map((a, i) => (i === index ? { ...a, [key]: value } : a));
      return { ...curr, acc };
    });
  }

  updateActionProgress(index: number, av: number): void {
    this.draft.update((curr) => {
      if (!curr) return curr;
      const acc = curr.acc.map((a, i) =>
        i === index
          ? {
              ...a,
              av,
              est: (av > 0 ? 'En curso' : 'Pendiente') as AccionRiesgoSsp['est'],
            }
          : a
      );
      return { ...curr, acc };
    });
  }

  onActionEvidenceSelected(index: number, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.draft.update((curr) => {
      if (!curr) return curr;
      const acc = curr.acc.map((a, i) =>
        i === index ? { ...a, ev: file.name, av: 100, est: 'Atendida' as const } : a
      );
      return { ...curr, acc };
    });
    this.layout.showToast('Evidencia cargada: acción atendida');
  }

  acceptProposed(): void {
    const p = this.project();
    const me = this.auth.currentUser();
    if (!p) return;
    this.draft.update((curr) => {
      if (!curr) return curr;
      return {
        ...curr,
        estado: 'Identificado',
        estrategia: curr.estrategia || 'Mitigar',
        hist: [
          ...curr.hist,
          {
            f: CORTE_FECHA,
            p: curr.p,
            i: curr.i,
            n: `Aceptado por ${this.auth.formatAreaLabel(p.uo)} (${me.nombre})`,
            u: me.id,
          },
        ],
      };
    });
    this.activeStep.set(3);
    this.layout.showToast('Aceptado: completa el plan de acción y guarda');
  }

  rejectProposed(): void {
    const r = this.draft();
    if (!r) return;
    const mot = this.rejectReason().trim();
    if (!mot) {
      this.layout.showToast('Escribe el motivo del rechazo');
      return;
    }
    this.store.rejectProposedRisk(r, mot);
    this.layout.completeCurrentDrawer();
    this.layout.showToast('Notificación rechazada. La UPP verá el motivo');
  }

  validateCurrentRisk(): void {
    const r = this.draft();
    if (!r) return;
    const saved = this.store.validateRisk(r);
    this.layout.completeCurrentDrawer();
    this.layout.showToast(`Riesgo ${saved.id} validado por ${this.auth.currentUser().nombre}`);
  }

  observeCurrentRisk(): void {
    const r = this.draft();
    if (!r) return;
    const obs = this.observeComment().trim();
    if (!obs) {
      this.layout.showToast('Escribe la observación');
      return;
    }
    const saved = this.store.observeRisk(r, obs);
    this.layout.completeCurrentDrawer();
    const targetUser = this.auth.getUserById(saved.act || saved.por).nombre;
    this.layout.showToast(`Riesgo ${saved.id} devuelto a ${targetUser}`);
  }

  saveRisk(): void {
    const r = this.draft();
    if (!r) return;

    if (!r.cats.length || !r.causa.trim() || !r.evento.trim() || !r.consec.trim()) {
      this.activeStep.set(1);
      this.layout.showToast('Completa el tipo, la causa, el evento y la consecuencia');
      return;
    }

    if (
      this.currentBaseNivel() === 'ALTA' &&
      r.estado !== 'Cerrado' &&
      r.estado !== 'Propuesto' &&
      !r.acc.length
    ) {
      this.activeStep.set(3);
      this.layout.showToast('Un riesgo alto necesita al menos una acción');
      return;
    }

    const { toastMsg } = this.store.saveRiesgo(r, this.originalP(), this.originalI());
    this.layout.completeCurrentDrawer();
    this.layout.showToast(toastMsg);
  }

  openProjectDrawer(cui: string): void {
    const p = this.store.getProject(cui);
    this.layout.openDrawer({
      kind: 'proj',
      key: cui,
      cui,
      tab: 'res',
      label: `Volver a ${p ? p.corto : cui}`,
    });
  }

  goBack(): void {
    this.layout.goBackDrawer();
  }

  close(): void {
    this.layout.closeDrawer();
  }
}
