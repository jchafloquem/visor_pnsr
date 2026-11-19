import { CurvaSWeeklyPoint } from '../../shared/visualizations/curva-s/curva-s.models';
import { SparklinePoint } from '../../shared/visualizations/sparkline/sparkline.component';

export type UnidadOperativa = 'UTP' | 'PIASAR' | 'AMAZONÍA RURAL';

export type EtapaProyecto =
  | 'Ficha técnica'
  | 'Expediente técnico'
  | 'Ejecución de obra'
  | 'Destrabe'
  | 'Cierre';

export type ModalidadProyecto = 'Contrata' | 'Núcleo ejecutor';

export type EstadoProyecto =
  | 'En ejecución'
  | 'En elaboración'
  | 'Suspendida'
  | 'Paralizada';

export type Culmina2026 = 'Sí' | 'Duda' | 'No';

export type TipoHito = 'T' | 'P';
export type EstadoHito = 'Pendiente' | 'Cumplido';

export interface HitoSsp {
  id: string;
  t: TipoHito;
  h: string;
  f: string;
  est: EstadoHito;
  real: string;
}

export interface ContratoSsp {
  ejecutor: string;
  supervisor: string;
  monto: number;
  inicio: string;
  fin: string;
  adic: number;
  garantia: string;
}

export interface PresupuestoSsp {
  pia: number;
  pim: number;
  cert: number;
  comp: number;
  dev: number;
}

export type PriorizadoTipo = 'Compromiso' | 'Contingencia';

export interface PriorizadoInfo {
  tipo: PriorizadoTipo;
  meta: string;
  fm: string;
  sust: string;
  desde: string;
  u: string;
}

export interface PriorizadoHistItem {
  f: string;
  cui: string;
  acc: 'Inclusión' | 'Retiro' | 'Cambio de tipo' | 'Cambio de meta';
  de: string;
  a: string;
  mot: string;
  u: string;
}

export interface ProyectoSsp {
  cui: string;
  syn?: boolean;
  zona?: 'Sierra' | 'Selva';
  fin2027?: boolean;
  ritmo: number | null;
  devMes: number;
  corto: string;
  nombre: string;
  uo: UnidadOperativa;
  etapa: EtapaProyecto;
  mod: ModalidadProyecto;
  dep: string;
  prov: string;
  dist: string;
  lat: number;
  lng: number;
  pim: number;
  dev: number;
  fis: number | null;
  prog: number | null;
  culm: Culmina2026;
  estado: EstadoProyecto;
  benef: number;
  hitos: HitoSsp[];
  asig: string;
  emp?: [string, string];
  contrato: ContratoSsp;
  pres: PresupuestoSsp;
  finObra: string;
  prev: number;
  deficit: number;
  inv: number;
  conex: number;
  finPct?: number;
  cv: CurvaSWeeklyPoint[] | null;
  hist: Array<SparklinePoint & { f: string }>;
  pri: PriorizadoTipo | '';
  priX: PriorizadoInfo | null;
}

export type ProbabilidadLabel = 'Muy Alta' | 'Alta' | 'Moderada' | 'Baja' | 'Muy Baja';
export type ImpactoLabel = 'Muy Bajo' | 'Bajo' | 'Moderado' | 'Alto' | 'Muy Alto';
export type NivelRiesgoBase = 'ALTA' | 'MODERADA' | 'BAJA';
export type NivelRiesgo = 'CRÍTICO' | NivelRiesgoBase;

export type EstadoRiesgo =
  | 'Identificado'
  | 'En tratamiento'
  | 'Materializado'
  | 'Cerrado'
  | 'Propuesto'
  | 'Rechazado';

export type EstrategiaRiesgo = 'Mitigar' | 'Evitar' | 'Transferir' | 'Aceptar' | '';

export type EstadoValidacionRiesgo = 'Validado' | 'Por validar' | 'Observado' | '';

export type EstadoAccionRiesgo = 'Pendiente' | 'En curso' | 'Atendida';

export interface AccionRiesgoSsp {
  t: string;
  r: string;
  f: string;
  av: number;
  est: EstadoAccionRiesgo;
  ev: string;
}

export interface HistorialRiesgoSsp {
  f: string;
  p: ProbabilidadLabel;
  i: ImpactoLabel;
  n: string;
  u: string;
}

export interface RechazoRiesgoSsp {
  u: string;
  f: string;
  mot: string;
}

export interface RiesgoSsp {
  id: string;
  cui: string;
  hito: string;
  comp: string;
  cats: string[];
  origen: string;
  mitigable: boolean;
  causa: string;
  evento: string;
  consec: string;
  p: ProbabilidadLabel;
  i: ImpactoLabel;
  estado: EstadoRiesgo;
  estrategia: EstrategiaRiesgo;
  resp: string;
  flim: string;
  acc: AccionRiesgoSsp[];
  hist: HistorialRiesgoSsp[];
  creado: string;
  por: string;
  act: string;
  actF: string;
  val: EstadoValidacionRiesgo;
  valBy: string;
  valF: string;
  obs: string;
  rech?: RechazoRiesgoSsp;
}

export interface SugerenciaRiesgoSsp {
  k?: number;
  e: EtapaProyecto[];
  z: Array<'Sierra' | 'Selva'>;
  cats: string[];
  causa: string;
  evento: string;
  consec: string;
  p: ProbabilidadLabel;
  i: ImpactoLabel;
}

export type EstadoCompromiso = 'Pendiente' | 'En curso' | 'Cumplido';

export interface CompromisoSsp {
  id: string;
  cui: string;
  prob: string;
  dec: string;
  resp: string;
  f: string;
  est: EstadoCompromiso;
  ev: string;
  por: string;
  fr: string;
}

export interface SeguimientoSemanal {
  f: string;
  u: string;
  fis?: number | null;
  det: string;
  ev?: string;
}

export interface AnticipacionDias {
  hito: number;
  accion: number;
}

export interface ParametrosSsp {
  P: Record<ProbabilidadLabel, number>;
  I: Record<ImpactoLabel, number>;
  cBaja: number;
  cAlta: number;
  dias: Record<UnidadOperativa, AnticipacionDias>;
  exc: Record<string, AnticipacionDias>;
  cats: string[];
}

export type SeveridadAlerta = 'Crítica' | 'Alta' | 'Media';

export interface AlertaSsp {
  sev: SeveridadAlerta;
  k: string;
  rn: string;
  p: ProyectoSsp;
  txt: string;
  f: string;
  sit: string;
  rk: RiesgoSsp | null;
  hid?: string;
}

export type ExportKindCode = 'AME' | 'AMR' | 'CAR' | 'MRZ' | 'MIR';

export interface ExportTraceItem {
  cod: string;
  kind: ExportKindCode;
  label: string;
  fmt: string;
  u: string;
  fecha: string;
  hora: string;
  corte: string;
}
