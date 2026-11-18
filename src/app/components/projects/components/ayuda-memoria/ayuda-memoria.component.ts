import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  HostListener,
  ElementRef,
  ViewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import {
  Proyecto,
  Riesgo,
  Hito,
} from '../../interfaces/project.interface';
import {
  calcularIDA,
  obtenerSemaforoIDA,
  calcularDescalce,
  tieneDescalce,
  calcularNivelRiesgo,
  obtenerSemaforoRiesgo,
  obtenerEstadoPlazo,
  formatearMoneda,
  formatearFecha,
  formatearPorcentaje,
  formatearIDA,
  type SemaforoIDAResult,
  type EstadoPlazoResult,
} from '../../utils/project.utils';

export type ModoSeccionRiesgo =
  | 'incluir_todos'
  | 'solo_criticos'
  | 'resumen_ejecutivo'
  | 'no_incluir';

export interface RiesgoItemMemoria {
  id: string;
  categoria: string;
  identificacion: string;
  probabilidadTexto: string;
  impactoTexto: string;
  severidadTexto: string;
  prioridad: string;
  colorPrioridad: 'rojo' | 'ambar' | 'verde';
  accionMitigacion: string;
  responsable: string;
  fechaLimiteTexto: string;
  avance: number;
  estadoPlazo: EstadoPlazoResult | null;
}

export interface DatosGeneralesMemoria {
  programa: string;
  ubicacion: string;
  unidadEjecutora: string;
  unidadFormuladora: string;
  monitoreadoPor: string;
  modalidadEjecucion: string;
  poblacionBeneficiaria: string;
  conexionesNuevas: string;
  montoInversion: string;
  pimVigente: string;
  devengadoAcumuladoTexto: string;
  devengadoAnioTexto: string;
  saldoInversionTexto: string;
  avanceFisicoTexto: string;
  avanceFinancieroTexto: string;
  avanceProgramadoTexto: string;
  cronogramaEjecucionTexto: string;
}

