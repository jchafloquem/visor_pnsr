import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  HostListener,
  ElementRef,
  ViewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Proyecto,
  PuntoCurvaS,
} from '../../interfaces/project.interface';
import {
  generarCurvaS,
  calcularIDA,
  obtenerSemaforoIDA,
  calcularDescalce,
  tieneDescalce,
  formatearMoneda,
  formatearIDA,
  formatearPorcentaje,
  type SemaforoIDAResult,
} from '../../utils/project.utils';

export interface SvgCoordenada {
  x: number;
  y: number;
  punto: PuntoCurvaS;
}

export interface EvaluacionPredictivaIA {
  viabilidadEstado: 'VIABLE' | 'VIABLE CONDICIONADO' | 'NO VIABLE EN PLAZO';
  viabilidadTexto: string;
  metaEstado: 'CUMPLE META' | 'EN RIESGO' | 'NO CUMPLE META';
  metaTexto: string;
  probabilidadMeta: number;
  resumenEjecutivo: string;
  recomendaciones: string[];
}

@Component({
  selector: 'app-curva-s-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './curva-s-modal.component.html',
  styleUrls: ['./curva-s-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurvaSModalComponent {
  readonly proyecto = input<Proyecto | undefined | null>(null);
  readonly visible = input<boolean>(false);
  readonly cerrar = output<void>();

  @ViewChild('modalContainer') modalContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('curvaSDoc') curvaSDoc?: ElementRef<HTMLElement>;

  readonly puntoHover = signal<PuntoCurvaS | null>(null);

  readonly puntosCurvaS = computed<PuntoCurvaS[]>(() => {
    const p = this.proyecto();
    if (!p) return [];
    return generarCurvaS(p);
  });

  readonly ida = computed<number>(() => {
    const p = this.proyecto();
    if (!p) return 0;
    return calcularIDA(p.avanceFisicoReal, p.avanceFisicoProgramado);
  });

  readonly semaforoIDA = computed<SemaforoIDAResult>(() => {
    return obtenerSemaforoIDA(this.ida());
  });

  readonly descalce = computed<number>(() => {
    const p = this.proyecto();
    if (!p) return 0;
    return calcularDescalce(p.avanceFinanciero, p.avanceFisicoReal);
  });

  readonly existeDescalce = computed<boolean>(() => {
    const p = this.proyecto();
    if (!p) return false;
    return tieneDescalce(p.avanceFinanciero, p.avanceFisicoReal);
  });

  readonly spi = computed<string>(() => {
    const p = this.proyecto();
    if (!p || !p.avanceFisicoProgramado) return '0.00';
    return (p.avanceFisicoReal / p.avanceFisicoProgramado).toFixed(2);
  });

  readonly cpi = computed<string>(() => {
    const p = this.proyecto();
    if (!p) return '0.00';
    const fin = Math.max(1, p.avanceFinanciero || 0);
    return (p.avanceFisicoReal / fin).toFixed(2);
  });

  readonly prob5x5 = computed<number>(() => {
    const p = this.proyecto();
    return p?.prob ?? p?.riesgos?.[0]?.probabilidad ?? 2;
  });

  readonly imp5x5 = computed<number>(() => {
    const p = this.proyecto();
    return p?.imp ?? p?.riesgos?.[0]?.impacto ?? 2;
  });

  readonly severidad5x5 = computed<number>(() => {
    return this.prob5x5() * this.imp5x5();
  });

  readonly nivelRiesgo5x5 = computed<string>(() => {
    const p = this.proyecto();
    if (p?.riesgoNivel) return p.riesgoNivel;
    const s = this.severidad5x5();
    if (s >= 16) return 'Crítico';
    if (s >= 10) return 'Alto';
    if (s >= 5) return 'Medio';
    return 'Bajo';
  });

  readonly evaluandoIA = signal<boolean>(false);
  readonly iteracionRecalculoIA = signal<number>(0);

  readonly evaluacionIA = computed<EvaluacionPredictivaIA | null>(() => {
    const p = this.proyecto();
    const _iter = this.iteracionRecalculoIA();
    if (!p) return null;

    const spiNum = Number(this.spi());
    const cpiNum = Number(this.cpi());
    const finPct = p.avanceFinanciero;
    const brechaFisica = Number((p.avanceFisicoReal - p.avanceFisicoProgramado).toFixed(1));
    const estado = p.estado || p.estadoAdministrativo || 'En Ejecución';
    const nivel = this.nivelRiesgo5x5();

    let viabilidadEstado: 'VIABLE' | 'VIABLE CONDICIONADO' | 'NO VIABLE EN PLAZO' = 'VIABLE';
    let viabilidadTexto = 'Viable Técnica y Operativamente';
    let metaEstado: 'CUMPLE META' | 'EN RIESGO' | 'NO CUMPLE META' = 'CUMPLE META';
    let metaTexto = 'Alta probabilidad de cumplir meta anual';
    let probMeta = 88;

    if (estado === 'Culminado' || p.avanceFisicoReal >= 100) {
      probMeta = 100;
      metaTexto = 'Meta física culminada (100%)';
    } else if (
      estado.toLowerCase().includes('paraliz') ||
      nivel === 'Crítico' ||
      spiNum < 0.78
    ) {
      viabilidadEstado = 'NO VIABLE EN PLAZO';
      viabilidadTexto = 'Viabilidad Condicionada / Requiere Intervención';
      metaEstado = 'NO CUMPLE META';
      metaTexto = 'No logrará cumplir la meta sin reprogramación';
      probMeta = Math.max(18, Math.min(44, Math.round(spiNum * 52)));
    } else if (nivel === 'Alto' || brechaFisica < -8 || spiNum < 0.92) {
      viabilidadEstado = 'VIABLE CONDICIONADO';
      viabilidadTexto = 'Viable con Medidas Correctivas Inmediatas';
      metaEstado = 'EN RIESGO';
      metaTexto = 'Cumplimiento sujeto a plan de aceleración';
      probMeta = Math.max(48, Math.min(74, Math.round(spiNum * 78)));
    }

    const programaLabel = p.programa || p.cartera;
    const catLabel = (p.riesgoCategoria || p.riesgos?.[0]?.categoria || 'gestión técnica').toLowerCase();
    const mitigacionTexto =
      p.mitigacion ||
      p.riesgos?.[0]?.acciones?.[0]?.descripcion ||
      'Reforzar supervisión de campo y control semanal de partidas críticas.';
    const hitoTexto = p.hito || p.hitos?.[0]?.descripcion || 'Verificación de hito de obra';
    const fechaHitoTexto = p.fechaHito || 'cierre del trimestre';
    const respTexto = p.responsable || p.responsablePnsr;
    const jassTexto = p.jass || 'Constituida y reconocida (ATM)';

    const resumenEjecutivo = `El proyecto CUI ${p.cui} (${programaLabel} - ${p.departamento}) presenta un avance físico de ${p.avanceFisicoReal}% frente a ${p.avanceFisicoProgramado}% programado (brecha de ${brechaFisica > 0 ? '+' : ''}${brechaFisica}%, SPI=${spiNum.toFixed(2)}) y ejecución financiera de ${finPct.toFixed(1)}% (CPI=${cpiNum.toFixed(2)}). Dado su estado "${estado}" y riesgo ${nivel.toLowerCase()} por ${catLabel}, ${
      probMeta >= 75
        ? 'mantiene condiciones favorables para cerrar la meta del periodo.'
        : 'se proyecta un desfase al cierre del ejercicio fiscal si no se resuelve el cuello de botella identificado.'
    }`;

    const recomendaciones = [
      `Ejecutar de inmediato: ${mitigacionTexto}`,
      `Monitorear semanalmente el hito "${hitoTexto}" comprometido para el ${fechaHitoTexto} bajo responsabilidad de ${respTexto}.`,
      spiNum < 0.92
        ? `Implementar frentes paralelos de trabajo y actualizar la Curva S reprogramada para recuperar el SPI (${spiNum.toFixed(2)} → ≥0.95).`
        : `Asegurar la sostenibilidad operativa con la JASS (${jassTexto}) y el cierre oportuno de valorizaciones en SIAF / INFOBRAS.`,
    ];

    return {
      viabilidadEstado,
      viabilidadTexto,
      metaEstado,
      metaTexto,
      probabilidadMeta: probMeta + (_iter % 2),
      resumenEjecutivo,
      recomendaciones,
    };
  });

  recalcularConIA(): void {
    this.evaluandoIA.set(true);
    setTimeout(() => {
      this.iteracionRecalculoIA.update((v) => v + 1);
      this.evaluandoIA.set(false);
    }, 450);
  }

  // ── Dimensiones del gráfico SVG ──────────────────────────────────────────
  readonly svgWidth = 740;
  readonly svgHeight = 260;
  readonly padLeft = 45;
  readonly padRight = 25;
  readonly padTop = 25;
  readonly padBottom = 35;

  private get graphWidth(): number {
    return this.svgWidth - this.padLeft - this.padRight;
  }

  private get graphHeight(): number {
    return this.svgHeight - this.padTop - this.padBottom;
  }

  readonly coordsProgramado = computed<SvgCoordenada[]>(() => {
    const puntos = this.puntosCurvaS();
    if (puntos.length <= 1) return [];
    const total = puntos.length - 1;

    return puntos.map((p, idx) => {
      const x = this.padLeft + (idx / total) * this.graphWidth;
      const y = this.padTop + (1 - p.programadoAcumulado / 100) * this.graphHeight;
      return { x, y, punto: p };
    });
  });

  readonly coordsEjecutado = computed<SvgCoordenada[]>(() => {
    const puntos = this.puntosCurvaS();
    if (puntos.length <= 1) return [];
    const total = puntos.length - 1;

    return puntos
      .filter((p) => p.ejecutadoAcumulado !== null)
      .map((p) => {
        const idx = p.mesNumero - 1;
        const x = this.padLeft + (idx / total) * this.graphWidth;
        const y = this.padTop + (1 - (p.ejecutadoAcumulado ?? 0) / 100) * this.graphHeight;
        return { x, y, punto: p };
      });
  });

  readonly coordsFinanciero = computed<SvgCoordenada[]>(() => {
    const puntos = this.puntosCurvaS();
    if (puntos.length <= 1) return [];
    const total = puntos.length - 1;

    return puntos
      .filter((p) => p.financieroAcumulado !== null)
      .map((p) => {
        const idx = p.mesNumero - 1;
        const x = this.padLeft + (idx / total) * this.graphWidth;
        const y = this.padTop + (1 - (p.financieroAcumulado ?? 0) / 100) * this.graphHeight;
        return { x, y, punto: p };
      });
  });

  readonly pathProgramado = computed<string>(() => {
    const c = this.coordsProgramado();
    if (c.length === 0) return '';
    return c.reduce((acc, curr, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${curr.x} ${curr.y}`, '');
  });

  readonly pathEjecutado = computed<string>(() => {
    const c = this.coordsEjecutado();
    if (c.length === 0) return '';
    return c.reduce((acc, curr, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${curr.x} ${curr.y}`, '');
  });

  readonly pathFinanciero = computed<string>(() => {
    const c = this.coordsFinanciero();
    if (c.length === 0) return '';
    return c.reduce((acc, curr, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${curr.x} ${curr.y}`, '');
  });

  readonly areaSombreadaEjecutado = computed<string>(() => {
    const c = this.coordsEjecutado();
    if (c.length === 0) return '';
    const yCero = this.padTop + this.graphHeight;
    const startX = c[0].x;
    const endX = c[c.length - 1].x;
    const pointsPath = c.reduce((acc, curr) => `${acc} L ${curr.x} ${curr.y}`, `M ${startX} ${yCero}`);
    return `${pointsPath} L ${endX} ${yCero} Z`;
  });

  readonly coordMesCorte = computed<{ x: number; top: number; bottom: number } | null>(() => {
    const c = this.coordsProgramado();
    const puntoCorte = c.find((coord) => coord.punto.esMesCorte);
    if (!puntoCorte) return null;
    return {
      x: puntoCorte.x,
      top: this.padTop - 8,
      bottom: this.padTop + this.graphHeight,
    };
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
    this.puntoHover.set(null);
  }

  imprimir(): void {
    const p = this.proyecto();
    const docEl = this.curvaSDoc?.nativeElement;
    if (!p || !docEl) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=960,height=820');
    if (!printWindow) {
      window.print();
      return;
    }

    const baseHref = window.location.origin + '/';
    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <base href="${baseHref}" />
  <title>Curva S y Ficha Ejecutiva — CUI ${p.cui}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    body {
      font-family: 'DM Sans', Arial, sans-serif;
      background: #ffffff;
      color: #111827;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print { display: none !important; }
    .bg-azul-institucional { background-color: #166cbe !important; color: #ffffff !important; }
    .bg-gris-estructura { background-color: #2b3341 !important; color: #ffffff !important; }
    .text-azul-institucional { color: #166cbe !important; }
    .text-rojo-nacional { color: #df1021 !important; }
    .bg-rojo-nacional { background-color: #df1021 !important; }
  </style>
</head>
<body>
  <div style="max-width: 190mm; margin: 0 auto;">
    ${docEl.innerHTML}
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

  formatearMoneda = formatearMoneda;
  formatearIDA = formatearIDA;
  formatearPorcentaje = formatearPorcentaje;
}
