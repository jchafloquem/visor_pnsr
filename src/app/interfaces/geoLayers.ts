import { BaseLayer } from '../modules/openlayers.module';

/** Estructura básica de una geometría GeoJSON, incluyendo GeometryCollection */
export interface GeoJSONGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPolygon' | 'MultiLineString' | 'GeometryCollection';
  coordinates?: any[]; // Coordenadas para geometrías simples
  geometries?: GeoJSONGeometry[]; // Array de geometrías para GeometryCollection
}

/** Estructura de un Feature GeoJSON */
export interface GeoJSONFeature {
  type: 'Feature';
  id?: string;
  /** Sistema de referencia declarado por el servicio de origen. */
  crs?: { type: string; properties: { name: string } };
  geometry: GeoJSONGeometry;
  properties: Record<string, any>;
}

export interface LayerLegendEntry {
  label: string;
  url: string;
}

export interface LayerItem {
  showInLegend: boolean;
  /** Si es true, la capa solo se muestra en el panel cuando el usuario está autenticado. */
  requiresAuth?: boolean;
  /**
   * Si es true, la capa se muestra "bloqueada" en el panel: checkbox atenuado,
   * candado y sin posibilidad de activarla. Se usa para capas en desarrollo
   * (sin servicio cartográfico asociado).
   */
  disabled?: boolean;
  type: 'layer';
  id: string;
  label: string;
  visible: boolean;
  opacity: number;
  olLayer?: BaseLayer;
  legendUrl?: string; // Añadimos la propiedad legendUrl
  /**
   * Leyendas de la capa: el panel puede mostrar varias entradas bajo un mismo
   * título; `legendUrl` conserva la primera por compatibilidad.
   */
  legendUrls?: string[];
  /** Simbología dinámica devuelta por servicios que no publican URLs de imagen. */
  legendEntries?: LayerLegendEntry[];
  /** Color del símbolo cuando la capa vectorial no tiene una leyenda como imagen. */
  legendColor?: string;
}
export interface SubSection {
  type: 'subsection';
  id: string;
  title: string;
  subtitle?: string;
  /** Si es true, la subsección completa solo se muestra con sesión iniciada. */
  requiresAuth?: boolean;
  expanded: boolean;
  layers: LayerItem[];
}
export interface Section {
  id: string;
  title: string;
  subtitle?: string;
  /** Si es true, toda la sección solo se muestra con sesión iniciada. */
  requiresAuth?: boolean;
  expanded: boolean;
  items: (LayerItem | SubSection)[];
}

/* ------------------------------------------------------------------------- */
/*  Utilidades de simbología (panel de leyenda)                               */
/* ------------------------------------------------------------------------- */

/**
 * Capas (`LayerItem`) que contiene una sección, incluidas las que viven dentro
 * de sus subsecciones. Útil para recorrer el panel sin duplicar el doble
 * tratamiento `SubSection` / `LayerItem` en cada consumo.
 */
export function capasDeSeccion(seccion: Section): LayerItem[] {
  return seccion.items.flatMap(item =>
    'layers' in item ? item.layers : item.type === 'layer' ? [item] : []
  );
}

/**
 * Indica si una capa debe aportar su simbología al panel de leyenda: está
 * encendida, no se excluyó de la leyenda (`showInLegend: false`) y tiene al
 * menos una imagen generada (`legendUrls` en las capas compuestas, `legendUrl`
 * en el resto) o un color de símbolo vectorial.
 */
export function capaAportaSimbologia(capa: LayerItem): boolean {
  if (!capa.visible || capa.showInLegend === false) return false;
  return (capa.legendEntries?.length ?? 0) > 0 ||
    (capa.legendUrls?.length ?? 0) > 0 ||
    Boolean(capa.legendUrl) ||
    Boolean(capa.legendColor);
}

/**
 * Capas cuya simbología debe mostrarse en la leyenda, en el orden en que
 * aparecen en el panel. Fuente única de verdad para el contenido de la ventana
 * flotante y para decidir si debe abrirse u ocultarse automáticamente.
 */
export function capasConSimbologiaVisible(secciones: Section[]): LayerItem[] {
  return secciones.flatMap(capasDeSeccion).filter(capaAportaSimbologia);
}

/** Qué debe hacer el visor con la ventana flotante de la leyenda tras un cambio de visibilidad. */
export type SincroniaLeyenda = 'abrir' | 'cerrar' | 'ninguna';

