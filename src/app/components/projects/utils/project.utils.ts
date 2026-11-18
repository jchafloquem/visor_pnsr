/**
 * Funciones utilitarias puras para el modulo de proyectos.
 * Sin dependencias de Angular — tree-shakeable.
 */

import {
  CategoriaRiesgoOSCE,
  ProbabilidadNivelOSCE,
  ImpactoNivelOSCE,
  PrioridadRiesgoOSCE,
  PuntoCurvaS,
  Proyecto,
} from '../interfaces/project.interface';

export interface SemaforoResult {
  color: 'verde' | 'ambar' | 'rojo';
  texto: string;
}

export interface SemaforoIDAResult {
  color: 'verde' | 'ambar' | 'critico';
  texto: string;
}

export interface EstadoPlazoResult {
  estado: 'vencido' | 'por_vencer' | 'controlado' | 'mitigado';
  texto: string;
  diasRestantes: number | null;
}

// ---------------------------------------------------------------------------
// MATRIZ DE RIESGOS - OSCE (Directiva N° 012-2017-OSCE/CD)
// ---------------------------------------------------------------------------

export interface CategoriaRiesgoInfo {
  id: number;
  nombre: CategoriaRiesgoOSCE;
  descripcion: string;
}

export const CATEGORIAS_RIESGO_OSCE: CategoriaRiesgoInfo[] = [
  { id: 1, nombre: 'Diseño', descripcion: 'Expediente técnico, estudios' },
  { id: 2, nombre: 'Climatológicos', descripcion: 'Lluvias, inundaciones, huaycos, etc' },
  { id: 3, nombre: 'Sociales', descripcion: 'Conflictos, acceso, aceptación' },
  { id: 4, nombre: 'Legales y contractuales', descripcion: 'Controversias, obligaciones' },
  { id: 5, nombre: 'Constructivos', descripcion: 'Terreno, ejecución de obra, calidad, etc' },
  { id: 6, nombre: 'Logísticos', descripcion: 'Materiales, equipos' },
  { id: 7, nombre: 'Arqueológicos', descripcion: 'Hallazgos en obra' },
  { id: 8, nombre: 'Permisos y licencias', descripcion: 'Autorizaciones, servidumbres' },
  { id: 9, nombre: 'Financieros', descripcion: 'Presupuesto, desembolsos' },
  { id: 10, nombre: 'Gestión y organización', descripcion: 'Coordinación, recursos' },
  { id: 11, nombre: 'Interferencias', descripcion: 'Redes, infraestructura existente' },
  { id: 12, nombre: 'Múltiple', descripcion: 'Implica más de 2 categorías de riesgos' },
  { id: 13, nombre: 'Sin riesgo', descripcion: 'Sin riesgo' },
];

export const TABLA_PROBABILIDAD_OSCE: { nivel: ProbabilidadNivelOSCE; valor: number; etiqueta: string }[] = [
  { nivel: 'Muy Alta', valor: 0.90, etiqueta: 'Muy Alta (0.90)' },
  { nivel: 'Alta', valor: 0.70, etiqueta: 'Alta (0.70)' },
  { nivel: 'Moderada', valor: 0.50, etiqueta: 'Moderada (0.50)' },
  { nivel: 'Baja', valor: 0.30, etiqueta: 'Baja (0.30)' },
  { nivel: 'Muy Baja', valor: 0.10, etiqueta: 'Muy Baja (0.10)' },
];

export const TABLA_IMPACTO_OSCE: { nivel: ImpactoNivelOSCE; valor: number; etiqueta: string }[] = [
  { nivel: 'Muy Alto', valor: 0.80, etiqueta: 'Muy Alto (0.80)' },
  { nivel: 'Alto', valor: 0.40, etiqueta: 'Alto (0.40)' },
  { nivel: 'Moderado', valor: 0.20, etiqueta: 'Moderado (0.20)' },
  { nivel: 'Bajo', valor: 0.10, etiqueta: 'Bajo (0.10)' },
  { nivel: 'Muy Bajo', valor: 0.05, etiqueta: 'Muy Bajo (0.05)' },
];

export interface EvaluacionRiesgoOSCE {
  probabilidadNivel: ProbabilidadNivelOSCE;
  probabilidadValor: number;
  impactoNivel: ImpactoNivelOSCE;
  impactoValor: number;
  resultado: number;
  prioridad: PrioridadRiesgoOSCE;
  color: 'rojo' | 'ambar' | 'verde';
}

