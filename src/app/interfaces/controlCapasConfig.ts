import { LayerItem, Section, SubSection } from './geoLayers';
import { ORTOFOTO_YEARS } from './ortofotos';

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
  'imaAereas',
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
    items: [capa('limites-peru', 'Límites del Perú', { visible: true, showInLegend: true })],
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
    id: 'imaAereas',
    title: 'IMÁGENES AEREAS',
    expanded: false,
    items: [
      subseccion('ortofotos_historicas', 'Ortofotos Históricas', [
        ...ORTOFOTO_YEARS.map(year => capa(`ortofoto_${year}`, `${year}`)),
      ], false, { requiresAuth: false }),
    ],
  },
];

export const LAYER_PANEL_SECTIONS: Section[] = aplicarPoliticaAcceso(PANEL_BASE);
