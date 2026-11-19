import { CORTE_FECHA } from '../core/config/institutional.constants';
import {
  Culmina2026,
  EstadoHito,
  EstadoProyecto,
  EtapaProyecto,
  HitoSsp,
  ModalidadProyecto,
  PriorizadoHistItem,
  PriorizadoInfo,
  PriorizadoTipo,
  ProyectoSsp,
  SeguimientoSemanal,
  TipoHito,
  UnidadOperativa,
} from '../components/cartera/models/ssp.models';

export const UNIDADES_OPERATIVAS: readonly UnidadOperativa[] = [
  'UTP',
  'PIASAR',
  'AMAZONÍA RURAL',
];

export const ETAPAS_PROYECTO: readonly EtapaProyecto[] = [
  'Ficha técnica',
  'Expediente técnico',
  'Ejecución de obra',
  'Destrabe',
  'Cierre',
];

function makeHito(
  id: string,
  t: TipoHito,
  h: string,
  f: string,
  est: EstadoHito = 'Pendiente',
  real: string = ''
): HitoSsp {
  return { id, t, h, f, est, real };
}

export const WEEKS_2026: readonly string[] = (() => {
  const a: string[] = [];
  const d = new Date('2026-01-06T12:00:00');
  const c = new Date(CORTE_FECHA + 'T12:00:00');
  while (d <= c) {
    a.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 7);
  }
  return a;
})();

const EMP_BY_CUI: Record<string, [string, string]> = {
  '9100101': ['Consorcio Huaylla', 'Supervisión Andina SAC'],
  '9100102': ['Núcleo Ejecutor Santa Rosa de Pampa', 'Inspector PNSR'],
  '9100103': ['Consorcio Ccollpa', '(por contratar)'],
  '9100104': ['Consultor de estudios (ET)', 'Revisor PNSR'],
  '9100105': ['Núcleo Ejecutor Chontabamba Baja', 'Inspector PNSR'],
  '9100106': ['(saldo de obra por convocar)', '—'],
  '9100107': ['Núcleo Ejecutor La Palma', 'Inspector PNSR'],
  '9100108': ['Consultor de ficha técnica', 'Revisor PNSR'],
  '9100109': ['Consorcio Tambillo', 'Supervisión Norte SAC'],
  '9100110': ['Consultor de estudios (ET)', 'Revisor PIASAR'],
  '9100111': ['Consorcio Nazareth', 'Supervisión Amazónica SAC'],
  '9100112': ['Consorcio Napo', 'Supervisión Loreto SAC'],
  '9100113': ['Núcleo Ejecutor Puerto Esperanza', 'Inspector Amazonía Rural'],
};

const DEFICIT_BY_CUI: Record<string, number> = {
  '9100101': 380000,
  '9100103': 1200000,
  '9100106': 950000,
  '9100112': 640000,
  '9100113': 150000,
};

export function genProjectCurve(p: ProyectoSsp): void {
  p.cv = null;
  p.hist = [];
  if (p.fis == null || p.prog == null) return;
  const el = Math.max(10, Math.min(80, Math.round(p.prog / 1.9)));
  const c = new Date(CORTE_FECHA + 'T12:00:00').getTime();
  const st = c - el * 7 * 864e5;
  const stop =
    p.estado === 'Paralizada' || p.estado === 'Suspendida'
      ? 1 - Math.min(0.5, (p.estado === 'Paralizada' ? 14 : 6) / el)
      : 1;
  const Sx = (x: number): number =>
    x <= 0
      ? 0
      : x >= 1
        ? 1
        : 0.55 * Math.pow(x, 1.7) + 0.45 * (3 * x * x - 2 * x * x * x);
  const finPct = Math.min(100, ((p.dev + p.prev) / p.inv) * 100);
  p.finPct = finPct;
  const progVal = p.prog;
  const fisVal = p.fis;
  p.cv = WEEKS_2026.map((f) => {
    const x = (new Date(f + 'T12:00:00').getTime() - st) / (c - st);
    const xs = Math.min(x, stop);
    const q = Sx(stop) ? Sx(xs) / Sx(stop) : 0;
    return {
      f,
      prog: +(progVal * Sx(x)).toFixed(1),
      fis: +Math.min(fisVal, fisVal * Math.pow(q, 1.1)).toFixed(1),
      fin: +(finPct * Math.pow(q, 1.25)).toFixed(1),
    };
  });
  p.hist = p.cv.slice(-11).map((x) => ({ f: x.f, fis: x.fis, prog: x.prog }));
}

export interface GeneratedSeedPortfolio {
  projects: ProyectoSsp[];
  seg0: Record<string, SeguimientoSemanal>;
  rev0: Record<string, string>;
  pri0: Record<string, PriorizadoInfo>;
  prih0: PriorizadoHistItem[];
}

