import { LayerItem, Section, SubSection } from './geoLayers';

/* ------------------------------------------------------------------------- */
/*  Fábricas declarativas                                                     */
/* ------------------------------------------------------------------------- */

/** Propiedades opcionales al declarar una capa (lo omitido toma el valor por defecto). */
type CapaOpciones = Partial<Pick<LayerItem, 'visible' | 'opacity' | 'showInLegend' | 'disabled' | 'requiresAuth' | 'legendColor'>>;

/**
 * Crea una capa del panel aplicando los valores por defecto
 * (`visible: false`, `opacity: 1`, `showInLegend: false`), de modo que cada
 * entrada solo declara aquello que se desvía del estándar.
 *
 * Las capas sin `id` se declaran automáticamente como `disabled`.
 */
const capa = (id: string, label: string, opciones: CapaOpciones = {}): LayerItem => ({
  type: 'layer',
  id,
  label,
  visible: false,
  opacity: 1,
  showInLegend: false,
  disabled: id === '' ? true : false,
  ...opciones,
});

export const VIVIENDAS_RURALES_LAYER_CONFIGS = [
  {
    arcgisLayerId: 1,
    itemId: 'viviendas-rurales-agua-con-acceso',
    group: 'agua',
    title: 'Viviendas rurales con acceso a agua',
    label: 'Con acceso a agua',
    color: '#16803c',
    zIndex: 20,
  },
  {
    arcgisLayerId: 2,
    itemId: 'viviendas-rurales-agua-sin-acceso',
    group: 'agua',
    title: 'Viviendas rurales sin acceso a agua',
    label: 'Sin acceso a agua',
    color: '#dc2626',
    zIndex: 21,
  },
  {
    arcgisLayerId: 4,
    itemId: 'viviendas-rurales-alcantarillado-con-acceso',
    group: 'alcantarillado',
    title: 'Viviendas rurales con acceso a alcantarillado',
    label: 'Con acceso a alcantarillado',
    color: '#2563eb',
    zIndex: 22,
  },
  {
    arcgisLayerId: 5,
    itemId: 'viviendas-rurales-alcantarillado-sin-acceso',
    group: 'alcantarillado',
    title: 'Viviendas rurales sin acceso a alcantarillado',
    label: 'Sin acceso a alcantarillado',
    color: '#f97316',
    zIndex: 23,
  },
] as const;

export interface PeruLimitsLayerConfig {
  arcgisLayerId: number;
  itemId: string;
  label: string;
}

type PeruLimitsPanelItemConfig =
  | { type: 'layer'; layer: PeruLimitsLayerConfig }
  | { type: 'group'; id: string; title: string; layers: PeruLimitsLayerConfig[] };

export const PERU_ADMINISTRATIVE_LAYER_IDS = {
  departments: 6,
  provinces: 7,
  districts: 8,
} as const;

export const PERU_LIMITS_PANEL_ITEMS: readonly PeruLimitsPanelItemConfig[] = [
  {
    type: 'layer',
    layer: { arcgisLayerId: 0, itemId: 'limites-centros-poblados', label: 'Centros Poblados' },
  },
  {
    type: 'group',
    id: 'limites-vias',
    title: 'VÍAS',
    layers: [
      { arcgisLayerId: 2, itemId: 'limites-vias-vecinales', label: 'Vías Vecinales' },
      { arcgisLayerId: 3, itemId: 'limites-vias-departamentales', label: 'Vías Departamentales' },
      { arcgisLayerId: 4, itemId: 'limites-vias-nacionales', label: 'Vías Nacionales' },
      { arcgisLayerId: 5, itemId: 'limites-via-ferrea', label: 'Vía Férrea' },
    ],
  },
  {
    type: 'layer',
    layer: {
      arcgisLayerId: PERU_ADMINISTRATIVE_LAYER_IDS.departments,
      itemId: 'limites-departamentos',
      label: 'Departamentos',
    },
  },
  {
    type: 'layer',
    layer: {
      arcgisLayerId: PERU_ADMINISTRATIVE_LAYER_IDS.provinces,
      itemId: 'limites-provincias',
      label: 'Provincias',
    },
  },
  {
    type: 'layer',
    layer: {
      arcgisLayerId: PERU_ADMINISTRATIVE_LAYER_IDS.districts,
      itemId: 'limites-distritos',
      label: 'Distritos',
    },
  },
  {
    type: 'group',
    id: 'limites-hidrografia',
    title: 'HIDROGRAFÍA',
    layers: [
      { arcgisLayerId: 10, itemId: 'limites-rios-principales', label: 'Ríos Principales' },
      { arcgisLayerId: 11, itemId: 'limites-rios', label: 'Ríos' },
      { arcgisLayerId: 12, itemId: 'limites-quebradas', label: 'Quebradas' },
    ],
  },
  {
    type: 'layer',
    layer: { arcgisLayerId: 13, itemId: 'limites-centros-poblados-v2', label: 'Centros Poblados v2' },
  },
];