export function calcularRiesgoOSCE(
  probabilidadNivel: ProbabilidadNivelOSCE,
  impactoNivel: ImpactoNivelOSCE,
): EvaluacionRiesgoOSCE {
  const probItem =
    TABLA_PROBABILIDAD_OSCE.find((p) => p.nivel === probabilidadNivel) ||
    TABLA_PROBABILIDAD_OSCE[1];
  const impItem =
    TABLA_IMPACTO_OSCE.find((i) => i.nivel === impactoNivel) ||
    TABLA_IMPACTO_OSCE[1];

  const resultado = Math.round(probItem.valor * impItem.valor * 1000) / 1000;

  let prioridad: PrioridadRiesgoOSCE = 'BAJA';
  let color: 'rojo' | 'ambar' | 'verde' = 'verde';

  if (resultado >= 0.180) {
    prioridad = 'ALTA';
    color = 'rojo';
  } else if (resultado >= 0.070) {
    prioridad = 'MODERADA';
    color = 'ambar';
  }

  return {
    probabilidadNivel: probItem.nivel,
    probabilidadValor: probItem.valor,
    impactoNivel: impItem.nivel,
    impactoValor: impItem.valor,
    resultado,
    prioridad,
    color,
  };
}

/**
 * Fórmula estándar de identificación del riesgo:
 * "Debido a ...(causa)... podría ocurrir ...(evento)... lo que impactaría en ...(consecuencia)"
 */
export function formularIdentificacionRiesgo(
  causa: string,
  evento: string,
  consecuencia: string,
): string {
  const c = (causa || '').trim();
  const e = (evento || '').trim();
  const cons = (consecuencia || '').trim();

  if (!c && !e && !cons) return '';

  let parteEvento = e;
  if (parteEvento && !parteEvento.toLowerCase().startsWith('que ')) {
    parteEvento = `que ${parteEvento}`;
  }

  const partes: string[] = [];
  if (c) partes.push(`Debido a ${c}`);
  if (e) partes.push(`podría ocurrir ${parteEvento}`);
  if (cons) partes.push(`lo que impactaría en ${cons}`);

  return partes.join(' ') + (partes.length > 0 ? '.' : '');
}

export function calcularNivelRiesgo(probabilidad: number, impacto: number): number {
  if (probabilidad <= 1 && impacto <= 1) {
    return Math.round(probabilidad * impacto * 1000) / 1000;
  }
  return probabilidad * impacto;
}

export function obtenerSemaforoRiesgo(nivel: number): SemaforoResult {
  // Escala OSCE decimal (<= 1.0)
  if (nivel <= 1.0) {
    if (nivel >= 0.180) {
      return { color: 'rojo', texto: 'ALTA' };
    }
    if (nivel >= 0.070) {
      return { color: 'ambar', texto: 'MODERADA' };
    }
    return { color: 'verde', texto: 'BAJA' };
  }

  // Escala estándar entera 1-25
  if (nivel < 8) {
    return { color: 'verde', texto: 'Baja' };
  }
  if (nivel <= 14) {
    return { color: 'ambar', texto: 'Moderada' };
  }
  return { color: 'rojo', texto: 'Alta' };
}

// ---------------------------------------------------------------------------
// IDA (Indice de Desempeno de Avance)
// ---------------------------------------------------------------------------

export function calcularIDA(real: number, programado: number): number {
  if (programado === 0) {
    return 0;
  }
  return Math.round((real / programado) * 100) / 100;
}

export function obtenerSemaforoIDA(ida: number): SemaforoIDAResult {
  if (ida >= 0.95) {
    return { color: 'verde', texto: 'Óptimo' };
  }
  if (ida >= 0.80) {
    return { color: 'ambar', texto: 'En alerta' };
  }
  return { color: 'critico', texto: 'Crítico' };
}

// ---------------------------------------------------------------------------
// Descalce financiero / fisico
// ---------------------------------------------------------------------------

export function calcularDescalce(financiero: number, fisico: number): number {
  return Math.round(Math.abs(financiero - fisico) * 10) / 10;
}

export function tieneDescalce(financiero: number, fisico: number): boolean {
  return calcularDescalce(financiero, fisico) > 15;
}

// ---------------------------------------------------------------------------
// Estado de plazo de acciones de mitigacion
// ---------------------------------------------------------------------------