export function buildSeedPortfolio(): GeneratedSeedPortfolio {
  const base13: Array<
    Omit<
      ProyectoSsp,
      | 'asig'
      | 'contrato'
      | 'pres'
      | 'finObra'
      | 'prev'
      | 'deficit'
      | 'inv'
      | 'conex'
      | 'cv'
      | 'hist'
      | 'pri'
      | 'priX'
    >
  > = [
    {
      cui: '9100101',
      ritmo: 2.1,
      devMes: 210000,
      corto: 'Huaylla Alta',
      nombre:
        'Mejoramiento del servicio de agua potable y saneamiento rural en la localidad de Huaylla Alta',
      uo: 'UTP',
      etapa: 'Ejecución de obra',
      mod: 'Contrata',
      dep: 'Áncash',
      prov: 'Huari',
      dist: 'San Marcos',
      lat: -9.52,
      lng: -77.16,
      pim: 2450000,
      dev: 1520000,
      fis: 68,
      prog: 82,
      culm: 'Duda',
      estado: 'En ejecución',
      benef: 1240,
      hitos: [
        makeHito('h1', 'T', 'Aprobación del adicional de obra N.º 1', '2026-11-05'),
        makeHito('h2', 'P', 'Pago de valorización N.º 9 (octubre)', '2026-11-10', 'Pendiente'),
        makeHito('h3', 'T', 'Presentación de valorización N.º 10 (noviembre)', '2026-12-05'),
        makeHito('h4', 'T', 'Culminación de obra', '2026-12-20'),
      ],
    },
    {
      cui: '9100102',
      ritmo: 1.2,
      devMes: 95000,
      corto: 'Santa Rosa de Pampa',
      nombre:
        'Instalación del sistema de agua potable y UBS en la comunidad de Santa Rosa de Pampa',
      uo: 'UTP',
      etapa: 'Ejecución de obra',
      mod: 'Núcleo ejecutor',
      dep: 'Puno',
      prov: 'Azángaro',
      dist: 'Asillo',
      lat: -14.79,
      lng: -70.35,
      pim: 1180000,
      dev: 1050000,
      fis: 93,
      prog: 95,
      culm: 'Sí',
      estado: 'En ejecución',
      benef: 860,
      hitos: [
        makeHito('h1', 'T', 'Pruebas hidráulicas de redes', '2026-11-12', 'Cumplido', '2026-11-12'),
        makeHito('h2', 'P', 'Pago del último desembolso al NE', '2026-11-25'),
        makeHito('h3', 'T', 'Recepción de obra', '2026-12-10'),
      ],
    },
    {
      cui: '9100103',
      ritmo: 0.0,
      devMes: 15000,
      corto: 'Ccollpa',
      nombre:
        'Ampliación del servicio de agua potable y saneamiento en la comunidad campesina de Ccollpa',
      uo: 'UTP',
      etapa: 'Ejecución de obra',
      mod: 'Contrata',
      dep: 'Cusco',
      prov: 'Chumbivilcas',
      dist: 'Santo Tomás',
      lat: -14.45,
      lng: -72.08,
      pim: 3200000,
      dev: 410000,
      fis: 22,
      prog: 55,
      culm: 'No',
      estado: 'Suspendida',
      benef: 2100,
      hitos: [
        makeHito('h1', 'T', 'Contratación de nuevo supervisor', '2026-10-30'),
        makeHito('h2', 'T', 'Levantamiento de la suspensión (reinicio)', '2026-11-15'),
        makeHito('h3', 'P', 'Pago de valorización N.º 4 (noviembre)', '2026-12-15'),
        makeHito('h4', 'T', 'Culminación de obra', '2027-03-30'),
      ],
    },
    {
      cui: '9100104',
      ritmo: null,
      devMes: 20000,
      corto: 'Nuevo Progreso',
      nombre:
        'Creación del servicio de agua potable y saneamiento en la comunidad nativa Nuevo Progreso',
      uo: 'UTP',
      etapa: 'Expediente técnico',
      mod: 'Contrata',
      dep: 'Loreto',
      prov: 'Maynas',
      dist: 'Indiana',
      lat: -3.5,
      lng: -73.05,
      pim: 180000,
      dev: 60000,
      fis: null,
      prog: null,
      culm: 'Duda',
      estado: 'En elaboración',
      benef: 540,
      hitos: [
        makeHito(
          'h1',
          'T',
          'Entrega del 3.er entregable del ET',
          '2026-11-08',
          'Cumplido',
          '2026-11-09'
        ),
        makeHito('h2', 'T', 'Revisión y checklist del ET', '2026-11-20'),
        makeHito('h3', 'T', 'Aprobación del expediente técnico', '2026-12-12'),
      ],
    },
    {
      cui: '9100105',
      ritmo: 1.5,
      devMes: 60000,
      corto: 'Chontabamba Baja',
      nombre: 'Mejoramiento del sistema de agua potable en el centro poblado Chontabamba Baja',
      uo: 'UTP',
      etapa: 'Ejecución de obra',
      mod: 'Núcleo ejecutor',
      dep: 'Junín',
      prov: 'Satipo',
      dist: 'Pangoa',
      lat: -11.43,
      lng: -74.49,
      pim: 950000,
      dev: 880000,
      fis: 96,
      prog: 97,
      culm: 'Sí',
      estado: 'En ejecución',
      benef: 720,
      hitos: [
        makeHito('h1', 'T', 'Culminación de obra', '2026-11-28'),
        makeHito('h2', 'T', 'Preliquidación del NE', '2026-12-15'),
      ],
    },
    {
      cui: '9100106',
      ritmo: 0.0,
      devMes: 0,
      corto: 'San Juan de Ocros',
      nombre: 'Mejoramiento del servicio de agua potable y saneamiento en San Juan de Ocros',
      uo: 'UTP',
      etapa: 'Destrabe',
      mod: 'Contrata',
      dep: 'Ayacucho',
      prov: 'Huamanga',
      dist: 'Ocros',
      lat: -13.39,
      lng: -73.92,
      pim: 1600000,
      dev: 120000,
      fis: 41,
      prog: 41,
      culm: 'No',
      estado: 'Paralizada',
      benef: 980,
      hitos: [
        makeHito(
          'h1',
          'T',
          'Informe de estado situacional',
          '2026-10-25',
          'Cumplido',
          '2026-10-27'
        ),
        makeHito(
          'h2',
          'T',
          'Elaboración de términos de referencia del saldo de obra',
          '2026-11-14'
        ),
        makeHito('h3', 'T', 'Convocatoria del saldo de obra', '2026-12-18'),
      ],
    },
    {
      cui: '9100107',
      ritmo: 2.4,
      devMes: 120000,
      corto: 'La Palma',
      nombre: 'Ampliación del sistema de agua potable y alcantarillado en el caserío La Palma',
      uo: 'UTP',
      etapa: 'Ejecución de obra',
      mod: 'Núcleo ejecutor',
      dep: 'Cajamarca',
      prov: 'Jaén',
      dist: 'Bellavista',
      lat: -5.66,
      lng: -78.68,
      pim: 1050000,
      dev: 700000,
      fis: 74,
      prog: 80,
      culm: 'Sí',
      estado: 'En ejecución',
      benef: 650,
      hitos: [
        makeHito('h1', 'P', '2.º desembolso al NE', '2026-11-19'),
        makeHito('h2', 'T', 'Culminación de obra', '2026-12-22'),
      ],
    },
    {
      cui: '9100108',
      ritmo: null,
      devMes: 30000,
      corto: 'Pampas Verdes',
      nombre: 'Creación del servicio de agua potable en el caserío Pampas Verdes',
      uo: 'UTP',
      etapa: 'Ficha técnica',
      mod: 'Contrata',
      dep: 'Huánuco',
      prov: 'Leoncio Prado',
      dist: 'Rupa-Rupa',
      lat: -9.3,
      lng: -76.0,
      pim: 220000,
      dev: 150000,
      fis: null,
      prog: null,
      culm: 'Sí',
      estado: 'En elaboración',
      benef: 410,
      hitos: [makeHito('h1', 'T', 'Aprobación de la ficha técnica', '2026-11-26')],
    },
    {
      cui: '9100109',
      ritmo: 1.0,
      devMes: 230000,
      corto: 'Tambillo',
      nombre: 'Mejoramiento del servicio de agua potable y UBS en el caserío Tambillo',
      uo: 'PIASAR',
      etapa: 'Ejecución de obra',
      mod: 'Contrata',
      dep: 'Cajamarca',
      prov: 'Cutervo',
      dist: 'Sócota',
      lat: -6.31,
      lng: -78.7,
      pim: 2900000,
      dev: 2500000,
      fis: 88,
      prog: 90,
      culm: 'Sí',
      estado: 'En ejecución',
      benef: 1530,
      hitos: [
        makeHito('h1', 'T', 'Aprobación de la variación N.º 1 (BID)', '2026-11-13'),
        makeHito('h2', 'P', 'Pago de valorización N.º 11 (noviembre)', '2026-12-12'),
        makeHito('h3', 'T', 'Culminación de obra', '2026-12-28'),
      ],
    },
    {
      cui: '9100110',
      ritmo: null,
      devMes: 25000,
      corto: 'Quispicancha',
      nombre: 'Instalación del servicio de agua potable y saneamiento en Quispicancha',
      uo: 'PIASAR',
      etapa: 'Expediente técnico',
      mod: 'Contrata',
      dep: 'Huancavelica',
      prov: 'Tayacaja',
      dist: 'Pampas',
      lat: -12.4,
      lng: -74.87,
      pim: 350000,
      dev: 190000,
      fis: null,
      prog: null,
      culm: 'Duda',
      estado: 'En elaboración',
      benef: 880,
      hitos: [
        makeHito('h1', 'T', 'Opinión del proyectista sobre observaciones', '2026-11-10'),
        makeHito('h2', 'T', 'No objeción del BID al expediente', '2026-12-05'),
      ],
    },
    {
      cui: '9100111',
      ritmo: 1.6,
      devMes: 140000,
      corto: 'Nazareth',
      nombre:
        'Instalación de los servicios de agua potable y disposición sanitaria en la comunidad nativa Nazareth',
      uo: 'AMAZONÍA RURAL',
      etapa: 'Ejecución de obra',
      mod: 'Contrata',
      dep: 'Amazonas',
      prov: 'Bagua',
      dist: 'Imaza',
      lat: -5.16,
      lng: -78.29,
      pim: 2000000,
      dev: 1700000,
      fis: 77,
      prog: 85,
      culm: 'Sí',
      estado: 'En ejecución',
      benef: 1100,
      hitos: [
        makeHito('h1', 'T', 'Traslado fluvial de materiales (lote 2)', '2026-11-16'),
        makeHito('h2', 'T', 'Culminación de obra', '2026-12-16'),
      ],
    },
    {
      cui: '9100112',
      ritmo: 0.9,
      devMes: 30000,
      corto: 'Bellavista del Napo',
      nombre: 'Creación del servicio de agua potable y saneamiento en Bellavista del Napo',
      uo: 'AMAZONÍA RURAL',
      etapa: 'Ejecución de obra',
      mod: 'Contrata',
      dep: 'Loreto',
      prov: 'Maynas',
      dist: 'Napo',
      lat: -2.49,
      lng: -73.67,
      pim: 880000,
      dev: 120000,
      fis: 14,
      prog: 40,
      culm: 'No',
      estado: 'En ejecución',
      benef: 760,
      hitos: [
        makeHito('h1', 'T', 'Ampliación de plazo N.º 2', '2026-11-03'),
        makeHito('h2', 'P', 'Pago de valorización N.º 3 (octubre)', '2026-11-12'),
        makeHito('h3', 'T', 'Culminación de obra', '2027-02-15'),
      ],
    },
    {
      cui: '9100113',
      ritmo: 1.4,
      devMes: 55000,
      corto: 'Puerto Esperanza',
      nombre: 'Mejoramiento del servicio de agua potable en Puerto Esperanza',
      uo: 'AMAZONÍA RURAL',
      etapa: 'Ejecución de obra',
      mod: 'Núcleo ejecutor',
      dep: 'Ucayali',
      prov: 'Purús',
      dist: 'Purús',
      lat: -9.77,
      lng: -70.71,
      pim: 760000,
      dev: 500000,
      fis: 60,
      prog: 66,
      culm: 'Duda',
      estado: 'En ejecución',
      benef: 690,
      hitos: [
        makeHito('h1', 'T', 'Llegada de tubería por vía aérea', '2026-11-22'),
        makeHito('h2', 'T', 'Culminación de obra', '2026-12-30'),
      ],
    },
  ];

  const defaultAsigByUo: Record<UnidadOperativa, string> = {
    UTP: 'ana',
    PIASAR: 'marco',
    'AMAZONÍA RURAL': 'u_ar1',
  };

  const projects: ProyectoSsp[] = base13.map((b) => ({
    ...b,
    asig: defaultAsigByUo[b.uo],
    contrato: { ejecutor: '—', supervisor: '—', monto: 0, inicio: '', fin: '', adic: 0, garantia: '' },
    pres: { pia: 0, pim: b.pim, cert: 0, comp: 0, dev: b.dev },
    finObra: '',
    prev: 0,
    deficit: 0,
    inv: 0,
    conex: 0,
    cv: null,
    hist: [],
    pri: '',
    priX: null,
  }));

  const seg0: Record<string, SeguimientoSemanal> = {};
  const rev0: Record<string, string> = {
    '9100101': '2026-11-10',
    '9100103': '2026-11-10',
    '9100111': '2026-11-17',
    '9100112': '2026-11-17',
    '9100109': '2026-11-14',
  };

  // Deterministic PRNG seed = 411 (identical to prototype lines 650-703)
  let sd = 411;
  const rnd = (): number => {
    sd = (sd + 0x6d2b79f5) | 0;
    let t = Math.imul(sd ^ (sd >>> 15), 1 | sd);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
  const rint = (a: number, b: number): number => Math.floor(a + rnd() * (b - a + 1));
  const r1 = (v: number): number => Math.round(v * 10) / 10;
  const k3 = (v: number): number => Math.round(v / 1000) * 1000;
  const ad = (d: string, n: number): string => {
    const x = new Date(d + 'T12:00:00');
    x.setDate(x.getDate() + n);
    return x.toISOString().slice(0, 10);
  };

  type GeoEntry = [number, number, 'Sierra' | 'Selva', ReadonlyArray<[string, readonly string[]]>];
  const GEO: Record<string, GeoEntry> = {
    Amazonas: [
      -5.6,
      -78.1,
      'Selva',
      [
        ['Bagua', ['Imaza', 'Aramango', 'La Peca']],
        ['Condorcanqui', ['Nieva', 'El Cenepa', 'Río Santiago']],
        ['Chachapoyas', ['Leimebamba', 'Molinopampa', 'Levanto']],
        ['Utcubamba', ['Cajaruro', 'Lonya Grande']],
      ],
    ],
    Áncash: [
      -9.4,
      -77.6,
      'Sierra',
      [
        ['Huari', ['San Marcos', 'Chavín de Huántar', 'Huachis']],
        ['Huaylas', ['Caraz', 'Santa Cruz', 'Yuracmarca']],
        ['Pomabamba', ['Pomabamba', 'Huayllán']],
        ['Carhuaz', ['Shilla', 'Marcará', 'Acopampa']],
      ],
    ],
    Apurímac: [
      -14.0,
      -72.9,
      'Sierra',
      [
        ['Andahuaylas', ['Talavera', 'San Jerónimo', 'Pacucha']],
        ['Abancay', ['Curahuasi', 'Tamburco']],
        ['Aymaraes', ['Chalhuanca', 'Caraybamba']],
      ],
    ],
    Arequipa: [
      -15.7,
      -72.4,
      'Sierra',
      [
        ['Caylloma', ['Chivay', 'Cabanaconde', 'Tisco']],
        ['Castilla', ['Aplao', 'Chachas']],
        ['Condesuyos', ['Chuquibamba', 'Andaray']],
      ],
    ],
    Ayacucho: [
      -13.6,
      -74.1,
      'Sierra',
      [
        ['Huamanga', ['Ocros', 'Tambillo', 'Acocro']],
        ['La Mar', ['San Miguel', 'Tambo', 'Chungui']],
        ['Lucanas', ['Puquio', 'Cabana', 'Aucará']],
      ],
    ],
    Cajamarca: [
      -6.4,
      -78.6,
      'Sierra',
      [
        ['Cajamarca', ['Baños del Inca', 'Jesús', 'Namora']],
        ['Chota', ['Chota', 'Lajas', 'Huambos']],
        ['Cutervo', ['Sócota', 'Cutervo', 'Callayuc']],
        ['San Ignacio', ['Namballe', 'Tabaconas']],
        ['Jaén', ['Pomahuaca', 'Chontalí']],
      ],
    ],
    Cusco: [
      -13.7,
      -71.9,
      'Sierra',
      [
        ['Chumbivilcas', ['Colquemarca', 'Livitaca', 'Velille']],
        ['Canchis', ['Sicuani', 'Pitumarca', 'Combapata']],
        ['Quispicanchi', ['Urcos', 'Ccatca', 'Ocongate']],
        ['Paruro', ['Accha', 'Huanoquite']],
      ],
    ],
    Huancavelica: [
      -12.8,
      -74.9,
      'Sierra',
      [
        ['Tayacaja', ['Colcabamba', 'Pazos']],
        ['Angaraes', ['Lircay', 'Julcamarca']],
        ['Churcampa', ['Churcampa', 'Anco']],
      ],
    ],
    Huánuco: [
      -9.4,
      -76.0,
      'Selva',
      [
        ['Leoncio Prado', ['José Crespo y Castillo', 'Luyando']],
        ['Puerto Inca', ['Puerto Inca', 'Codo del Pozuzo']],
      ],
    ],
    Junín: [
      -11.6,
      -75.0,
      'Sierra',
      [
        ['Jauja', ['Apata', 'Sincos']],
        ['Concepción', ['Comas', 'Mito']],
        ['Tarma', ['Palca', 'Huasahuasi']],
      ],
    ],
    'La Libertad': [
      -7.9,
      -78.2,
      'Sierra',
      [
        ['Sánchez Carrión', ['Huamachuco', 'Sanagorán']],
        ['Otuzco', ['Otuzco', 'Usquil']],
        ['Pataz', ['Tayabamba', 'Parcoy']],
      ],
    ],
    Lima: [
      -11.9,
      -76.5,
      'Sierra',
      [
        ['Huarochirí', ['Matucana', 'San Mateo']],
        ['Yauyos', ['Yauyos', 'Tanta']],
        ['Canta', ['Canta', 'Huamantanga']],
      ],
    ],
    Loreto: [
      -4.6,
      -74.6,
      'Selva',
      [
        ['Maynas', ['Indiana', 'Napo', 'Mazán']],
        ['Alto Amazonas', ['Yurimaguas', 'Lagunas']],
        ['Requena', ['Requena', 'Sapuena']],
        ['Loreto', ['Nauta', 'Parinari']],
      ],
    ],
    'Madre de Dios': [
      -12.3,
      -70.3,
      'Selva',
      [
        ['Tambopata', ['Inambari', 'Laberinto']],
        ['Tahuamanu', ['Iñapari', 'Iberia']],
      ],
    ],
    Pasco: [
      -10.4,
      -75.2,
      'Selva',
      [['Oxapampa', ['Puerto Bermúdez', 'Villa Rica', 'Palcazú']]],
    ],
    Piura: [
      -5.0,
      -79.8,
      'Sierra',
      [
        ['Ayabaca', ['Ayabaca', 'Montero']],
        ['Huancabamba', ['Huancabamba', 'Sondor']],
        ['Morropón', ['Chulucanas', 'Santo Domingo']],
      ],
    ],
    Puno: [
      -15.0,
      -70.2,
      'Sierra',
      [
        ['Azángaro', ['Muñani', 'Arapa', 'San José']],
        ['Puno', ['Acora', 'Pichacani', 'Platería']],
        ['Melgar', ['Ayaviri', 'Nuñoa']],
        ['Huancané', ['Taraco', 'Vilque Chico']],
      ],
    ],
    'San Martín': [
      -6.9,
      -76.8,
      'Selva',
      [
        ['Moyobamba', ['Jepelacio', 'Soritor']],
        ['Lamas', ['Lamas', 'Tabalosos']],
        ['El Dorado', ['San José de Sisa', 'Agua Blanca']],
      ],
    ],
    Ucayali: [
      -9.6,
      -73.9,
      'Selva',
      [
        ['Coronel Portillo', ['Masisea', 'Iparía']],
        ['Atalaya', ['Raymondi', 'Sepahua']],
        ['Padre Abad', ['Irazola', 'Curimaná']],
      ],
    ],
  };

  const DEPS = Object.keys(GEO);
  const SIE = [
    'Chacapampa',
    'Huayllapampa',
    'San Antonio',
    'Pucará',
    'Llactapata',
    'Huancarani',
    'Patacancha',
    'Ccochapata',
    'Antaccocha',
    'Rumichaca',
    'Yanacocha',
    'Quishuar',
    'Pampamarca',
    'Huaraccopata',
    'Tinyaclla',
    'Collpahuasi',
    'Ayrihuanca',
    'Santa Ana',
    'San Juan',
    'Cruz Pata',
    'Ñahuinpuquio',
    'Pachachaca',
    'Ichupampa',
    'Lucmapampa',
    'Ccarhuacc',
    'Mollepata',
    'Totorani',
    'Chilcapampa',
    'Santa Cruz',
    'Pumahuasi',
    'Ccasacancha',
    'Huamanpata',
    'Callqui',
    'Chupa',
    'Qollana',
    'Hatun Ayllu',
    'Sallcca',
    'Uchuy Pampa',
    'Ccollana',
    'Huaccoto',
    'Paccha',
    'Ranracancha',
    'Chinchaypucyo',
    'Tucumachay',
    'Lircaypata',
    'Machaypungo',
    'Huasicancha',
    'Llamapampa',
    'Condorhuachana',
    'Pomacocha',
  ];
  const SEL = [
    'Nuevo Edén',
    'Shimpiyacu',
    'Santa Clara',
    'Puerto Alegre',
    'San Pedro',
    'Libertad',
    'Las Palmeras',
    'Nuevo San Juan',
    'Yarina',
    'Monte Alegre',
    'Primavera',
    'Unión Progreso',
    'Tres de Mayo',
    'Nueva Esperanza',
    'Puerto Arturo',
    'Santa Isabel',
    'Cocha Pacaya',
    'Nuevo Jerusalén',
    'San Lorenzo',
    'Bella Florida',
    'Santa Mercedes',
    'Nuevo Horizonte',
    'Shapajilla',
    'Alto Shamboyacu',
    'Paujil',
    'San Rafael',
    'Nueva Unión',
    'Villa Hermosa',
    'Puerto Rico',
    'Shiringal',
  ];
  const TIPO = [
    'Mejoramiento y ampliación del servicio de agua potable y saneamiento',
    'Creación del servicio de agua potable y disposición sanitaria de excretas',
    'Instalación del sistema de agua potable y unidades básicas de saneamiento',
    'Mejoramiento del servicio de agua potable',
    'Ampliación del sistema de agua potable y alcantarillado',
  ];
  const ASIG: Record<UnidadOperativa, readonly string[]> = {
    UTP: ['ana', 'u_ut1', 'u_ut2', 'u_ut3', 'u_ut4'],
    PIASAR: ['marco', 'u_pi1', 'u_pi2'],
    'AMAZONÍA RURAL': ['u_ar1', 'u_ar2'],
  };

  const used = new Set(projects.map((p) => p.corto));

  for (let i = 0; i < 398; i++) {
    const dep = pick(DEPS);
    const g = GEO[dep];
    const pv = pick(g[3]);
    const dist = pick(pv[1]);
    const zona = g[2];
    const base = pick(zona === 'Selva' ? SEL : SIE);
    let corto = base;
    if (used.has(corto)) {
      corto = base + ' ' + pick(['Alto', 'Bajo', 'Grande', 'Chico', 'Nuevo', 'Centro']);
    }
    let n = 2;
    while (used.has(corto)) {
      corto = base + ' ' + n++;
    }
    used.add(corto);

    const AR = ['Loreto', 'Amazonas', 'Ucayali', 'San Martín', 'Madre de Dios'].includes(dep);
    const ru = rnd();
    const uo: UnidadOperativa = AR
      ? ru < 0.6
        ? 'AMAZONÍA RURAL'
        : ru < 0.85
          ? 'UTP'
          : 'PIASAR'
      : ru < 0.7
        ? 'UTP'
        : 'PIASAR';

    const re = rnd();
    const etapa: EtapaProyecto =
      re < 0.46
        ? 'Ejecución de obra'
        : re < 0.74
          ? 'Expediente técnico'
          : re < 0.93
            ? 'Ficha técnica'
            : 'Destrabe';
    const obra = etapa === 'Ejecución de obra' || etapa === 'Destrabe';

    let fis: number | null = null;
    let prog: number | null = null;
    let ritmo: number | null = null;
    let estado: EstadoProyecto = 'En elaboración';
    let culm: Culmina2026 = 'Sí';
    let fin2027 = false;
    let pim: number;
    let dev: number;
    let fin: string;

    if (obra) {
      prog = rint(22, 98);
      fis = Math.max(3, Math.min(99, prog - Math.round(Math.pow(rnd(), 2) * 18 - 2)));
      const rs = rnd();
      estado =
        etapa === 'Destrabe'
          ? 'Paralizada'
          : rs < 0.05
            ? 'Paralizada'
            : rs < 0.1
              ? 'Suspendida'
              : 'En ejecución';
      ritmo = estado === 'En ejecución' ? r1(0.6 + rnd() * 2.2) : 0;
      const fisFin = fis + ritmo * 6.2;
      if (estado === 'En ejecución' && fisFin >= 100) {
        culm = 'Sí';
        fin = ad('2026-12-01', rint(0, 29));
      } else if (estado === 'En ejecución' && fisFin >= 92 && rnd() < 0.35) {
        culm = 'Duda';
        fin = ad('2026-12-20', rint(0, 40));
      } else {
        culm = 'No';
        fin2027 = true;
        fin = ad('2027-01-15', rint(0, 200));
      }
      pim = k3(500000 + rnd() * 3000000);
      dev = k3(pim * Math.min(0.98, (fis / 100) * (0.75 + rnd() * 0.3)));
    } else {
      pim = k3(
        etapa === 'Expediente técnico' ? 150000 + rnd() * 450000 : 60000 + rnd() * 190000
      );
      dev = k3(pim * (0.25 + rnd() * 0.55));
      fin =
        etapa === 'Expediente técnico'
          ? ad('2026-12-05', rint(0, 120))
          : ad('2026-11-28', rint(0, 90));
      if (fin > '2026-12-31') {
        culm = 'No';
        fin2027 = true;
      }
    }

    const cui = String(9100114 + i);
    const hitos: HitoSsp[] = [];
    if (obra) {
      hitos.push(
        makeHito('h1', 'P', 'Pago de valorización N.º ' + rint(2, 12), ad(CORTE_FECHA, rint(8, 45)))
      );
      hitos.push(
        makeHito(
          'h2',
          'T',
          etapa === 'Destrabe' ? 'Convocatoria del saldo de obra' : 'Culminación de obra',
          etapa === 'Destrabe' ? ad(CORTE_FECHA, rint(15, 60)) : fin
        )
      );
    } else {
      hitos.push(
        makeHito(
          'h1',
          'T',
          etapa === 'Expediente técnico'
            ? 'Aprobación del expediente técnico'
            : 'Aprobación de la ficha técnica',
          fin
        )
      );
    }

    const mod: ModalidadProyecto = obra && rnd() < 0.45 ? 'Núcleo ejecutor' : 'Contrata';
    const devMes = k3((pim - dev) / Math.max(1.5, rnd() * 6));
    const nombre =
      pick(TIPO) +
      ' en ' +
      (zona === 'Selva' && rnd() < 0.4 ? 'la comunidad nativa ' : 'la localidad de ') +
      corto +
      ', distrito de ' +
      dist;
    const lat = +(g[0] + (rnd() - 0.5) * 1.5).toFixed(2);
    const lng = +(g[1] + (rnd() - 0.5) * 1.3).toFixed(2);
    const benef = rint(180, 2600);
    const asig = pick(ASIG[uo]);
    const emp: [string, string] = obra
      ? [
          mod === 'Núcleo ejecutor'
            ? 'Núcleo Ejecutor ' + corto
            : 'Consorcio ' + corto.split(' ')[0],
          mod === 'Núcleo ejecutor' ? 'Inspector PNSR' : 'Supervisión externa',
        ]
      : ['Consultor de estudios', 'Revisor PNSR'];

    projects.push({
      cui,
      syn: true,
      zona,
      fin2027,
      ritmo,
      devMes,
      corto,
      nombre,
      uo,
      etapa,
      mod,
      dep,
      prov: pv[0],
      dist,
      lat,
      lng,
      pim,
      dev,
      fis,
      prog,
      culm,
      estado,
      benef,
      hitos,
      asig,
      emp,
      contrato: { ejecutor: '—', supervisor: '—', monto: 0, inicio: '', fin: '', adic: 0, garantia: '' },
      pres: { pia: 0, pim, cert: 0, comp: 0, dev },
      finObra: '',
      prev: 0,
      deficit: 0,
      inv: 0,
      conex: 0,
      cv: null,
      hist: [],
      pri: '',
      priX: null,
    });

    seg0[cui] = {
      f: rnd() < 0.9 ? ad(CORTE_FECHA, -rint(0, 6)) : ad(CORTE_FECHA, -rint(8, 20)),
      u: asig,
      fis,
      det: '',
    };
    rev0[cui] = rnd() < 0.94 ? ad(CORTE_FECHA, -rint(0, 6)) : ad(CORTE_FECHA, -rint(9, 25));
  }

  // Enrich all 411 projects with contrato, pres, finObra, prev, deficit, inv, conex, and S-curve
  projects.forEach((p, k) => {
    const e = EMP_BY_CUI[p.cui] || p.emp || ['—', '—'];
    const fin = p.hitos.find((h) => /Culminación/.test(h.h))?.f || '';
    p.contrato = {
      ejecutor: e[0],
      supervisor: e[1],
      monto: Math.round((p.pim * 1.6) / 1000) * 1000,
      inicio: '2026-0' + (2 + (k % 6)) + '-15',
      fin,
      adic: p.cui === '9100101' ? 1 : p.cui === '9100109' ? 1 : 0,
      garantia:
        p.mod === 'Contrata' && p.etapa === 'Ejecución de obra'
          ? '2026-12-' + String(5 + (k % 20)).padStart(2, '0')
          : '',
    };
    p.pres = {
      pia: Math.round(p.pim * 0.85),
      pim: p.pim,
      cert: Math.round(Math.min(p.pim, p.dev + p.pim * 0.18)),
      comp: Math.round(Math.min(p.pim, p.dev + p.pim * 0.1)),
      dev: p.dev,
    };
    p.finObra = fin;
    p.prev =
      p.fis != null
        ? Math.round(((p.pim * p.fis) / 100) * 0.9 / 1000) * 1000
        : Math.round((p.pim * 0.4) / 1000) * 1000;
    p.deficit = DEFICIT_BY_CUI[p.cui] || 0;
    p.inv = p.fis != null ? p.prev + p.pim + p.deficit : Math.round((p.pim * 14) / 1000) * 1000;
    p.conex = Math.round(p.benef / 3.9);
    genProjectCurve(p);
  });

  // Prioritized portfolio seed (PRI0, PRIH0)
  const priMap: Record<string, PriorizadoTipo> = {
    '9100101': 'Compromiso',
    '9100102': 'Compromiso',
    '9100103': 'Compromiso',
    '9100105': 'Compromiso',
    '9100107': 'Compromiso',
    '9100109': 'Compromiso',
    '9100111': 'Compromiso',
    '9100112': 'Compromiso',
    '9100104': 'Compromiso',
    '9100113': 'Contingencia',
    '9100106': 'Contingencia',
  };
  const priMeta: Record<string, [string, string]> = {
    '9100104': ['Aprobar el expediente técnico', '2026-12-31'],
    '9100106': ['Convocar el saldo de obra (destrabe)', '2026-12-31'],
    '9100108': ['Aprobar la ficha técnica', '2026-12-31'],
  };

  projects
    .filter((p) => p.syn && p.culm === 'Sí' && p.etapa === 'Ejecución de obra')
    .slice(0, 36)
    .forEach((p) => {
      priMap[p.cui] = 'Compromiso';
    });

  projects
    .filter((p) => p.syn && p.culm === 'Duda')
    .slice(0, 6)
    .forEach((p) => {
      priMap[p.cui] = 'Contingencia';
    });

  const pri0: Record<string, PriorizadoInfo> = {};
  projects.forEach((p) => {
    const tipo = priMap[p.cui];
    if (tipo) {
      const m = priMeta[p.cui] || ['Culminar la obra', '2026-12-31'];
      pri0[p.cui] = {
        tipo,
        meta: m[0],
        fm: m[1],
        sust: 'Presentación de compromisos ante el Viceministerio (oct. 2026)',
        desde: '2026-10-01',
        u: 'carla',
      };
    }
  });

  const prih0: PriorizadoHistItem[] = Object.keys(pri0)
    .map(
      (c): PriorizadoHistItem => ({
        f: '2026-10-01',
        cui: c,
        acc: 'Inclusión',
        de: '',
        a: c === '9100113' ? 'Compromiso' : pri0[c].tipo,
        mot: 'Lista inicial de compromisos 2026',
        u: 'carla',
      })
    )
    .concat([
      {
        f: '2026-10-29',
        cui: '9100110',
        acc: 'Retiro',
        de: 'Compromiso',
        a: '',
        mot: 'La no objeción del BID no llegaría en el año; se retira de la meta 2026',
        u: 'de',
      },
      {
        f: '2026-11-05',
        cui: '9100113',
        acc: 'Cambio de tipo',
        de: 'Compromiso',
        a: 'Contingencia',
        mot: 'Dependencia de vuelos para la tubería; pasa a contingencia',
        u: 'de',
      },
    ]);

  // Apply initial pri synchronization
  projects.forEach((p) => {
    const x = pri0[p.cui];
    p.pri = x ? x.tipo : '';
    p.priX = x || null;
  });

  return { projects, seg0, rev0, pri0, prih0 };
}