export const PERU_LIMITS_LAYER_CONFIGS: readonly PeruLimitsLayerConfig[] =
  PERU_LIMITS_PANEL_ITEMS.flatMap(item => item.type === 'group' ? item.layers : [item.layer]);

export const COEN_FEN_2027_LAYER_GROUPS = [
  {
    id: 'comision-fen',
    title: 'COMISIÓN FEN',
    layers: [
      {
        arcgisLayerId: 59,
        itemId: 'coen-fen-2027-manzanas-riesgo-inundacion',
        label: 'Manzanas por nivel de riesgo de inundación',
      },
      {
        arcgisLayerId: 60,
        itemId: 'coen-fen-2027-manzanas-expuestas-fenc-2017',
        label: 'Manzanas expuestas a inundaciones FENC 2017',
      },
    ],
  },
  {
    id: 'callao',
    title: 'CALLAO',
    layers: [
      {
        arcgisLayerId: 56,
        itemId: 'coen-fen-2027-callao-intervenciones',
        label: 'Intervenciones',
      },
      {
        arcgisLayerId: 55,
        itemId: 'coen-fen-2027-callao-intervenciones-tramos',
        label: 'Intervenciones tramos',
      },
    ],
  },
  {
    id: 'cenepred',
    title: 'CENEPRED',
    layers: [
      {
        arcgisLayerId: 52,
        itemId: 'coen-fen-2027-infraestructura-critica',
        label: 'Infraestructura crítica',
      },
    ],
  },
  {
    id: 'indeci',
    title: 'INDECI',
    layers: [
      {
        arcgisLayerId: 31,
        itemId: 'coen-fen-2027-almacenes-nacionales',
        label: 'Almacenes Nacionales 2027',
      },
    ],
  },
  {
    id: 'vivienda',
    title: 'Vivienda',
    layers: [
      {
        arcgisLayerId: 51,
        itemId: 'coen-fen-2027-vivienda-intervenciones',
        label: 'Intervenciones',
      },
      {
        arcgisLayerId: 22,
        itemId: 'coen-fen-2027-vivienda-intervenciones-2027',
        label: 'Intervenciones 2027',
      },
    ],
  },
  {
    id: 'ana',
    title: 'ANA',
    layers: [
      {
        arcgisLayerId: 24,
        itemId: 'coen-fen-2027-puntos-criticos-tramos',
        label: 'Puntos criticos tramos 2027',
      },
      {
        arcgisLayerId: 25,
        itemId: 'coen-fen-2027-puntos-criticos',
        label: 'Puntos críticos 2027',
      },
    ],
  },
] as const;

export interface OrtofotoLayerConfig {
  serviceName: string;
  itemId: string;
  label: string;
  subLayerId?: number;
}

export const ORTOFOTOS_LAYER_CONFIGS: readonly OrtofotoLayerConfig[] = [
  { serviceName: 'GDR_CASMA', itemId: 'ortofoto-casma', label: 'CASMA', subLayerId: 0 },
  { serviceName: 'ORTOFOTO_ANTARTICO', itemId: 'ortofoto-antartico', label: 'ANTÁRTICO' },
  { serviceName: 'ORTOFOTO_AREQUIPA', itemId: 'ortofoto-arequipa', label: 'AREQUIPA' },
  { serviceName: 'ORTOFOTO_CARAL', itemId: 'ortofoto-caral', label: 'CARAL' },
  { serviceName: 'ORTOFOTO_CARHUAZ', itemId: 'ortofoto-carhuaz', label: 'CARHUAZ' },
  { serviceName: 'ORTOFOTO_CAÑETE', itemId: 'ortofoto-canete', label: 'CAÑETE' },
  { serviceName: 'ORTOFOTO_FERRAZ', itemId: 'ortofoto-ferraz', label: 'FERRAZ' },
  { serviceName: 'ORTOFOTO_HUANCAYO', itemId: 'ortofoto-huancayo', label: 'HUANCAYO' },
  { serviceName: 'ORTOFOTO_HUARAZ', itemId: 'ortofoto-huaraz', label: 'HUARAZ' },
  { serviceName: 'ORTOFOTO_ICA', itemId: 'ortofoto-ica', label: 'ICA' },
  { serviceName: 'ORTOFOTO_ILO', itemId: 'ortofoto-ilo', label: 'ILO' },
  { serviceName: 'ORTOFOTO_LURÍN', itemId: 'ortofoto-lurin', label: 'LURÍN' },
  { serviceName: 'ORTOFOTO_MACHU_PICHU', itemId: 'ortofoto-machu-pichu', label: 'MACHU PICCHU' },
  { serviceName: 'ORTOFOTO_NASCA', itemId: 'ortofoto-nasca', label: 'NASCA' },
  { serviceName: 'ORTOFOTO_PUENTE_PIEDRA', itemId: 'ortofoto-puente-piedra', label: 'PUENTE PIEDRA' },
  { serviceName: 'ORTOFOTO_PUNO', itemId: 'ortofoto-puno', label: 'PUNO' },
  { serviceName: 'ORTOFOTO_SAN_CLEMENTE', itemId: 'ortofoto-san-clemente', label: 'SAN CLEMENTE' },
  { serviceName: 'ORTOFOTO_TACNA', itemId: 'ortofoto-tacna', label: 'TACNA' },
  { serviceName: 'ORTOFOTO_TINGO_MARÍA', itemId: 'ortofoto-tingo-maria', label: 'TINGO MARÍA' },
  { serviceName: 'ORTOFOTO_TRUJILLO', itemId: 'ortofoto-trujillo', label: 'TRUJILLO' },
  { serviceName: 'ORTOFOTO_TUMBES', itemId: 'ortofoto-tumbes', label: 'TUMBES' },
] as const;

