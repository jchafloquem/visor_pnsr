import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SspAuthService } from '../../../core/auth/auth.service';
import { CORTE_FECHA } from '../../../core/config/institutional.constants';
import { LayoutStore } from '../../../core/layout/layout.store';
import { IconComponent } from '../../shared/icons/icon.component';
import { ProjectPickerComponent } from '../../shared/ui/project-picker/project-picker.component';
import { SspDomainStore } from '../../cartera/data-access/ssp-domain.store';
import { ExportKindCode, ExportTraceItem } from '../../cartera/models/ssp.models';
import {
  buildAmEjecutiva,
  buildAmPlainText,
  buildAmRiesgos,
  buildExcelReportSpec,
} from '../domain/ayuda-memoria.builder';

const EXPORT_KIND_LABELS: Record<ExportKindCode, string> = {
  AME: 'Ayuda memoria ejecutiva',
  AMR: 'Ayuda memoria de riesgos',
  CAR: 'Reporte en Excel',
  MRZ: 'Matriz de riesgos en Excel',
  MIR: 'Cifras MIRA en Excel',
};

@Component({
  selector: 'app-reportes-page',
  standalone: true,
  imports: [RouterLink, IconComponent, ProjectPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[18px] w-full min-w-0' },
  templateUrl: './reportes-page.component.html',
  styleUrl: './reportes-page.component.css',
})
export class ReportesPageComponent {
  readonly store = inject(SspDomainStore);
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);

  readonly selectedCui = signal<string>('9100101');
  readonly amType = signal<'ej' | 'rg'>('ej');
  readonly verifyCode = signal<string>('');
  readonly verifyResult = signal<ExportTraceItem | false | null>(null);

  readonly scopeLabel = computed(() =>
    this.auth.isRegistrador()
      ? 'de ' + this.auth.formatAreaLabel(this.auth.currentUser().area)
      : 'de todo el PNSR'
  );

  readonly effectiveSelectedCui = computed(() => {
    const ps = this.store.roleScopedProyectos();
    const cur = this.selectedCui();
    if (ps.some((p) => p.cui === cur)) return cur;
    return ps[0]?.cui || '';
  });

  readonly nonRejectedRisksCount = computed(
    () => this.store.roleScopedRiesgos().filter((r) => r.estado !== 'Rechazado').length
  );

  readonly visibleTraces = computed(() => {
    const me = this.auth.currentUser();
    const all = this.store.exportTraces();
    return me.rol === 'upp' || me.rol === 'dir' ? all : all.filter((x) => x.u === me.id);
  });

  getKindLabel(kind: ExportKindCode): string {
    return EXPORT_KIND_LABELS[kind] || kind;
  }

  previewAyudaMemoria(): void {
    const cui = this.effectiveSelectedCui();
    const p = this.store.getProject(cui);
    if (!p) return;
    this.layout.openDrawer({
      kind: 'proj',
      key: cui,
      cui,
      tab: 'am',
      label: `Volver a ${p.corto}`,
    });
  }

  async downloadAmPdf(): Promise<void> {
    const cui = this.effectiveSelectedCui();
    const p = this.store.getProject(cui);
    if (!p) return;
    if (!this.auth.canExportProject(p.uo)) {
      this.layout.showToast(
        `Solo ${this.auth.formatAreaLabel(p.uo)}, UPP y la Dirección Ejecutiva pueden exportar este proyecto`
      );
      return;
    }

    this.layout.showToast('Preparando el PDF…');
    try {
      const doc =
        this.amType() === 'ej'
          ? buildAmEjecutiva(
              p,
              this.store.riesgos(),
              this.store.compromisos(),
              this.store.seguimientos(),
              this.store.parametros(),
              CORTE_FECHA
            )
          : buildAmRiesgos(
              p,
              this.store.riesgos(),
              this.store.revisiones(),
              this.store.parametros(),
              CORTE_FECHA
            );
      const me = this.auth.currentUser();
      const kind: ExportKindCode = this.amType() === 'rg' ? 'AMR' : 'AME';
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

  private buildSpec(kind: 'cart' | 'risk' | 'mira') {
    const me = this.auth.currentUser();
    const roleSuffix =
      me.rol === 'reg' ? ' – ' + this.auth.formatAreaLabel(me.area) : '';
    return buildExcelReportSpec(
      kind,
      this.store.roleScopedProyectos(),
      this.store.roleScopedRiesgos(),
      this.store.riesgos(),
      this.store.projectByCui(),
      this.store.parametros(),
      this.store.revisiones(),
      roleSuffix,
      CORTE_FECHA
    );
  }

  copyExcelTable(kind: 'cart' | 'risk' | 'mira'): void {
    const spec = this.buildSpec(kind);
    const kindCode: ExportKindCode = kind === 'cart' ? 'CAR' : kind === 'risk' ? 'MRZ' : 'MIR';
    const rows = [spec.head, ...spec.rows];
    const tsv = rows
      .map((r) => r.map((v) => String(v == null ? '' : v).replace(/\t|\n/g, ' ')).join('\t'))
      .join('\n');

    this.store.recordExportTrace(kindCode, spec.title, 'Portapapeles', tsv);

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(tsv)
        .then(() =>
          this.layout.showToast(
            'Tabla copiada: pégala en Excel o en un correo. Queda en la bitácora.'
          )
        )
        .catch(() => this.layout.showToast('No se pudo copiar'));
    } else {
      this.layout.showToast('No se pudo copiar');
    }
  }

  async downloadExcel(kind: 'cart' | 'risk' | 'mira'): Promise<void> {
    const spec = this.buildSpec(kind);
    const kindCode: ExportKindCode = kind === 'cart' ? 'CAR' : kind === 'risk' ? 'MRZ' : 'MIR';
    const me = this.auth.currentUser();
    const tr = this.store.recordExportTrace(
      kindCode,
      spec.title,
      'Excel',
      `${spec.title}|${spec.rows.length}`
    );
    const { downloadXlsxReport } = await import('../../../core/export/xlsx-export.service');
    downloadXlsxReport(spec, me.nombre, this.auth.formatAreaLabel(me.area), tr);
    this.layout.showToast(`Descargando ${spec.file}`);
  }

  onVerifyInput(event: Event): void {
    this.verifyCode.set((event.target as HTMLInputElement).value);
  }

  verifyDocument(): void {
    this.verifyResult.set(this.store.verifyExportCode(this.verifyCode()));
  }
}
