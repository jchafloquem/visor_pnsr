import { CORTE_FECHA } from '../../../core/config/institutional.constants';
import {
  ParametrosSsp,
  ProyectoSsp,
  RiesgoSsp,
  SeguimientoSemanal,
} from '../models/ssp.models';
import { isActiveRisk, lvlOfRisk, scoreRisk } from '../../riesgos/domain/risk.rules';

export interface ProyeccionProyecto {
  devFin: number;
  devPct: number;
  fisFin: number | null;
  fecha: string | null;
  llega: boolean | null;
  ritNec: number | null;
}

export interface IaLecturaProyecto {
  t: string;
  acc: string[];
}

export function diffDays(dateA: string, dateB: string = CORTE_FECHA): number {
  if (!dateA || !dateB) return 0;
  const msA = new Date(dateA + 'T00:00:00').getTime();
  const msB = new Date(dateB + 'T00:00:00').getTime();
  return Math.round((msA - msB) / 86400000);
}

export function formatDateShort(iso: string | undefined | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatSoles(amount: number): string {
  return 'S/ ' + Math.round(amount).toLocaleString('es-PE');
}

export function formatMillions(amount: number): string {
  return 'S/ ' + (amount / 1e6).toFixed(2) + ' M';
}

export function normalizeSearchText(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function isSegOk(
  p: Pick<ProyectoSsp, 'cui'>,
  seguimientos: Record<string, SeguimientoSemanal>,
  corte: string = CORTE_FECHA
): boolean {
  const s = seguimientos[p.cui];
  return !!s && diffDays(corte, s.f) <= 7;
}

export function isAtrasado(p: Pick<ProyectoSsp, 'fis' | 'prog'>): boolean {
  return p.fis != null && p.prog != null && p.prog - p.fis > 10;
}

export function computeProyeccion(
  p: Pick<ProyectoSsp, 'pim' | 'dev' | 'devMes' | 'fis' | 'ritmo'>,
  corte: string = CORTE_FECHA
): ProyeccionProyecto {
  const fin = '2026-12-31';
  const sem = diffDays(fin, corte) / 7;
  const mes = diffDays(fin, corte) / 30.4;
  const devFin = Math.min(p.pim, p.dev + p.devMes * mes);
  const devPct = p.pim ? (devFin / p.pim) * 100 : 0;

  let fisFin: number | null = null;
  let fecha: string | null = null;
  let llega: boolean | null = null;
  let ritNec: number | null = null;

  if (p.fis != null && p.ritmo != null) {
    fisFin = Math.min(100, p.fis + p.ritmo * sem);
    if (p.ritmo > 0) {
      const d = new Date(corte + 'T12:00:00');
      d.setDate(d.getDate() + Math.ceil(((100 - p.fis) / p.ritmo) * 7));
      fecha = d.toISOString().slice(0, 10);
    }
    llega = fisFin >= 99.5;
    ritNec = sem > 0 ? (100 - p.fis) / sem : 0;
  }

  return { devFin, devPct, fisFin, fecha, llega, ritNec };
}

export function buildIaTexto(
  p: ProyectoSsp,
  proyeccion: ProyeccionProyecto,
  projectRisks: readonly RiesgoSsp[],
  params: ParametrosSsp,
  corte: string = CORTE_FECHA
): IaLecturaProyecto {
  const rs = projectRisks
    .filter((r) => isActiveRisk(r))
    .slice()
    .sort((a, b) => scoreRisk(b, params) - scoreRisk(a, params));
  const venc = p.hitos.filter(
    (h) => h.est !== 'Cumplido' && !h.real && diffDays(h.f, corte) < 0
  );

  const t: string[] = [];
  if (proyeccion.fisFin != null) {
    if (proyeccion.llega) {
      t.push(
        `Al ritmo actual (${p.ritmo} % por semana) la obra llegaría al 100 % el ${formatDateShort(proyeccion.fecha)}, dentro del año.`
      );
    } else if (p.ritmo && p.ritmo > 0) {
      t.push(
        `Al ritmo actual (${p.ritmo} % por semana) la obra cerraría el año en ${proyeccion.fisFin.toFixed(0)} % y terminaría recién el ${formatDateShort(proyeccion.fecha)}. Para culminar en 2026 necesita ${(proyeccion.ritNec ?? 0).toFixed(1)} % por semana.`
      );
    } else {
      t.push(
        'La obra no avanza (0 % en las últimas semanas); sin reinicio no culminará en 2026.'
      );
    }
  }

  t.push(
    `El devengado proyectado al 31/12 es ${proyeccion.devPct.toFixed(0)} % del PIM${proyeccion.devPct < 80 ? ', con riesgo de dejar saldo sin ejecutar.' : '.'}`
  );

  if (venc.length) {
    t.push(`Tiene ${venc.length} hito(s) vencido(s): ${venc.map((h) => h.h).join('; ')}.`);
  }

  if (rs.length) {
    t.push(
      `El riesgo principal es que podría ocurrir ${rs[0].evento} (${lvlOfRisk(rs[0], params).toLowerCase()}).`
    );
  }

  const acc: string[] = [];
  if (proyeccion.fisFin != null && !proyeccion.llega) {
    acc.push(
      p.ritmo && p.ritmo > 0
        ? 'Acordar con el ejecutor un plan de aceleración (más frentes de trabajo) y revisarlo cada semana.'
        : 'Priorizar las acciones para reiniciar la obra y reprogramar la meta física.'
    );
  }
  if (proyeccion.devPct < 80) {
    acc.push('Evaluar con UPP una modificación presupuestal para no perder el saldo.');
  }
  rs.filter((r) => !r.acc.length).forEach((r) => {
    acc.push(`Definir plan de acción para ${r.id}.`);
  });
  venc.slice(0, 2).forEach((h) => {
    acc.push(`Regularizar el hito vencido «${h.h}».`);
  });

  return { t: t.join(' '), acc: acc.slice(0, 4) };
}