const capasViviendasRurales = (group: 'agua' | 'alcantarillado'): LayerItem[] =>
  VIVIENDAS_RURALES_LAYER_CONFIGS
    .filter(layer => layer.group === group)
    .map(layer => capa(layer.itemId, layer.label, {
      visible: true,
      showInLegend: true,
      legendColor: layer.color,
    }));

/** Crea una subsección plegable con sus capas. */
const subseccion = (
  id: string,
  title: string,
  layers: LayerItem[],
  expanded = false,
  opciones: Partial<Pick<SubSection, 'requiresAuth' | 'subtitle'>> = {}
): SubSection => ({
  type: 'subsection',
  id,
  title,
  expanded,
  layers,
  ...opciones,
});

/* ------------------------------------------------------------------------- */
/*  Política de acceso (integración con AuthService)                          */
/* ------------------------------------------------------------------------- */

/**
 * Por defecto, TODAS las secciones del panel requieren sesión iniciada
 * (`requiresAuth`; ver `MapService.panelSections`). Si una sección debe verse
 * también sin autenticar, añade su `id` aquí y quedará exenta automáticamente.
 * Para casos finos (una capa o subsección concreta) usa `requiresAuth` en el item.
 */
const SECCIONES_PUBLICAS: ReadonlySet<string> = new Set<string>([
  'limitesPeru',
  'viviendasRurales',
  'coenFen2027',
  'ortofotos',
]);

/** Marca como restringidas todas las secciones que no estén exentas en `SECCIONES_PUBLICAS`. */
const aplicarPoliticaAcceso = (secciones: Section[]): Section[] =>
  secciones.map(s => (SECCIONES_PUBLICAS.has(s.id) ? s : { ...s, requiresAuth: true }));

/* ------------------------------------------------------------------------- */
/*  Estructura del panel (sin política de acceso; se aplica al final)          */
/* ------------------------------------------------------------------------- */

const PANEL_BASE: Section[] = [
  {
    id: 'limitesPeru',
    title: 'LÍMITES DEL PERÚ',
    expanded: false,
    items: PERU_LIMITS_PANEL_ITEMS.map(item =>
      item.type === 'group'
        ? subseccion(
          item.id,
          item.title,
          item.layers.map(layer => capa(layer.itemId, layer.label, { visible: true, showInLegend: true })),
          true
        )
        : capa(item.layer.itemId, item.layer.label, { visible: true, showInLegend: true })
    ),
  },
  {
    id: 'viviendasRurales',
    title: 'VIVIENDAS RURALES',
    expanded: true,
    items: [
      subseccion('viviendasRuralesAgua', 'ACCESO A AGUA', capasViviendasRurales('agua'), true),
      subseccion(
        'viviendasRuralesAlcantarillado',
        'ACCESO A ALCANTARILLADO',
        capasViviendasRurales('alcantarillado'),
        true
      ),
    ],
  },
  {
    id: 'coenFen2027',
    title: 'FEN2027',
    expanded: false,
    items: COEN_FEN_2027_LAYER_GROUPS.map(group =>
      subseccion(
        group.id,
        group.title,
        group.layers.map(layer => capa(layer.itemId, layer.label, { showInLegend: true })),
        false
      )
    ),
  },
  {
    id: 'ortofotos',
    title: 'ORTOFOTOS',
    expanded: false,
    items: ORTOFOTOS_LAYER_CONFIGS.map(layer => capa(layer.itemId, layer.label)),
  },
];

export const LAYER_PANEL_SECTIONS: Section[] = aplicarPoliticaAcceso(PANEL_BASE);
