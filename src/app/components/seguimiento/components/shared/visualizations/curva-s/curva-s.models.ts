export type CurvaSGranularity = 'm' | 's';

export type CurvaSPreset = 'anio' | 'tri' | 'mes' | '4s' | '';

export type CurvaSSeriesKey = 'prog' | 'fis' | 'fin';

export interface CurvaSWeeklyPoint {
  f: string;
  prog: number;
  fis: number;
  fin: number;
  recordedBy?: string;
  detail?: string;
}

export interface CurvaSDisplayPoint extends CurvaSWeeklyPoint {
  lab: string;
  tt: string;
  m?: number;
  xCoord: number;
  yProg: number;
  yFis: number;
  yFin: number;
  weeklyDeltaFis: number;
  deviationFis: number;
}

export interface CurvaSSeriesDef {
  key: CurvaSSeriesKey;
  label: string;
  cssColorVar: string;
  dashed?: boolean;
}

export const CURVA_S_SERIES: readonly CurvaSSeriesDef[] = [
  {
    key: 'prog',
    label: 'Programado (%)',
    cssColorVar: 'var(--color-ink-muted)',
    dashed: true,
  },
  {
    key: 'fis',
    label: 'Físico real (%)',
    cssColorVar: 'var(--color-azul-institucional)',
  },
  {
    key: 'fin',
    label: 'Financiero (%)',
    cssColorVar: 'var(--color-verde-eficiencia)',
  },
] as const;

export const MESES_CORTOS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Oct',
  'Nov',
  'Dic',
] as const;

export const MESES_LARGOS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;