export function obtenerEstadoPlazo(fechaMeta: Date, avance: number): EstadoPlazoResult {
  if (avance === 100) {
    return { estado: 'mitigado', texto: 'Mitigado', diasRestantes: null };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const meta = new Date(fechaMeta);
  meta.setHours(0, 0, 0, 0);

  const diffMs = meta.getTime() - hoy.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) {
    return { estado: 'vencido', texto: 'Vencido', diasRestantes };
  }

  if (diasRestantes <= 15) {
    return { estado: 'por_vencer', texto: 'Por vencer', diasRestantes };
  }

  return { estado: 'controlado', texto: 'Controlado', diasRestantes };
}

// ---------------------------------------------------------------------------
// Formateadores
// ---------------------------------------------------------------------------

const monedaFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatearMoneda(monto: number): string {
  return monedaFormatter.format(monto);
}

export function formatearFecha(date: Date): string {
  const d = new Date(date);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

export function formatearPorcentaje(valor: number): string {
  return `${valor.toFixed(1)}%`;
}

export function formatearIDA(valor: number): string {
  return valor.toFixed(2);
}

export function formatearDecimalOSCE(valor: number): string {
  return valor.toFixed(3);
}

// ---------------------------------------------------------------------------
// Generación y Cálculo de Curva S Oficial (Programado vs. Real vs. Financiero)
// ---------------------------------------------------------------------------

export function generarCurvaS(p: Proyecto): PuntoCurvaS[] {
  if (p.curvaS && p.curvaS.length > 0) {
    return p.curvaS;
  }

  const periodos = [
    'Ene 26',
    'Feb 26',
    'Mar 26',
    'Abr 26',
    'May 26',
    'Jun 26',
    'Jul 26',
    'Ago 26',
    'Set 26',
    'Oct 26',
    'Nov 26',
    'Dic 26',
  ];

  const mesCorte = 10; // Octubre 2026 (mes de control oficial)
  const progCorte = p.avanceFisicoProgramado || 55.0;
  const realCorte = p.avanceFisicoReal || 50.0;
  const finCorte = p.avanceFinanciero || 60.0;

  // Curva sigmoide base de pesos acumulados estándar de obra civil
  const pesosSigmoide = [
    0.03, 0.08, 0.15, 0.25, 0.38, 0.52, 0.68, 0.81, 0.91, 1.0,
  ];

  const puntos: PuntoCurvaS[] = [];
  let progAcumPrev = 0;
  let realAcumPrev = 0;
  let finAcumPrev = 0;

  for (let i = 0; i < periodos.length; i++) {
    const mesNum = i + 1;
    const esPasadoOActual = mesNum <= mesCorte;
    let progAcum = 0;
    let realAcum: number | null = null;
    let finAcum: number | null = null;

    if (mesNum <= mesCorte) {
      const ratio = pesosSigmoide[i];
      progAcum = Math.round(progCorte * ratio * 10) / 10;
      realAcum = Math.round(realCorte * ratio * 10) / 10;
      finAcum = Math.round(finCorte * ratio * 10) / 10;

      // En el mes de corte exacto fijar el valor exacto del proyecto
      if (mesNum === mesCorte) {
        progAcum = progCorte;
        realAcum = realCorte;
        finAcum = finCorte;
      }
    } else {
      // Meses futuros: proyección programada hacia 100%
      const deltaFuturo = (100 - progCorte) / (periodos.length - mesCorte);
      progAcum =
        Math.round((progCorte + deltaFuturo * (mesNum - mesCorte)) * 10) / 10;
      if (mesNum === periodos.length) progAcum = 100.0;
      realAcum = null;
      finAcum = null;
    }

    const progMensual = Math.round((progAcum - progAcumPrev) * 10) / 10;
    const realMensual =
      realAcum !== null
        ? Math.round((realAcum - realAcumPrev) * 10) / 10
        : null;
    const finMensual =
      finAcum !== null ? Math.round((finAcum - finAcumPrev) * 10) / 10 : null;

    progAcumPrev = progAcum;
    if (realAcum !== null) realAcumPrev = realAcum;
    if (finAcum !== null) finAcumPrev = finAcum;

    const brecha =
      realAcum !== null
        ? Math.round((realAcum - progAcum) * 10) / 10
        : null;

    puntos.push({
      mesNumero: mesNum,
      periodo: periodos[i],
      programadoMensual: progMensual,
      programadoAcumulado: progAcum,
      ejecutadoMensual: realMensual,
      ejecutadoAcumulado: realAcum,
      financieroMensual: finMensual,
      financieroAcumulado: finAcum,
      brecha,
      esMesCorte: mesNum === mesCorte,
    });
  }

  return puntos;
}
