export interface Proyecto {
  cui: string;
  nombre: string;
  departamento: string;
  provincia: string;
  distrito: string;
  localidad: string;
  cartera: 'UTP' | 'PIASAR' | 'Amazonia Rural';
  priorizado2026: boolean;
  responsablePnsr: string;
  contratista: string;
  coordenadaX: number | null;
  coordenadaY: number | null;
  costoInversion: number;
  devengadoAcumulado: number;
  estadoAdministrativo: string;
  avanceFisicoReal: number;
  avanceFisicoProgramado: number;
  avanceFinanciero: number;
  riesgos: Riesgo[];
  hitos: Hito[];
  fuenteSSI: boolean;
  fuenteSSP: boolean;

  // Campos ejecutivos opcionales para la Ayuda de Memoria institucional
  programa?: string;
  unidadEjecutora?: string;
  unidadFormuladora?: string;
  monitoreadoPor?: string;
  modalidadEjecucion?: string;
  poblacionBeneficiaria?: string;
  conexionesNuevas?: string;
  pimVigente?: number;
  devengadoAnioActual?: number;
  saldoInversion?: number;
  fechaTerminoEstimada?: string;
  fechaCorteActualizacion?: string;
  antecedentesRelevantes?: string[];
  problematicaRestriccion?: string[];
  estadoSituacionalDetalle?: string[];
  proximosPasos?: string[];

  // Curva S de avance físico y financiero
  curvaS?: PuntoCurvaS[];

  // Campos del Tablero de Control Ejecutivo, Ciclo de Inversión y Matriz 5x5
  year?: string;
  modalidad?: string;
  etapa?: string;
  estado?: string;
  lat?: number;
  lng?: number;
  pim?: number;
  devengado?: number;
  avanceProg?: number;
  beneficiarios?: number;
  ubs?: number;
  jass?: string;
  riesgoNivel?: 'Crítico' | 'Alto' | 'Medio' | 'Bajo' | string;
  prob?: number;
  imp?: number;
  riesgoCategoria?: string;
  riesgoFactor?: string;
  riesgoDetalle?: string;
  mitigacion?: string;
  responsable?: string;
  hito?: string;
  fechaHito?: string;
}

export interface PuntoCurvaS {
  mesNumero: number;
  periodo: string;
  programadoMensual: number;
  programadoAcumulado: number;
  ejecutadoMensual: number | null;
  ejecutadoAcumulado: number | null;
  financieroMensual: number | null;
  financieroAcumulado: number | null;
  brecha: number | null; // ejecutadoAcumulado - programadoAcumulado
  esMesCorte?: boolean;
}

export interface Hito {
  id: string;
  descripcion: string;
  fechaInicioProgramada: Date;
  fechaFinProgramada: Date;
  fechaReal: Date | null;
  avanceEsperado: number;
  estado: 'Pendiente' | 'En Proceso' | 'Cumplido' | 'Retrasado';
  responsable: string;
}

export type TipoRiesgo =
  | 'Tecnico'
  | 'Presupuestal'
  | 'Contractual'
  | 'Social'
  | 'Ambiental'
  | 'Climatico'
  | 'Institucional';

export type CategoriaRiesgoOSCE =
  | 'Diseño'
  | 'Climatológicos'
  | 'Sociales'
  | 'Legales y contractuales'
  | 'Constructivos'
  | 'Logísticos'
  | 'Arqueológicos'
  | 'Permisos y licencias'
  | 'Financieros'
  | 'Gestión y organización'
  | 'Interferencias'
  | 'Múltiple'
  | 'Sin riesgo';

export type ProbabilidadNivelOSCE =
  | 'Muy Alta'
  | 'Alta'
  | 'Moderada'
  | 'Baja'
  | 'Muy Baja';

export type ImpactoNivelOSCE =
  | 'Muy Alto'
  | 'Alto'
  | 'Moderado'
  | 'Bajo'
  | 'Muy Bajo';

export type PrioridadRiesgoOSCE = 'ALTA' | 'MODERADA' | 'BAJA';

export type EstrategiaRespuestaRiesgo =
  | 'MITIGAR'
  | 'EVITAR'
  | 'TRANSFERIR'
  | 'ACEPTAR';

export type NivelRiesgo = 'bajo' | 'medio' | 'alto';

export interface AccionMitigacion {
  id: string;
  descripcion: string;
  responsable: string;
  fechaInicio: Date;
  fechaMeta: Date;
  avance: number;
  medioProbatorio: string;
}

export interface Riesgo {
  id: string;
  categoria: CategoriaRiesgoOSCE | string;
  tipo?: TipoRiesgo; // retrocompatibilidad

  // Formulación de identificación del riesgo
  causa: string;
  evento: string;
  consecuencia: string;
  identificacionCompleta?: string;

  // Campos retrocompatibles
  causaRaiz?: string;
  efecto?: string;

  // Evaluación cuantitativa OSCE
  probabilidadNivel: ProbabilidadNivelOSCE;
  probabilidadValor: number; // 0.90, 0.70, 0.50, 0.30, 0.10
  impactoNivel: ImpactoNivelOSCE;
  impactoValor: number; // 0.80, 0.40, 0.20, 0.10, 0.05
  puntuacion: number; // probabilidadValor * impactoValor (ej: 0.280)
  prioridad: PrioridadRiesgoOSCE; // ALTA, MODERADA, BAJA
  estrategiaRespuesta?: EstrategiaRespuestaRiesgo;

  // Campos retrocompatibles para cálculo anterior
  probabilidad: number;
  impacto: number;

  // Estado de atención del riesgo
  estado?: 'ACTIVO' | 'ATENDIDO';
  atencionDescripcion?: string;
  atencionEvidencia?: string;
  fechaAtencion?: Date;

  acciones: AccionMitigacion[];
}