/**
 * Regla que mantiene la ventana de la leyenda alineada con el panel de capas:
 *  - `abrir`: se encendió simbología nueva; si el usuario activa una capa con
 *    leyenda, la ventana no debería seguir escondida tras el menú.
 *  - `cerrar`: ya no queda ninguna simbología visible y la ventana se había
 *    abierto sola, para no dejar un panel vacío sobre el mapa.
 *  - `ninguna`: en cualquier otro caso. Si la ventana se abrió a mano desde el
 *    menú se respeta la decisión del usuario, aunque apague todas las capas.
 * @param simbologiaAntes Capas con simbología visible antes del cambio.
 * @param simbologiaAhora Capas con simbología visible después del cambio.
 * @param abiertaAutomaticamente `true` si la ventana está abierta porque el
 *                              visor la abrió, no porque la pidiera el usuario.
 */
export function sincroniaLeyenda(
  simbologiaAntes: number,
  simbologiaAhora: number,
  abiertaAutomaticamente: boolean
): SincroniaLeyenda {
  if (simbologiaAhora > simbologiaAntes) return 'abrir';
  if (simbologiaAhora === 0 && abiertaAutomaticamente) return 'cerrar';
  return 'ninguna';
}

/* ------------------------------------------------------------------------- */
/*  Resultados de las consultas/APIs del Geovisor                             */
/* ------------------------------------------------------------------------- */

/** Interfaz para los resultados de búsqueda de predios */
export interface SearchResult {
  codigoCatastral: string;
  direccion: string;
  propietario?: string;
  area?: string;
  zonificacion?: string;
  fotoFrontis: string;
  numeroPisos?: number;
  materialPredominante?: string;
  estadoConservacion?: string;
  geometry?: GeoJSONGeometry;
}

/** Coincidencia de titular catastral devuelta por el API del Geovisor. */
export interface TitularCatastral {
  txttitular: string;
  codlote: string;
  /** Datos de la vía asociada al lote (según respuesta del API) */
  tipvia?: string;
  nomvia?: string;
  numero?: string;
}

/** Registro de búsqueda por denominación de predio devuelto por el API del Geovisor (`busqueda-denominacion-lote`). */
export interface DenominacionLoteResultado {
  codlote: string;
  txtcuc: string;
  txtdenominacion: string;
  txtmzaurbano: string;
  txtloteurbano: string;
  lotecodcatant: string;
  codlotecatastral: string;
  txtdirecprincipal: string;
}

/** Registro de numeración de vía devuelto por el API del Geovisor. */
export interface ViaNumero {
  numero: string;
  codlote: string;
  codlotenumero: string;
}

/** Registro de búsqueda por CUC devuelto por el API del Geovisor (`busqueda-cuc`). */
export interface CucResultado {
  txtcuc: string;
  txtpropietario: string;
  codlote: string;
  codvia: string;
  tipvia: string;
  nomvia: string;
  via: string;
  numero: string;
  txttipint: string;
  codtipint: string;
  numeroint: string;
}

/** Registro de búsqueda por Código Predial devuelto por el API del Geovisor (`busqueda-codpredial`). */
export interface CodPredialResultado {
  txtcodipredrent: string;
  txtcuc: string;
  txttitular: string;
  codlote: string;
  codvia: string;
  tipvia: string;
  nomvia: string;
  via: string;
  numero: string;
  txttipint: string;
  codtipint: string;
  numeroint: string;
}

/** Vía devuelta por el API `listar-vias` del Geovisor municipal. */
export interface ViaApi {
  codvia: string;
  txtnomvia: string;
  txttipoviaabrev: string;
  codviaequ: string;
  codtipovia: string;
  txttipovia: string;
  txtnomviA_ANT?: string;
}

/* ------------------------------------------------------------------------- */
/*  Estado del visor                                                          */
/* ------------------------------------------------------------------------- */

/** Tipos de mapa base disponibles en el visor. */
export type TipoMapaBase = 'satellite' | 'streets' | 'topo' | 'blanco';

/**
 * Datos resumidos de un lote devueltos por el API listar-datos-lote del
 * Geovisor municipal. Se muestran en el popup al pasar el mouse sobre el lote.
 */
export interface LoteDatosHover {
  codlote: string;
  txtcuc: string;
  txtmzaurbano: string;
  txtloteurbano: string;
  lotecodcatant: string;
  codlotecatastral: string;
  txtdirecprincipal: string;
}
