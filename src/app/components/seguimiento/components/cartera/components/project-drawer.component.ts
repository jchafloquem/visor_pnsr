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
import { RiskTableComponent } from '../../shared/ui/risk-table.component';
import { CurvaSComponent } from '../../shared/visualizations/curva-s/curva-s.component';
import { CurvaSWeeklyPoint } from '../../shared/visualizations/curva-s/curva-s.models';
import { SparklineComponent } from '../../shared/visualizations/sparkline/sparkline.component';
import { AyudaMemoriaPreviewComponent } from '../../reportes/components/ayuda-memoria-preview.component';
import {
  buildAmEjecutiva,
  buildAmPlainText,
  buildAmRiesgos,
} from '../../reportes/domain/ayuda-memoria.builder';
import { SspDomainStore } from '../data-access/ssp-domain.store';
import {
  buildIaTexto,
  computeProyeccion,
  diffDays,
  formatDateShort,
  formatSoles,
} from '../domain/project-projection.rules';
import { NivelRiesgo } from '../models/ssp.models';

type ProjectDrawerTab = 'res' | 'av' | 'hitos' | 'pc' | 'riesgos' | 'comp' | 'am';

@Component({
  selector: 'app-project-drawer',
  standalone: true,
  imports: [
    IconComponent,
    CurvaSComponent,
    SparklineComponent,
    RiskTableComponent,
    AyudaMemoriaPreviewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col flex-auto min-h-0 overflow-hidden' },
  templateUrl: './project-drawer.component.html',
  styleUrl: './project-drawer.component.css',
})
export class ProjectDrawerComponent {
  readonly store = inject(SspDomainStore);
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);

  readonly cui = input.required<string>();
  readonly initialTab = input<string>('res');

  readonly activeTab = signal<ProjectDrawerTab>('res');
  readonly amType = signal<'ej' | 'rg'>('ej');
  readonly corte = CORTE_FECHA;

  readonly previousDrawer = this.layout.previousDrawer;

  constructor() {
    effect(() => {
      const tab = this.initialTab() as ProjectDrawerTab;
      if (['res', 'av', 'hitos', 'pc', 'riesgos', 'comp', 'am'].includes(tab)) {
        this.activeTab.set(tab);
      } else {
        this.activeTab.set('res');
      }
    });
  }

  readonly project = computed(() => this.store.getProject(this.cui()));

  readonly riskLevel = computed(() => this.store.getProjectLevel(this.cui()));

  readonly projectRisks = computed(() => this.store.getProjectRisks(this.cui()));

  readonly activeProjectRisks = computed(() => this.store.getProjectActiveRisks(this.cui()));

  readonly projectCommitments = computed(() =>
    this.store.compromisos().filter((c) => c.cui === this.cui())
  );

  readonly currentSeg = computed(() => this.store.seguimientos()[this.cui()]);

  readonly canEditProject = computed(() => {
    const p = this.project();
    return p ? this.auth.canEditUnit(p.uo) : false;
  });

  readonly tabs = computed<ReadonlyArray<{ key: ProjectDrawerTab; label: string }>>(() => {
    const p = this.project();
    const hitosCount = p ? p.hitos.length : 0;
    const activeRisksCount = this.activeProjectRisks().length;
    const compCount = this.projectCommitments().length;
    return [
      { key: 'res', label: 'Resumen' },
      { key: 'av', label: 'Avance' },
      { key: 'hitos', label: `Hitos (${hitosCount})` },
      { key: 'pc', label: 'Presupuesto y contrato' },
      { key: 'riesgos', label: `Riesgos (${activeRisksCount})` },
      { key: 'comp', label: `Compromisos (${compCount})` },
      { key: 'am', label: 'Ayuda memoria' },
    ];
  });

  readonly summaryKpis = computed(() => {
    const p = this.project();
    if (!p) return [];
    const execPct = p.pim ? ((p.dev / p.pim) * 100).toFixed(1) : '0.0';
    const items = [
      { label: 'PIM 2026', value: formatSoles(p.pim) },
      { label: 'Devengado', value: `${formatSoles(p.dev)} · ${execPct} %` },
      {
        label: 'Avance físico',
        value: p.fis != null ? `${p.fis} % (prog. ${p.prog} %)` : '—',
      },
      { label: '¿Culmina en 2026?', value: p.culm },
    ];
    if (p.priX) {
      items.push({
        label: 'Meta priorizada',
        value: `${p.priX.meta} · ${formatDateShort(p.priX.fm)}`,
      });
    }
    items.push({
      label: 'Beneficiarios',
      value: `${p.benef.toLocaleString('es-PE')} hab.`,
    });
    return items;
  });

  readonly proyeccion = computed(() => {
    const p = this.project();
    return p ? computeProyeccion(p, CORTE_FECHA) : null;
  });

  readonly iaLectura = computed(() => {
    const p = this.project();
    const o = this.proyeccion();
    if (!p || !o) return null;
    return buildIaTexto(p, o, this.projectRisks(), this.store.parametros(), CORTE_FECHA);
  });

  readonly assignedUserName = computed(() => {
    const p = this.project();
    return p ? this.auth.getUserById(p.asig).nombre : '—';
  });

  readonly curvaSPoints = computed<readonly CurvaSWeeklyPoint[] | null>(() => {
    const p = this.project();
    if (!p || !p.cv) return null;
    const sg = this.store.seguimientos()[p.cui];
    const hasRecentSeg = !!sg && diffDays(CORTE_FECHA, sg.f) <= 6;
    return p.cv.map((pt) => {
      if (pt.f === CORTE_FECHA && hasRecentSeg && sg) {
        return {
          ...pt,
          recordedBy: this.auth.getUserById(sg.u).nombre,
          detail: sg.det,
        };
      }
      return pt;
    });
  });

  readonly enrichedHitos = computed(() => {
    const p = this.project();
    if (!p) return [];
    const rs = this.projectRisks();
    const params = this.store.parametros();
    const anticip =
      params.exc[p.cui]?.hito ?? params.dias[p.uo]?.hito ?? 15;

    return p.hitos.map((h) => {
      const d = diffDays(h.f, CORTE_FECHA);
      const done = h.est === 'Cumplido' || !!h.real;
      const linkedRisk = rs.find((r) => r.hito === h.id) || null;
      const dotBeforeClass = done
        ? 'before:bg-verde-eficiencia'
        : d < 0
          ? 'before:bg-rojo-nacional'
          : d <= anticip
            ? 'before:bg-risk-mid'
            : 'before:bg-ink-muted';
      const badgeClass = done
        ? 'bg-risk-low-bg text-risk-low-text'
        : d < 0
          ? 'bg-risk-high-bg text-risk-high-text'
          : d <= anticip
            ? 'bg-risk-mid-bg text-risk-mid-text'
            : 'bg-surface-subtle text-ink-muted';
      const badgeText = done
        ? 'CUMPLIDO'
        : d < 0
          ? `VENCIDO HACE ${Math.abs(d)} D`
          : d <= anticip
            ? `VENCE EN ${d} D`
            : 'PENDIENTE';

      return { h, done, linkedRisk, dotBeforeClass, badgeClass, badgeText };
    });
  });

  readonly budgetRows = computed(() => {
    const p = this.project();
    if (!p) return [];
    const pr = p.pres;
    const rows = [
      { label: 'PIA', amount: pr.pia },
      { label: 'PIM', amount: pr.pim },
      { label: 'Certificado', amount: pr.cert },
      { label: 'Comprometido', amount: pr.comp },
      { label: 'Devengado', amount: pr.dev },
    ];
    return rows.map((r) => ({
      ...r,
      pct: pr.pim ? Math.min(100, (r.amount / pr.pim) * 100) : 0,
    }));
  });

  readonly contractDueDays = computed(() => {
    const p = this.project();
    if (!p || !p.contrato.fin) return null;
    const d = diffDays(p.contrato.fin, CORTE_FECHA);
    return d >= 0 && d <= 30 ? d : null;
  });

  readonly garantiaDueSoon = computed(() => {
    const p = this.project();
    if (!p || !p.contrato.garantia) return false;
    return diffDays(p.contrato.garantia, CORTE_FECHA) <= 30;
  });

  readonly frequentSuggestions = computed(() => {
    return this.store.getSuggestionsForProject(this.cui());
  });

  readonly projectZona = computed(() => {
    const p = this.project();
    return p?.zona || 'Sierra';
  });

  readonly amDocument = computed(() => {
    const p = this.project();
    if (!p) return null;
    if (this.amType() === 'ej') {
      return buildAmEjecutiva(
        p,
        this.store.riesgos(),
        this.store.compromisos(),
        this.store.seguimientos(),
        this.store.parametros(),
        CORTE_FECHA
      );
    }
    return buildAmRiesgos(
      p,
      this.store.riesgos(),
      this.store.revisiones(),
      this.store.parametros(),
      CORTE_FECHA
    );
  });

  formatDate(iso: string | undefined | null): string {
    return formatDateShort(iso);
  }

  formatSoles(amount: number): string {
    return formatSoles(amount);
  }

  getRiskBadgeClass(level: NivelRiesgo | null): string {
    switch (level) {
      case 'CRÍTICO':
        return 'bg-risk-crit text-white';
      case 'ALTA':
        return 'bg-risk-high-bg text-risk-high-text';
      case 'MODERADA':
        return 'bg-risk-mid-bg text-risk-mid-text';
      case 'BAJA':
        return 'bg-risk-low-bg text-risk-low-text';
      default:
        return 'bg-surface-subtle text-ink-muted';
    }
  }

  getSuggestionLevel(pLab: string, iLab: string): NivelRiesgo {
    return this.store.getRiskLevel({
      p: pLab as 'Moderada',
      i: iLab as 'Moderado',
      mitigable: true,
    });
  }

  getCommitmentDotClass(est: string, f: string): string {
    if (est === 'Cumplido') return 'bg-verde-eficiencia';
    if (diffDays(f, CORTE_FECHA) < 0) return 'bg-rojo-nacional';
    return 'bg-risk-mid';
  }

  openSeguimientoDrawer(): void {
    const p = this.project();
    if (!p) return;
    this.layout.openDrawer({
      kind: 'seg',
      key: p.cui,
      cui: p.cui,
      label: 'Volver al registro semanal',
    });
  }

  openRiskDrawer(id: string): void {
    this.layout.openDrawer({
      kind: 'risk',
      key: id,
      id,
      label: `Volver al riesgo ${id}`,
    });
  }

  openNewRiskForHito(hitoId: string): void {
    const p = this.project();
    if (!p) return;
    this.layout.openDrawer({
      kind: 'risk',
      key: `n-${p.cui}-${hitoId}`,
      cui: p.cui,
      hitoId,
      label: 'Volver al nuevo riesgo',
    });
  }

  openNewRiskWithSuggestion(sugIdx: number): void {
    const p = this.project();
    if (!p) return;
    this.layout.openDrawer({
      kind: 'risk',
      key: `n-${p.cui}-sug-${sugIdx}`,
      cui: p.cui,
      hitoId: `sug:${sugIdx}`,
      label: 'Volver al nuevo riesgo',
    });
  }

  openCommitmentDrawer(id: string): void {
    this.layout.openDrawer({
      kind: 'comp',
      key: id,
      id,
      cui: this.cui(),
      label: `Volver al compromiso ${id}`,
    });
  }

  openNewCommitment(): void {
    this.layout.openDrawer({
      kind: 'comp',
      key: 'n-' + this.cui(),
      cui: this.cui(),
      label: 'Volver al nuevo compromiso',
    });
  }

  markRisksReviewed(): void {
    this.store.recordWeeklyRiskReview(this.cui());
    this.layout.showToast(
      `Revisión semanal registrada por ${this.auth.currentUser().nombre}`
    );
  }

  copyAyudaMemoriaText(): void {
    const doc = this.amDocument();
    if (!doc) return;
    const text = buildAmPlainText(doc);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() =>
          this.layout.showToast('Texto copiado: pégalo en un correo o mensaje')
        )
        .catch(() => this.layout.showToast('No se pudo copiar'));
    } else {
      this.layout.showToast('No se pudo copiar');
    }
  }

  async exportWordDraft(): Promise<void> {
    const p = this.project();
    const doc = this.amDocument();
    if (!p || !doc) return;
    if (!this.auth.canExportWordDraft()) {
      this.layout.showToast('Tu perfil descarga la versión en PDF');
      return;
    }
    const me = this.auth.currentUser();
    const kind = this.amType() === 'rg' ? 'AMR' : 'AME';
    const tr = this.store.recordExportTrace(
      kind,
      `${p.corto} (CUI ${p.cui})`,
      'Word (borrador)',
      buildAmPlainText(doc)
    );
    const clonedDoc = JSON.parse(JSON.stringify(doc)) as typeof doc;
    clonedDoc.blocks.push({
      k: 'note',
      t: `BORRADOR EDITABLE generado por ${me.nombre} (${this.auth.formatAreaLabel(me.area)}) el ${tr.fecha} a las ${tr.hora} · Código ${tr.cod}. No es la versión oficial: la oficial es el PDF que emite el sistema.`,
    });
    const { downloadDocxDraft } = await import('../../../core/export/docx-export.service');
    await downloadDocxDraft(clonedDoc);
    this.layout.showToast(`Descargando ${clonedDoc.file.replace('.docx', '_BORRADOR.docx')}`);
  }

  async exportOfficialPdf(): Promise<void> {
    const p = this.project();
    const doc = this.amDocument();
    if (!p || !doc) return;
    if (!this.auth.canExportProject(p.uo)) {
      this.layout.showToast(
        `Solo ${this.auth.formatAreaLabel(p.uo)}, UPP y la Dirección Ejecutiva pueden exportar este proyecto`
      );
      return;
    }
    this.layout.showToast('Preparando el PDF…');
    try {
      const me = this.auth.currentUser();
      const kind = this.amType() === 'rg' ? 'AMR' : 'AME';
      const tr = this.store.recordExportTrace(
        kind,
        `${p.corto} (CUI ${p.cui})`,
        'PDF',
        buildAmPlainText(doc)
      );
      const { downloadOfficialPdf } = await import('../../../core/export/pdf-export.service');
      await downloadOfficialPdf(doc, tr, me.nombre, this.auth.formatAreaLabel(me.area));
      this.layout.showToast(`Descargando ${doc.file.replace('.docx', '.pdf')}`);
    } catch {
      this.layout.showToast('No se pudo generar el PDF');
    }
  }

  goBack(): void {
    this.layout.goBackDrawer();
  }

  close(): void {
    this.layout.closeDrawer();
  }
}