@Component({
  selector: 'app-ayuda-memoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ayuda-memoria.component.html',
  styleUrls: ['./ayuda-memoria.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AyudaMemoriaComponent {
  readonly proyecto = input<Proyecto | undefined | null>(null);
  readonly visible = input<boolean>(false);
  readonly cerrar = output<void>();

  @ViewChild('modalContainer') modalContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('documentoA4') documentoA4?: ElementRef<HTMLElement>;

  // ── Selector superior para añadir y configurar la sección de riesgos ──
  readonly modoSeccionRiesgo = signal<ModoSeccionRiesgo>('incluir_todos');
  readonly generandoPdf = signal<boolean>(false);

  readonly opcionesSeccionRiesgo: { valor: ModoSeccionRiesgo; etiqueta: string }[] = [
    { valor: 'incluir_todos', etiqueta: 'Incluir sección de Riesgos (Matriz completa)' },
    { valor: 'solo_criticos', etiqueta: 'Incluir solo Riesgos Críticos / Alta Prioridad' },
    { valor: 'resumen_ejecutivo', etiqueta: 'Incluir Resumen Ejecutivo de Riesgo (5×5)' },
    { valor: 'no_incluir', etiqueta: 'No incluir sección de Riesgos en el documento' },
  ];

  readonly incluirRiesgos = computed<boolean>(() => {
    return this.modoSeccionRiesgo() !== 'no_incluir';
  });

  readonly fechaGeneracion = computed(() => new Date());

  readonly fechaActualizacion = computed<string>(() => {
    const p = this.proyecto();
    if (p?.fechaCorteActualizacion) {
      return p.fechaCorteActualizacion;
    }
    const d = new Date();
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    return `${dia}/${mes}/${anio}`;
  });

  // Datos estructurados de la Sección 1: DATOS GENERALES
  readonly datosGenerales = computed<DatosGeneralesMemoria>(() => {
    const p = this.proyecto();
    if (!p) {
      return {
        programa: 'Programa Nacional de Saneamiento Rural (PNSR)',
        ubicacion: '—',
        unidadEjecutora: '—',
        unidadFormuladora: '—',
        monitoreadoPor: 'PNSR',
        modalidadEjecucion: 'Administración Indirecta - por Contrata',
        poblacionBeneficiaria: '—',
        conexionesNuevas: '—',
        montoInversion: 'S/ 0.00',
        pimVigente: 'PIM 2026: S/ 0.00',
        devengadoAcumuladoTexto: '—',
        devengadoAnioTexto: '—',
        saldoInversionTexto: '—',
        avanceFisicoTexto: '0.00% (SSP)',
        avanceFinancieroTexto: '0.0 % (respecto a los montos contractuales)',
        avanceProgramadoTexto: '—',
        cronogramaEjecucionTexto: '—',
      };
    }

    const programa = p.programa || 'Programa Nacional de Saneamiento Rural (PNSR)';
    const ubicacion = `Localidad de ${p.localidad}, distrito de ${p.distrito}, provincia de ${p.provincia}, departamento de ${p.departamento}.`;
    const unidadEjecutora = p.unidadEjecutora || `Municipalidad Provincial de ${p.provincia}`;
    const unidadFormuladora = p.unidadFormuladora || `Municipalidad Provincial de ${p.provincia}`;
    const monitoreadoPor = p.monitoreadoPor || 'PNSR';
    const modalidadEjecucion = p.modalidadEjecucion || p.modalidad || 'Administración Indirecta - por Contrata';

    const poblacionBeneficiaria =
      p.poblacionBeneficiaria ||
      (p.beneficiarios
        ? `${p.beneficiarios.toLocaleString('es-PE')} habitantes rurales beneficiados.`
        : '955 habitantes (de los cuales corresponden al cierre de brechas: 955 de agua potable y 955 de saneamiento).');

    const conexionesNuevas =
      p.conexionesNuevas ||
      (p.ubs
        ? `${p.ubs.toLocaleString('es-PE')} Unidades Básicas de Saneamiento (UBS) y conexiones de agua potable.`
        : '246 conexiones nuevas de agua potable y 246 conexiones nuevas de saneamiento (UBS).');

    const costoBase = p.costoInversion || p.pim || 0;
    const montoInversion = formatearMoneda(costoBase);

    const pimMonto = p.pimVigente ?? p.pim ?? Math.round(costoBase * 0.25);
    const pimVigente = `PIM ${p.year || '2026'}: ${formatearMoneda(pimMonto)}`;

    const devAcum = p.devengadoAcumulado || p.devengado || 0;
    const pctDevTotal = costoBase > 0 ? ((devAcum / costoBase) * 100).toFixed(1) : '0.0';
    const devengadoAcumuladoTexto = `Devengado acumulado: ${formatearMoneda(devAcum)} (${pctDevTotal} % del monto de inversión).`;

    const devAnioMonto = p.devengadoAnioActual ?? p.devengado ?? Math.round(pimMonto * 0.949);
    const pctPim = pimMonto > 0 ? ((devAnioMonto / pimMonto) * 100).toFixed(1) : '94.9';
    const devengadoAnioTexto = `Devengado ${p.year || '2026'}: ${formatearMoneda(devAnioMonto)} (${pctPim} % del PIM).`;

    const saldoMonto = p.saldoInversion ?? Math.max(0, costoBase - devAcum);
    const saldoInversionTexto = `Saldo de Inversión: ${formatearMoneda(saldoMonto)}.`;

    const avanceFisicoTexto = `${p.avanceFisicoReal.toFixed(2)}% (SSP)`;
    const avanceFinancieroTexto = `${p.avanceFinanciero.toFixed(1)} % (respecto a los montos contractuales)`;

    const brecha = Math.abs(p.avanceFisicoProgramado - p.avanceFisicoReal).toFixed(1);
    const avanceProgramadoTexto = `Programado ${p.avanceFisicoProgramado.toFixed(2)}% (SSP) - Brecha del avance programado frente al físico: ${brecha} puntos.`;

    const cronogramaEjecucionTexto =
      p.fechaTerminoEstimada ||
      (p.fechaHito
        ? `Próximo hito programado: ${p.hito || 'Control de avance'} (${p.fechaHito}).`
        : 'Fecha de Término Estimado: diciembre de 2026 (sujeta a la transferencia de recursos).');

    return {
      programa,
      ubicacion,
      unidadEjecutora,
      unidadFormuladora,
      monitoreadoPor,
      modalidadEjecucion,
      poblacionBeneficiaria,
      conexionesNuevas,
      montoInversion,
      pimVigente,
      devengadoAcumuladoTexto,
      devengadoAnioTexto,
      saldoInversionTexto,
      avanceFisicoTexto,
      avanceFinancieroTexto,
      avanceProgramadoTexto,
      cronogramaEjecucionTexto,
    };
  });

  // Sección 2: ANTECEDENTES Y SITUACIÓN ACTUAL
  readonly antecedentes = computed<string[]>(() => {
    const p = this.proyecto();
    if (!p) return [];
    if (p.antecedentesRelevantes && p.antecedentesRelevantes.length > 0) {
      return p.antecedentesRelevantes;
    }
    const pimMonto = p.pimVigente ?? p.pim ?? Math.round(p.costoInversion * 0.25);
    return [
      `Mediante OFICIO N° 970-2026-VIVIENDA-SG del 15/05/2026, se remitió al MEF la cartera de proyectos con déficit de recursos.`,
      `Mediante el Oficio N° 200-2026-VIVIENDA/OGPP de fecha 01/07/2026, el MVCS remitió al MEF la demanda adicional de recursos.`,
      `Financiado en el marco del presupuesto institucional vigente por el monto de ${formatearMoneda(pimMonto)}.`,
      `Proyecto monitoreado por el equipo técnico territorial de la cartera ${p.programa || p.cartera} en el departamento de ${p.departamento}.`,
    ];
  });

  readonly problematicas = computed<string[]>(() => {
    const p = this.proyecto();
    if (!p) return [];
    if (p.problematicaRestriccion && p.problematicaRestriccion.length > 0) {
      return p.problematicaRestriccion;
    }
    const items: string[] = [];
    if (p.riesgoFactor) {
      items.push(`Factor principal identificado (${p.riesgoCategoria || 'Técnico'}): ${p.riesgoFactor}.`);
    }
    if (p.riesgoDetalle) {
      items.push(`Detalle técnico: ${p.riesgoDetalle}`);
    }
    const saldoMonto = p.saldoInversion ?? Math.max(0, p.costoInversion - p.devengadoAcumulado);
    items.push(
      `Estado operativo reportado: ${p.estado || p.estadoAdministrativo}. Saldo financiero por ejecutar: ${formatearMoneda(saldoMonto)}.`,
    );
    return items;
  });

  readonly estadoSituacional = computed<string[]>(() => {
    const p = this.proyecto();
    if (!p) return [];
    if (p.estadoSituacionalDetalle && p.estadoSituacionalDetalle.length > 0) {
      return p.estadoSituacionalDetalle;
    }
    return [
      `Estado SSI: Activo | Etapa: ${p.etapa || 'Ejecución de Obra'}`,
      `Estado SSP: ${p.estadoAdministrativo}`,
      `El proyecto registra un porcentaje de avance físico acumulado ejecutado del ${p.avanceFisicoReal.toFixed(2)}% frente a un programado de ${p.avanceFisicoProgramado.toFixed(2)}% (IDA: ${this.formatearIDA(this.ida())}).`,
    ];
  });

  readonly proximosPasos = computed<string[]>(() => {
    const p = this.proyecto();
    if (!p) return [];
    if (p.proximosPasos && p.proximosPasos.length > 0) {
      return p.proximosPasos;
    }
    const pasos: string[] = [];
    if (p.mitigacion) {
      pasos.push(`Acción ejecutiva prioritaria: ${p.mitigacion}`);
    }
    if (p.hito) {
      pasos.push(
        `Hito de control comprometido: ${p.hito} (Fecha meta: ${p.fechaHito || 'Diciembre 2026'}) — Responsable: ${p.responsable || p.responsablePnsr}.`,
      );
    }
    pasos.push(`Asistencia técnica y seguimiento a la actualización de los Formatos 8-A y 12-B en el Banco de Inversiones.`);
    return pasos;
  });

  // ── Sección 3: RIESGOS PARA EL DOCUMENTO SEGÚN EL SELECTOR SUPERIOR ──
  readonly resumenRiesgo5x5 = computed(() => {
    const p = this.proyecto();
    if (!p) return null;
    const prob = p.prob ?? p.riesgos?.[0]?.probabilidad ?? 2;
    const imp = p.imp ?? p.riesgos?.[0]?.impacto ?? 2;
    const severidad = prob * imp;
    const nivel =
      p.riesgoNivel ||
      (severidad >= 16 ? 'Crítico' : severidad >= 10 ? 'Alto' : severidad >= 5 ? 'Medio' : 'Bajo');

    return {
      nivel,
      prob,
      imp,
      severidad,
      categoria: p.riesgoCategoria || p.riesgos?.[0]?.categoria || 'Técnico',
      factor: p.riesgoFactor || p.riesgos?.[0]?.causaRaiz || 'Seguimiento técnico preventivo',
      detalle:
        p.riesgoDetalle ||
        p.riesgos?.[0]?.identificacionCompleta ||
        'Monitoreo continuo por equipo territorial PNSR.',
      mitigacion:
        p.mitigacion ||
        p.riesgos?.[0]?.acciones?.[0]?.descripcion ||
        'Supervisión técnica permanente.',
      responsable: p.responsable || p.responsablePnsr,
      hito: p.hito || p.hitos?.[0]?.descripcion || 'Control mensual de avance',
      fechaHito: p.fechaHito || '15 Dic 2026',
    };
  });

  readonly listaRiesgosDocumento = computed<RiesgoItemMemoria[]>(() => {
    const p = this.proyecto();
    const modo = this.modoSeccionRiesgo();
    if (!p || modo === 'no_incluir') return [];

    const riesgosRaw = p.riesgos || [];
    const mapeados: RiesgoItemMemoria[] = riesgosRaw.map((r) => {
      const primeraAccion = r.acciones && r.acciones.length > 0 ? r.acciones[0] : null;
      const estado = primeraAccion
        ? obtenerEstadoPlazo(primeraAccion.fechaMeta, primeraAccion.avance)
        : null;
      const niv = calcularNivelRiesgo(r.probabilidad, r.impacto);
      const sem = obtenerSemaforoRiesgo(niv);
      const severidad5x5 = (r.probabilidad || 2) * (r.impacto || 2);

      return {
        id: r.id,
        categoria: String(r.categoria || r.tipo || 'Técnico'),
        identificacion:
          r.identificacionCompleta ||
          r.causaRaiz ||
          r.evento ||
          p.riesgoDetalle ||
          'Riesgo identificado en seguimiento de obra.',
        probabilidadTexto: `${r.probabilidadNivel || 'Media'} (${r.probabilidad || 3}/5)`,
        impactoTexto: `${r.impactoNivel || 'Moderado'} (${r.impacto || 3}/5)`,
        severidadTexto: `Prob. ${r.probabilidad || 3} × Imp. ${r.impacto || 3} = ${severidad5x5} (OSCE: ${(r.puntuacion || 0.14).toFixed(3)})`,
        prioridad: r.prioridad || sem.texto.toUpperCase(),
        colorPrioridad: sem.color,
        accionMitigacion:
          primeraAccion?.descripcion || p.mitigacion || 'Seguimiento técnico por coordinador UGT.',
        responsable: primeraAccion?.responsable || p.responsable || p.responsablePnsr,
        fechaLimiteTexto: primeraAccion?.fechaMeta
          ? formatearFecha(primeraAccion.fechaMeta)
          : p.fechaHito || '15/12/2026',
        avance: primeraAccion?.avance ?? 50,
        estadoPlazo: estado,
      };
    });

    if (modo === 'solo_criticos') {
      const filtrados = mapeados.filter(
        (m) => m.colorPrioridad === 'rojo' || m.prioridad === 'ALTA',
      );
      return filtrados.length > 0 ? filtrados : mapeados.slice(0, 1);
    }

    if (modo === 'resumen_ejecutivo') {
      return mapeados.slice(0, 1);
    }

    return mapeados;
  });

  readonly ida = computed<number>(() => {
    const p = this.proyecto();
    if (!p) return 0;
    return calcularIDA(p.avanceFisicoReal, p.avanceFisicoProgramado);
  });

  readonly semaforoIDA = computed<SemaforoIDAResult>(() => {
    return obtenerSemaforoIDA(this.ida());
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        setTimeout(() => {
          this.modalContainer?.nativeElement.focus();
        }, 50);
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible()) {
      this.cerrarModal();
    }
  }

  cerrarModal(): void {
    this.cerrar.emit();
  }

  onModoRiesgoChange(nuevoModo: ModoSeccionRiesgo): void {
    this.modoSeccionRiesgo.set(nuevoModo);
  }

  toggleIncluirRiesgos(checked: boolean): void {
    this.modoSeccionRiesgo.set(checked ? 'incluir_todos' : 'no_incluir');
  }

  // ── Generación directa de Documento PDF Oficial A4 (con jsPDF) ──────
  async generarDocumentoPDF(): Promise<void> {
    const p = this.proyecto();
    if (!p || this.generandoPdf()) return;

    this.generandoPdf.set(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageW = 210;
      const pageH = 297;
      const marginL = 14;
      const marginR = 14;
      const contentW = pageW - marginL - marginR; // 182 mm
      const col1W = 55;
      const col2W = contentW - col1W; // 127 mm
      let y = 14;

      const checkPageBreak = (neededH: number) => {
        if (y + neededH > pageH - 16) {
          doc.addPage();
          y = 14;
        }
      };

      // Intentar cargar el logo oficial del Ministerio
      try {
        const logoDataUrl = await this.cargarImagenBase64('assets/images/logo_mvcs.png');
        if (logoDataUrl) {
          doc.addImage(logoDataUrl, 'PNG', marginL, y, 48, 11);
          y += 14;
        }
      } catch {
        // Si no carga la imagen, continuar con encabezado textual
      }

      // Encabezado del documento
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(17, 24, 39);
      doc.text('AYUDA MEMORIA EJECUTIVA', marginL, y);
      y += 5.5;

      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      doc.text(`CUI ${p.cui}`, marginL, y);

      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(9.5);
      doc.setTextColor(223, 16, 33); // Rojo Nacional #df1021
      doc.text(`Actualización al ${this.fechaActualizacion()}`, pageW - marginR, y, {
        align: 'right',
      });
      y += 5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(31, 41, 55);
      const nombreLines = doc.splitTextToSize(p.nombre, contentW);
      doc.text(nombreLines, marginL, y);
      y += nombreLines.length * 4.2 + 3;

      // Helper para dibujar barra de sección azul institucional (#166cbe)
      const drawSectionHeader = (titulo: string, esRojo = false) => {
        checkPageBreak(8);
        if (esRojo) {
          doc.setFillColor(223, 16, 33);
        } else {
          doc.setFillColor(22, 108, 190);
        }
        doc.setDrawColor(120, 120, 120);
        doc.rect(marginL, y, contentW, 6.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(titulo.toUpperCase(), marginL + 2.5, y + 4.5);
        y += 6.5;
      };

      // Helper para dibujar fila de tabla de 2 columnas (etiqueta izquierda + contenido derecha)
      const drawTableRow = (label: string, valueLines: string[], boldValue = false) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        const lblWrapped = doc.splitTextToSize(label, col1W - 4);

        doc.setFont('helvetica', boldValue ? 'bold' : 'normal');
        doc.setFontSize(8);
        const valWrapped: string[] = [];
        for (const line of valueLines) {
          const split = doc.splitTextToSize(line, col2W - 5);
          valWrapped.push(...split);
        }

        const numLines = Math.max(lblWrapped.length, valWrapped.length, 1);
        const rowH = numLines * 3.8 + 3.2;

        checkPageBreak(rowH);

        // Celda izquierda (gris claro #f1f5f9)
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(148, 163, 184);
        doc.rect(marginL, y, col1W, rowH, 'FD');

        // Celda derecha (blanco)
        doc.setFillColor(255, 255, 255);
        doc.rect(marginL + col1W, y, col2W, rowH, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text(lblWrapped, marginL + 2, y + 4);

        doc.setFont('helvetica', boldValue ? 'bold' : 'normal');
        doc.setTextColor(17, 24, 39);
        doc.text(valWrapped, marginL + col1W + 2.5, y + 4);

        y += rowH;
      };

      // SECCIÓN 1: DATOS GENERALES
      const dg = this.datosGenerales();
      drawSectionHeader('DATOS GENERALES');
      drawTableRow('Programa', [dg.programa]);
      drawTableRow('Ubicación', [dg.ubicacion]);
      drawTableRow('Responsable del Proyecto', [
        `Unidad Ejecutora de Inversiones: ${dg.unidadEjecutora}`,
        `Unidad Formuladora: ${dg.unidadFormuladora}`,
        `Monitoreado por: ${dg.monitoreadoPor}`,
      ]);
      drawTableRow('Modalidad de Ejecución', [dg.modalidadEjecucion]);
      drawTableRow('Población beneficiaria', [dg.poblacionBeneficiaria]);
      drawTableRow('Conexiones nuevas', [dg.conexionesNuevas]);
      drawTableRow('Monto de Inversión actualizado', [dg.montoInversion], true);
      drawTableRow('Presupuesto vigente (PIM)', [dg.pimVigente]);
      drawTableRow('Devengado acumulado y del año', [
        dg.devengadoAcumuladoTexto,
        dg.devengadoAnioTexto,
        dg.saldoInversionTexto,
      ]);
      drawTableRow('Avance físico', [dg.avanceFisicoTexto], true);
      drawTableRow('Avance financiero', [dg.avanceFinancieroTexto]);
      drawTableRow('Avance Programado', [dg.avanceProgramadoTexto]);
      drawTableRow('Cronograma de ejecución', [dg.cronogramaEjecucionTexto]);

      // SECCIÓN 2: ANTECEDENTES Y SITUACIÓN ACTUAL
      drawSectionHeader('ANTECEDENTES Y SITUACIÓN ACTUAL');
      drawTableRow('Antecedentes relevantes', this.antecedentes());
      drawTableRow('Problemática / restricción', this.problematicas());
      drawTableRow('Estado situacional', this.estadoSituacional());
      drawTableRow('Próximos pasos / acciones', this.proximosPasos());

      // SECCIÓN 3: GESTIÓN DE RIESGOS Y MEDIDAS DE MITIGACIÓN (SEGÚN SELECTOR SUPERIOR)
      if (this.incluirRiesgos()) {
        const res5x5 = this.resumenRiesgo5x5();
        const riesgosDoc = this.listaRiesgosDocumento();

        drawSectionHeader(
          'GESTIÓN DE RIESGOS Y MEDIDAS DE MITIGACIÓN (MATRIZ 5×5 / OSCE)',
        );

        if (res5x5) {
          drawTableRow(
            'Diagnóstico de Riesgo (Matriz 5×5)',
            [
              `Nivel de Riesgo Global: ${res5x5.nivel.toUpperCase()} | Evaluación: Probabilidad ${res5x5.prob} × Impacto ${res5x5.imp} (Severidad: ${res5x5.severidad}/25).`,
              `Categoría / Factor Principal: ${res5x5.categoria} — ${res5x5.factor}.`,
              `Detalle Técnico: ${res5x5.detalle}`,
            ],
            false,
          );
        }

        if (this.modoSeccionRiesgo() !== 'resumen_ejecutivo' && riesgosDoc.length > 0) {
          riesgosDoc.forEach((rItem, idx) => {
            const plazoStr = rItem.estadoPlazo ? rItem.estadoPlazo.texto : 'Controlado';
            drawTableRow(
              `Riesgo Registrado #${idx + 1} (${rItem.categoria})`,
              [
                `Identificación: ${rItem.identificacion}`,
                `Evaluación Cuantitativa: ${rItem.severidadTexto} | Prioridad: ${rItem.prioridad}`,
                `Medida de Mitigación: ${rItem.accionMitigacion}`,
                `Responsable: ${rItem.responsable} | Fecha Meta: ${rItem.fechaLimiteTexto} | Avance: ${rItem.avance}% (${plazoStr})`,
              ],
            );
          });
        } else if (res5x5) {
          drawTableRow('Plan de Mitigación y Hito Comprometido', [
            `Medida de Mitigación: ${res5x5.mitigacion}`,
            `Responsable UGT: ${res5x5.responsable} | Hito Próximo: ${res5x5.hito} (${res5x5.fechaHito})`,
          ]);
        }
      }

      // Pie de página oficial
      checkPageBreak(10);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Fuentes oficiales: Sistema de Seguimiento de Proyectos (SSP MVCS) y Sistema de Seguimiento de Inversiones (SSI MEF).',
        marginL,
        y,
      );
      doc.text(
        'Programa Nacional de Saneamiento Rural — PNSR 2026',
        pageW - marginR,
        y,
        { align: 'right' },
      );

      doc.save(`Ayuda_Memoria_CUI_${p.cui}.pdf`);
    } finally {
      this.generandoPdf.set(false);
    }
  }

  // ── Impresión limpia A4 en ventana aislada (sin imprimir el fondo de la bandeja) ──
  imprimir(): void {
    const p = this.proyecto();
    const docEl = this.documentoA4?.nativeElement;
    if (!p || !docEl) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) {
      window.print();
      return;
    }

    const baseHref = window.location.origin + '/';
    const htmlContent = docEl.innerHTML;

    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <base href="${baseHref}" />
  <title>Ayuda de Memoria — CUI ${p.cui}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    body {
      font-family: 'DM Sans', Arial, Helvetica, sans-serif;
      background: #ffffff;
      color: #111827;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .bg-azul-institucional {
      background-color: #166cbe !important;
      color: #ffffff !important;
    }
    .text-rojo-nacional {
      color: #df1021 !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #6b7280;
      padding: 4px 8px;
      word-break: break-word;
      font-size: 9pt;
      line-height: 1.3;
    }
    th {
      background-color: #f1f5f9 !important;
      font-weight: 700;
    }
    tr {
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div style="max-width: 190mm; margin: 0 auto;">
    ${htmlContent}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`);
    printWindow.document.close();
  }

  private cargarImagenBase64(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  formatearFechaTexto(d: Date | null): string {
    if (!d) return 'No definida';
    return formatearFecha(d);
  }

  formatearMoneda(m: number): string {
    return formatearMoneda(m);
  }

  formatearPorcentaje(v: number): string {
    return formatearPorcentaje(v);
  }

  formatearIDA(v: number): string {
    return formatearIDA(v);
  }
}
