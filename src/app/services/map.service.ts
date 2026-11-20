import { Injectable, signal, computed, inject, NgZone, effect, untracked } from '@angular/core';
import { DrawMeasureService } from './draw.service';
import { AuthService } from './auth.service';
import {
  ArcGISRestService,
  PERU_LIMITS_MAPSERVER_URL,
  VIVIENDAS_RURALES_COARSE_RESOLUTION,
} from './arcgis-rest.service';
import { AUDITORIA_OPCIONES, AuditoriaService } from './auditoria.service';
import { environment } from '../../environments/environment';
import { easeOut } from 'ol/easing';
import { defaults as defaultInteractions } from 'ol/interaction';
import type { Coordinate } from 'ol/coordinate';

import { ORTOFOTO_YEARS } from '../interfaces/ortofotos';
import {
  LAYER_PANEL_SECTIONS,
  VIVIENDAS_RURALES_LAYER_CONFIGS,
} from '../interfaces/controlCapasConfig';
import {
  Section,
  LayerItem,
  GeoJSONGeometry,
  TipoMapaBase,
  capasConSimbologiaVisible,
  sincroniaLeyenda,
} from '../interfaces/geoLayers';
import {
  INITIAL_CENTER,
  INITIAL_ZOOM,
  MAP_MAX_ZOOM,
  GOOGLE_SATELLITE_URL,
  ARCGIS_WORLD_TOPO_TILES_URL,
  ANIMATION_DURATION,
  ZOOM_MAX_PARQUE,
  ZOOM_MAX_PARQUE_CENTROIDE,
  SAN_ISIDRO_CENTER,
  SAN_ISIDRO_ZOOM,
  SAN_ISIDRO_EXTENT,
  TERMS_ZOOM_DISTRICTO
} from '../interfaces/mapas.config';
import {
  BaseLayer,
  Circle,
  extend,
  Feature,
  Fill,
  fromLonLat,
  GeoJSON,
  getCenter,
  getDistance,
  isEmpty,
  ImageTile,
  Layer,
  LineString,
  OlMap,
  OlTile,
  Overlay,
  Point,
  ScaleLine,
  Stroke,
  Style,
  Text,
  TileLayer,
  TileState,
  transform,
  transformExtent,
  VectorLayer,
  VectorSource,
  View,
  XYZ,
  defaultControls,
} from '@app/modules/openlayers.module';

/**
 * Servicio de Angular para la gestión del mapa OpenLayers.
 * Encapsula toda la lógica relacionada con la inicialización, manipulación
 * y gestión de elementos del mapa, como capas, controles y overlays.
 */
@Injectable({
  providedIn: 'root'
})
export class MapService {
  private readonly zone = inject(NgZone);
  private readonly drawMeasureService = inject(DrawMeasureService);
  private readonly authService = inject(AuthService);
  private readonly arcgisRestService = inject(ArcGISRestService);
  /** Registro de auditoría de las capas seleccionadas por el usuario. */
  private readonly auditoria = inject(AuditoriaService);
  baseLayerType = signal<TipoMapaBase>('satellite');
  /** Instancia del mapa OpenLayers */
  private readonly _map = signal<OlMap | undefined>(undefined);
  /** Exposición del mapa como Signal de solo lectura */
  public readonly map = this._map.asReadonly();
  // Capas base accesibles para manipulación directa
  /** Capa de imágenes satelitales */
  public satelliteLayer?: TileLayer;
  /** Capa de calles (OSM) */
  public streetsLayer?: TileLayer;
  /** Capa para resaltar geometrías de búsqueda */
  private highlightLayer: VectorLayer<any> | undefined;
  /**
   * Configuración centralizada para las capas de ortofotos.
   * Esta será la única fuente de verdad para generar tanto los
   * controles en el panel de capas como las capas XYZ en el mapa.
   */
  private readonly ortofotoLayerConfigs = [
    // Generamos dinámicamente la configuración a partir de la lista de años importada.
    // Esto facilita la adición de nuevos años de ortofotos.
    ...ORTOFOTO_YEARS.map(year => ({ year, zIndex: 5 }))
  ] as const;
  /**
   * Signal que gestiona las secciones y capas del visor.
   */
  sections = signal<Section[]>(LAYER_PANEL_SECTIONS);
  /**
   * Vista del panel de capas filtrada por el estado de sesión: los items
   * marcados con `requiresAuth` (capas, subsecciones o secciones completas)
   * solo aparecen cuando el usuario está autenticado.
   * El estado interno (`sections`) conserva SIEMPRE todas las capas para no
   * alterar la lógica del mapa (olLayer, leyenda, clics, ortofotos, etc.).
   */
  readonly panelSections = computed<Section[]>(() => {
    const isAuthed = this.authService.isAuthenticated();
    return this.sections()
      .map(section => this.filterSectionForPanel(section, isAuthed))
      .filter((section): section is Section => section !== null);
  });
  /**
   * Al cerrar sesión apagamos en el mapa cualquier capa restringida que
   * hubiera quedado visible (el panel ya no la muestra, pero la capa OL existe).
   */
  private readonly hideRestrictedOnLogout = effect(() => {
    if (this.authService.isAuthenticated()) return;
    const hasVisibleRestricted = untracked(() => this.sections()).some(section =>
      section.items.some(item =>
        ('layers' in item && item.requiresAuth && item.layers.some(l => l.visible)) ||
        (item.type === 'layer' && item.requiresAuth && item.visible)
      )
    );
    if (!hasVisibleRestricted) return;
    this.sections.update(sections => sections.map(section => {
      const hideAll = section.requiresAuth;
      return {
        ...section,
        items: section.items.map(item => {
          if ('layers' in item) {
            const hideSub = hideAll || item.requiresAuth;
            const layers = item.layers.map(l => (hideSub || l.requiresAuth) ? { ...l, visible: false } : l);
            return { ...item, layers };
          }
          return (hideAll || item.requiresAuth) ? { ...item, visible: false } : item;
        }),
      };
    }));
  });
  /**
   * Sincroniza las ventanas de ficha de lote ya abiertas con el estado de
   * sesión: al autenticarse se recargan con la ficha interna (informacion.asp)
   * y al cerrar sesión vuelven a la pública (LotePublico.asp), de modo que una
   * ficha con datos restringidos nunca quede abierta tras el logout.
   */
  isReady = signal(false);
  /** Coordenadas actuales del usuario (longitud, latitud). */
  userCoords = signal<{ lon: number, lat: number } | null>(null);
  /** Herramientas del sidebar activas. */
  activeSidebarTools = signal<Set<string>>(new Set());
  /**
   * Visibilidad de la ventana flotante de la leyenda. Es INDEPENDIENTE de
   * `activeSidebarTools`: la navegación del sidebar gestiona una herramienta
   * de panel a la vez y nunca debe cerrar ni borrar la leyenda. Solo su
   * propio botón de cierre (X) o pulsar de nuevo "Leyenda" la ocultan.
   * Arranca apagada para no cubrir el mapa al cargar, pero el visor la abre
   * automáticamente en cuanto se enciende una capa con simbología y la vuelve
   * a ocultar cuando se apaga la última: ver `sincronizarLeyendaConCapas`.
   */
  leyendaVisible = signal(false);
  /**
   * `true` mientras la leyenda está abierta porque el visor la abrió solo.
   * Permite volver a cerrarla automáticamente cuando se apaga la última capa
   * con simbología, sin quitarle la ventana a quien la abrió a mano desde el
   * menú (en ese caso se respeta su decisión).
   */
  private leyendaAbiertaAutomaticamente = false;
  /** Alterna la ventana flotante de la leyenda (botón "Leyenda" del sidebar). */
  toggleLeyenda(): void {
    // Es una acción manual: la ventana deja de considerarse "abierta sola".
    this.leyendaAbiertaAutomaticamente = false;
    this.leyendaVisible.update(v => !v);
  }
  /** Cierra la ventana flotante de la leyenda (botón X de la propia ventana). */
  closeLeyenda(): void {
    this.leyendaAbiertaAutomaticamente = false;
    this.leyendaVisible.set(false);
  }
  /**
   * Sincroniza la ventana flotante de la leyenda con el panel de capas: aparece
   * sola cuando el usuario enciende una capa con simbología (para que no tenga
   * que buscar el botón "Leyenda" del menú) y se oculta cuando se apaga la
   * última, para no dejar un panel vacío sobre el mapa. Debe invocarse justo
   * después de aplicar el cambio de visibilidad sobre `sections`.
   * @param simbologiaAntes Capas con simbología visible antes del cambio.
   */
  private sincronizarLeyendaConCapas(simbologiaAntes: number): void {
    const simbologiaAhora = capasConSimbologiaVisible(this.panelSections()).length;
    switch (sincroniaLeyenda(simbologiaAntes, simbologiaAhora, this.leyendaAbiertaAutomaticamente)) {
      case 'abrir':
        this.leyendaVisible.set(true);
        this.leyendaAbiertaAutomaticamente = true;
        break;
      case 'cerrar':
        this.closeLeyenda();
        break;
    }
  }
  /** Ventanas flotantes con la información de lotes (varias abiertas, sin bloquear el mapa) */
  fotoDroneUrl2018 = signal<string | null>(null);
  /** URL con la información de la foto de dron 2024 para mostrar en un modal. */
  fotoDroneUrl2024 = signal<string | null>(null);
  /** URL con la información de un punto geodésico para mostrar en un modal. */
  ptoGeodesicoUrl = signal<string | null>(null);
  /** URL con la información de un arbol (2015) para mostrar en un modal. */
  arboladoUrbano2015Url = signal<string | null>(null);
  /** URL del PDF de levantamiento topográfico (TUSNE) para mostrar en un modal. */
  tusneUrl = signal<string | null>(null);
  /** URL con la información de un cruce de accesibilidad para mostrar en un modal. */
  cruceAccesibilidadUrl = signal<string | null>(null);
  /** URL con la información de una manzana de accesibilidad para mostrar en un modal. */
  cruceAccesibilidadManzanaUrl = signal<string | null>(null);
  /** URL con la información de una banca (2016) para mostrar en un modal. */
  bancas2016Url = signal<string | null>(null);
  /** URL con la información de un estacionamiento de bicicletas (2016) para mostrar en un modal. */
  estacBicis2016Url = signal<string | null>(null);
  /** URL del PDF de una ficha de área recreativa para mostrar en un modal. */
  areaVerdeUrl = signal<string | null>(null);
  /** URL con la información de un hidrante (2016) para mostrar en un modal. */
  hidrante2016Url = signal<string | null>(null);
  /** URL con la información de un juego de niños (2016) para mostrar en un modal. */
  juegoNinos2016Url = signal<string | null>(null);
  /** URL con la información de un minigimnasio (2016) para mostrar en un modal. */
  miniGimnasiosUrl = signal<string | null>(null);
  /** URL con la información de un monumento, busto o totem (2021) para mostrar en un modal. */
  monumentos2021Url = signal<string | null>(null);
  /** URL con la información de un monumento o escultura (2016) para mostrar en un modal. */
  esculturas2016Url = signal<string | null>(null);
  /** URL con la información de un panel publicitario (2018) para mostrar en un modal. */
  panelesPublicitarios2018Url = signal<string | null>(null);
  /** URL con la información de una papelera (2016) para mostrar en un modal. */
  papelera2016Url = signal<string | null>(null);
  /** URL con la información de un poste de iluminación ornamental para mostrar en un modal. */
  postesIluminacionUrl = signal<string | null>(null);
  /** URL con la fotografía de un componente de subsector vecinal (2025) para mostrar en un modal. */
  subsectorVecinalUrl = signal<string | null>(null);
  /** URL con la fotografía de un componente de señaletica (2026) para mostrar en un modal. */
  senaleticaUrl = signal<string | null>(null);
  /** Controla la visibilidad del modal global de Términos y Condiciones */
  showTermsModal = signal(false);
  /** Términos aceptados por el usuario durante esta sesión (no vuelve a mostrarse automáticamente) */
  termsAccepted = signal(false);
  /**
   * Bandera interna: el aviso de términos se dispara una vez por cada "entrada"
   * al distrito (zoom >= TERMS_ZOOM_DISTRICTO con vista sobre SAN_ISIDRO_EXTENT).
   * Se rearma al salir del área o bajar del zoom mínimo.
   */
  private termsTriggerArmed = true;
  /** Indica si el mapa está en medio de una animación de navegación programática. */
  
  isNavigating = signal(false);
  /** Overlay para el marcador de búsqueda */
  private searchMarkerOverlay: Overlay | undefined;
  /** Elemento HTML para el marcador de búsqueda, registrado por un componente. */
  private searchMarkerElement: HTMLElement | undefined;
  /**
   * Permite que un componente registre el elemento HTML que se usará para el marcador de búsqueda.
   * @param element El elemento del marcador.
   */

  cambiarMapaBase(tipoMapaBase: TipoMapaBase): void {
    this.baseLayerType.set(tipoMapaBase);
    if (!this.satelliteLayer || !this.streetsLayer) {
      return;
    }
    switch (tipoMapaBase) {
      case 'satellite':
        this.satelliteLayer.setVisible(true);
        this.streetsLayer.setVisible(false);
        break;
      case 'streets':
        this.satelliteLayer.setVisible(false);
        this.streetsLayer.setVisible(true);
        break;
      case 'topo':
      case 'blanco':
        this.satelliteLayer.setVisible(false);
        this.streetsLayer.setVisible(false);
        break;
    }
  }
  registerSearchMarkerElement(element: HTMLElement) {
    this.searchMarkerElement = element;
    if (this.searchMarkerOverlay) {
      this.searchMarkerOverlay.setElement(this.searchMarkerElement);
    }
  }
  constructor() {
    this.setupLayerSyncEffect();
  }
  /**
   * Inicializa el mapa OpenLayers.
   */
  initMap(target: HTMLElement): OlMap {
    this.isReady.set(false);
    // Si el mapa ya existe, reasignamos el target
    if (this._map()) {
      const existingMap = this._map()!;
      this.handleInitialRender(existingMap);
      existingMap.setTarget(target);
      return existingMap;
    }
    this.setupBaseLayers();

    const olMap = new OlMap({
      target,
      layers: [this.streetsLayer!, this.satelliteLayer!],
      controls: defaultControls().extend([
        // Barra de escala según la documentación oficial de OpenLayers,
        // sin target personalizado (posición por defecto: esquina inferior izquierda)
        new ScaleLine({
          units: 'metric',
          bar: true,
          steps: 4,
          text: true,
          minWidth: 100,
        }),
      ]),
      view: new View({
        center: fromLonLat(INITIAL_CENTER),
        zoom: INITIAL_ZOOM,
        minZoom: 4,
        maxZoom: MAP_MAX_ZOOM,
      }),
       interactions: defaultInteractions({ doubleClickZoom: false }),

    });
    this._map.set(olMap);
    olMap.getViewport().style.cursor = 'pointer';
    this.setupOrtofotoLayers();
    this.setupPeruLimitsLayer();
    this.setupViviendasRuralesLayers();
    this.handleMapResizing(olMap);
    this.setupHighlightLayer();
    this.handleInitialRender(olMap);
    // Detección de zoom sobre el distrito para mostrar Términos y Condiciones
    this.setupTermsOnZoom(olMap);
    return olMap;
  }
  /**
   * Sincroniza la visibilidad y opacidad de las capas de OL con el Signal de secciones.
   */
  private setupLayerSyncEffect(): void {
    effect(() => {
      this.sections().forEach(section => {
        section.items.forEach((item: any) => {
          if ('layers' in item) { // Es una SubSection
            this.processSubSectionLayers(item.layers);
          } else { // Es un LayerItem
            this.processSingleLayerItem(item);
          }
        });
      });
    });
  }
  /**
   * Procesa un LayerItem individual para sincronizar su visibilidad y opacidad con OpenLayers.
   * @param layerItem El LayerItem a procesar.
   */
  private processSingleLayerItem(layerItem: LayerItem): void {
    if (layerItem.olLayer) {
      layerItem.olLayer.setVisible(layerItem.visible);
      layerItem.olLayer.setOpacity(layerItem.opacity);
    }
  }
  /**
   * Procesa una lista de LayerItems (típicamente de una SubSection) para sincronizar
   * su visibilidad y opacidad con OpenLayers.
   * @param layerItems La lista de LayerItems a procesar.
   */
  private processSubSectionLayers(layerItems: LayerItem[]): void {
    layerItems.forEach(layerItem => {
      if (layerItem.olLayer) {
        layerItem.olLayer.setVisible(layerItem.visible);
        layerItem.olLayer.setOpacity(layerItem.opacity);
      }
    });
  }
  /**
   * Función de carga de tiles validada: descarga el tile con `fetch`, verifica
   * que la respuesta sea realmente una imagen decodificable y solo entonces la
   * asigna al `<img>` del tile. Si el servidor responde con un error HTTP, HTML
   * o un cuerpo corrupto, el tile se marca en estado ERROR de forma controlada.
   * Esto evita el rechazo no manejado "EncodingError: The source image cannot
   * be decoded" que el navegador registraba al cargar el visor.
   */
  private readonly tileLoadFunction = (tile: OlTile, src: string): void => {
    const imageTile = tile as ImageTile;
    const img = imageTile.getImage() as HTMLImageElement;
    fetch(src, { mode: 'cors' })
      .then(async (respuesta) => {
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const blob = await respuesta.blob();
        // Si el servidor declara un tipo que no es imagen, fallamos de una vez.
        if (blob.type && !blob.type.startsWith('image/')) {
          throw new Error(`Tipo de respuesta no soportado: ${blob.type}`);
        }
        // Validación definitiva: intentamos decodificar nosotros (capturando
        // cualquier EncodingError dentro de nuestra promesa, no en la de OL).
        await createImageBitmap(blob);
        const url = URL.createObjectURL(blob);
        img.onload = () => URL.revokeObjectURL(url);
        img.src = url;
      })
      .catch(() => {
        // Cancelamos cualquier decodificación pendiente y marcamos el tile
        // como error: OL mostrará un hueco y lo reintentará si hace falta.
        // IMPORTANTE: usamos removeAttribute y NO `src = ''`, porque asignar
        // una cadena vacía dispara el evento `error` del <img> y OL lo registra
        // como "Error: Image load error" en consola.
        img.removeAttribute('src');
        // ImageTile admite setState para marcar el fallo de carga.
        if (typeof (imageTile as { setState?: (s: number) => void }).setState === 'function') {
          imageTile.setState(TileState.ERROR);
        }
      });
  };
  /**
   * Configura Google Satélite y ArcGIS World Topo Map.
   */
  private setupBaseLayers(): void {
    const satelliteSource = new XYZ({
      url: GOOGLE_SATELLITE_URL,
      crossOrigin: 'anonymous',
      transition: 1000,
      interpolate: true, // Evita que se vean cuadrados pixelados al hacer zoom
      maxZoom: 19,
      wrapX: true,
      tileLoadFunction: this.tileLoadFunction
    });
    const streetsSource = this.arcgisRestService.createTileSource(ARCGIS_WORLD_TOPO_TILES_URL, {
      maxZoom: 19,
      tileLoadFunction: this.tileLoadFunction,
      tileUrlFunction: tileCoord => {
        if (!tileCoord) {
          return undefined;
        }
        const [z, x, y] = tileCoord;
        if (z <= 19) {
          return ARCGIS_WORLD_TOPO_TILES_URL
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y));
        }
        const delta = z - 19;
        const fallbackX = Math.floor(x / Math.pow(2, delta));
        const fallbackY = Math.floor(y / Math.pow(2, delta));
        return ARCGIS_WORLD_TOPO_TILES_URL
          .replace('{z}', '19')
          .replace('{x}', String(fallbackX))
          .replace('{y}', String(fallbackY));
      },
    });
    this.satelliteLayer = this.createBaseLayer(satelliteSource, 'Satélite', 'satellite');
    this.streetsLayer = this.createBaseLayer(streetsSource, 'Calles', 'streets');
  }
  /** Configura la carga inicial de ortofotos. */
  private setupOrtofotoLayers(): void {
    this.ortofotoLayerConfigs.forEach(config => {
      this.addXyzLayer({
        id: `ortofoto_${config.year}`,
        url: `${environment.ortofotoServerUrl}/${config.year}/{z}/{x}/{y}.png`,
        maxZoom: 22,
        zIndex: config.zIndex
      });
    });
  }
  /** Agrega el MapServer REST de límites nacionales al panel de capas. */
  private setupPeruLimitsLayer(): void {
    const map = this._map();
    if (!map) return;

    const layer = this.arcgisRestService.createMapServerLayer(PERU_LIMITS_MAPSERVER_URL, {
      title: 'Límites del Perú',
      zIndex: 24,
    });
    layer.set('id', 'limites-peru');
    map.addLayer(layer);
    this.updateLayerInSectionsSignal('limites-peru', layer);

    this.arcgisRestService.getMapServerLegend(PERU_LIMITS_MAPSERVER_URL).subscribe({
      next: response => {
        const legendEntries = (response.layers ?? []).flatMap(serviceLayer =>
          (serviceLayer.legend ?? [])
            .filter(entry => Boolean(entry.imageData && entry.contentType?.startsWith('image/')))
            .map(entry => ({
              label: entry.label?.trim() || serviceLayer.layerName,
              url: `data:${entry.contentType};base64,${entry.imageData}`,
            }))
        );
        if (legendEntries.length === 0) {
          console.warn('El MapServer de límites del Perú no publicó simbología para la leyenda.');
          return;
        }
        this.updateLayerProperties('limites-peru', { legendEntries });
      },
      error: error => console.error('No se pudo cargar la leyenda del MapServer de límites del Perú.', error),
    });
  }
  /** Agrega las capas de viviendas rurales, consultando solo el área visible. */
  private setupViviendasRuralesLayers(): void {
    const map = this._map();
    if (!map) return;

    const layers = VIVIENDAS_RURALES_LAYER_CONFIGS.map(config => ({
      layerId: config.itemId,
      layer: this.arcgisRestService.createViviendasRuralesLayer(config.arcgisLayerId, {
        title: config.title,
        color: config.color,
        zIndex: config.zIndex,
      }),
    }));
    layers.forEach(({ layerId, layer }) => {
      layer.set('id', layerId);
      map.addLayer(layer);
      this.updateLayerInSectionsSignal(layerId, layer);
    });

    // El loader cambia su consulta en este umbral; al desplazar, la estrategia bbox carga solo extensiones nuevas.
    const coarseScale = (resolution: number) => resolution >= VIVIENDAS_RURALES_COARSE_RESOLUTION;
    let previousCoarseScale = coarseScale(map.getView().getResolution() ?? Infinity);
    map.on('moveend', () => {
      const currentResolution = map.getView().getResolution();
      if (currentResolution === undefined) return;

      const currentCoarseScale = coarseScale(currentResolution);
      if (currentCoarseScale === previousCoarseScale) return;

      previousCoarseScale = currentCoarseScale;
      layers.forEach(({ layer }) => layer.getSource()?.refresh());
    });

  }
  /**
   * Asegura que el mapa se actualice fuera de la zona de Angular para rendimiento.
   */
  private handleMapResizing(olMap: OlMap): void {
    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        olMap.updateSize();
      });
    });
  }
  /** Marca el mapa disponible después de dibujar el primer frame, sin esperar a todas las capas. */
  private handleInitialRender(olMap: OlMap): void {
    olMap.once('postrender', () => this.isReady.set(true));
  }
  /**
   * Método auxiliar para estandarizar la creación de capas base.
   * @private
   */
  private createBaseLayer(source: XYZ, title: string, type: 'streets' | 'satellite'): TileLayer {
    return new TileLayer({
      source,
      properties: { title },
      preload: 0, // 0 es el valor por defecto y el más eficiente para el arranque
      visible: this.baseLayerType() === type
    });
  }
  /**
   * Método para agregar capas XYZ al mapa.
   * @private
   */
  private addXyzLayer(options: { id: string, url: string, maxZoom?: number, zIndex?: number }): void {
    const map = this._map();
    if (!map) return;
    const xyzSource = new XYZ({
      url: options.url,
      crossOrigin: 'anonymous',
      maxZoom: options.maxZoom,
      interpolate: true,
      tileLoadFunction: this.tileLoadFunction
    });
    const layer = new TileLayer({
      source: xyzSource,
      properties: { id: options.id },
      zIndex: options.zIndex,
      visible: false // Por defecto no visible
    });
    map.addLayer(layer);
    this.updateLayerInSectionsSignal(options.id, layer);
  }
  /**
   * Actualiza el `signal` `sections` para asociar una capa de OpenLayers (olLayer)
   * a un `LayerItem` específico dentro de la estructura.
   * @param layerId El ID del `LayerItem` a actualizar.
   * @param olLayer La instancia de capa de OpenLayers a asociar.
   */
  private updateLayerInSectionsSignal(layerId: string, olLayer: BaseLayer): void {
    this.sections.update(sections => sections.map(section => this.processSectionForLayerUpdate(section, layerId, olLayer)));
  }
  /**
   * Procesa una sección para actualizar la `olLayer` de una capa específica.
   * @param section La sección a procesar.
   * @param layerId El ID de la capa a actualizar.
   * @param olLayer La instancia de la capa de OpenLayers.
   * @returns La sección actualizada.
   */
  private processSectionForLayerUpdate(section: Section, layerId: string, olLayer: BaseLayer): Section {
    const updatedItems = section.items.map(item => {
      // Subsecciones: asociamos la instancia dentro de su array de capas.
      if ('layers' in item) {
        const updatedLayers = this.updateLayersInSubSection(item.layers, layerId, olLayer);
        return { ...item, layers: updatedLayers };
      }
      // Capas directas de la sección (sin subsección): también deben poder
      // recibir su instancia de capa XYZ (p. ej. las ortofotos de 'imaAereas').
      if (item.type === 'layer' && item.id === layerId) {
        return { ...item, olLayer };
      }
      return item;
    });
    return { ...section, items: updatedItems };
  }
  /**
   * Actualiza la `olLayer` en un array de capas si encuentra una coincidencia de ID.
   * @param layers El array de `LayerItem` a procesar.
   * @param layerId El ID de la capa a actualizar.
   * @param olLayer La instancia de la capa de OpenLayers.
   * @returns El array de capas actualizado.
   */
  private updateLayersInSubSection(layers: LayerItem[], layerId: string, olLayer: BaseLayer): LayerItem[] {
    return layers.map(l => (l.id === layerId ? { ...l, olLayer } : l));
  }
  /**
   * Configura los handlers de clic del mapa: un clic simple para consultar
   * información de las capas y seleccionar lotes para impresión, y un doble
   * clic para abrir la ficha del lote catastral.
   * @param olMap Instancia del mapa de OpenLayers.
   */
  clearFotoDroneUrl2018(): void {
    this.fotoDroneUrl2018.set(null);
  }
  /**
   * Limpia la URL de la foto de dron de 2024, para cerrar el modal.
   */
  clearFotoDroneUrl2024(): void {
    this.fotoDroneUrl2024.set(null);
  }
  /**
   * Limpia la URL del punto geodésico, para cerrar el modal.
   */
  clearPtoGeodesicoUrl(): void {
    this.ptoGeodesicoUrl.set(null);
  }
  /**
   * Limpia la URL del arbolado urbano 2015, para cerrar el modal.
   */
  clearArboladoUrbano2015Url(): void {
    this.arboladoUrbano2015Url.set(null);
  }
  /**
   * Limpia la URL del levantamiento topográfico (TUSNE), para cerrar el modal.
   */
  clearTusneUrl(): void {
    this.tusneUrl.set(null);
  }
  /**
   * Limpia la URL del cruce de accesibilidad, para cerrar el modal.
   */
  clearCruceAccesibilidadUrl(): void {
    this.cruceAccesibilidadUrl.set(null);
  }
  /**
   * Limpia la URL de la manzana de accesibilidad, para cerrar el modal.
   */
  clearCruceAccesibilidadManzanaUrl(): void {
    this.cruceAccesibilidadManzanaUrl.set(null);
  }
  /**
   * Limpia la URL de la banca (2016), para cerrar el modal.
   */
  clearBancas2016Url(): void {
    this.bancas2016Url.set(null);
  }
  /**
   * Limpia la URL del estacionamiento de bicicletas (2016), para cerrar el modal.
   */
  clearEstacBicis2016Url(): void {
    this.estacBicis2016Url.set(null);
  }
  /**
   * Limpia la URL de la ficha del área recreativa, para cerrar el modal.
   */
  clearAreaVerdeUrl(): void {
    this.areaVerdeUrl.set(null);
  }
  /**
   * Limpia la URL del hidrante (2016), para cerrar el modal.
   */
  clearHidrante2016Url(): void {
    this.hidrante2016Url.set(null);
  }
  /**
   * Limpia la URL del juego de niños (2016), para cerrar el modal.
   */
  clearJuegoNinos2016Url(): void {
    this.juegoNinos2016Url.set(null);
  }
  /**
   * Limpia la URL del minigimnasio (2016), para cerrar el modal.
   */
  clearMiniGimnasiosUrl(): void {
    this.miniGimnasiosUrl.set(null);
  }
  /**
   * Limpia la URL del monumento, busto o totem (2021), para cerrar el modal.
   */
  clearMonumentos2021Url(): void {
    this.monumentos2021Url.set(null);
  }
  /**
   * Limpia la URL del monumento o escultura (2016), para cerrar el modal.
   */
  clearEsculturas2016Url(): void {
    this.esculturas2016Url.set(null);
  }
  /**
   * Limpia la URL del panel publicitario (2018), para cerrar el modal.
   */
  clearPanelesPublicitarios2018Url(): void {
    this.panelesPublicitarios2018Url.set(null);
  }
  /**
   * Limpia la URL de la papelera (2016), para cerrar el modal.
   */
  clearPapelera2016Url(): void {
    this.papelera2016Url.set(null);
  }
  /**
   * Limpia la URL del poste de iluminación ornamental, para cerrar el modal.
   */
  clearPostesIluminacionUrl(): void {
    this.postesIluminacionUrl.set(null);
  }
  /**
   * Limpia la URL de la fotografía del subsector vecinal (2025), para cerrar el modal.
   */
  clearSubsectorVecinalUrl(): void {
    this.subsectorVecinalUrl.set(null);
    this.subsectorVecinalImgLoaded.set(false);
    this.subsectorVecinalImgError.set(false);
  }
  /** Señal que indica si la fotografía del subsector vecinal (2025) se cargó correctamente. */
  subsectorVecinalImgLoaded = signal<boolean>(false);
  /** Señal que indica si la fotografía del subsector vecinal (2025) no pudo cargarse. */
  subsectorVecinalImgError = signal<boolean>(false);
  /**
   * Marca el fin de la carga de la fotografía del subsector vecinal (2025).
   * @param error `true` si la imagen falló al cargar; `false` si cargó bien.
   */
  setSubsectorVecinalImgError(error: boolean): void {
    this.subsectorVecinalImgError.set(error);
    if (error) {
      this.subsectorVecinalImgLoaded.set(false);
    }
  }
  /**
   * Limpia la URL de la fotografía de la señaletica (2026), para cerrar el modal.
   */
  clearSenaleticaUrl(): void {
    this.senaleticaUrl.set(null);
    this.senaleticaImgLoaded.set(false);
    this.senaleticaImgError.set(false);
  }
  /**
   * Cierra el modal de la lámina de sección vial normativa metropolitana
   * (ORD. N° 2343-MML).
   */
  /** Señal que indica si la fotografía de la señaletica (2026) se cargó correctamente. */
  senaleticaImgLoaded = signal<boolean>(false);
  /** Señal que indica si la fotografía de la señaletica (2026) no pudo cargarse. */
  senaleticaImgError = signal<boolean>(false);
  /**
   * Marca el fin de la carga de la fotografía de la señaletica (2026).
   * @param error `true` si la imagen falló al cargar; `false` si cargó bien.
   */
  setSenaleticaImgError(error: boolean): void {
    this.senaleticaImgError.set(error);
    if (error) {
      this.senaleticaImgLoaded.set(false);
    }
  }
  /**
   * Dibuja un marcador en el mapa en la ubicación de la geometría proporcionada.
   * @param geometry La geometría donde se centrará el marcador.
   * @param text Texto opcional para mostrar en el marcador.
   */
  drawSearchMarker(geometry: GeoJSONGeometry, text?: string): void {
    const map = this._map();
    if (!map || !geometry) return;
    const view = map.getView();
    const format = new GeoJSON();
    // Le indicamos a OL que la data viene en 32718 y la transforme a la proyección del mapa
    const olGeometry = format.readGeometry(geometry, {
      dataProjection: 'EPSG:32718',
      featureProjection: view.getProjection()
    });
    if (!olGeometry) return;
    this.colocarMarcadorBusqueda(getCenter(olGeometry.getExtent()), text);
  }
  /**
   * Coloca el marcador de búsqueda (pin) en el centro del área encontrada a
   * partir de la extensión unida de TODAS las geometrías que la componen (por
   * ejemplo los polígonos de un parque). Replica el comportamiento de la
   * búsqueda de lotes, donde el pin queda en el centro del predio encontrado.
   * @param geometrias Geometrías GeoJSON (EPSG:32718) que componen el área.
   * @param text Texto opcional para mostrar en el marcador.
   */
  drawSearchMarkerForParque(geometrias: GeoJSONGeometry[], text?: string): void {
    const map = this._map();
    // Solo consideramos geometrías válidas: con 'coordinates' (simples) o
    // 'geometries' (colecciones).
    const validas = (geometrias ?? []).filter(g => !!g && (!!g.coordinates || !!g.geometries));
    if (!map || validas.length === 0) return;
    const view = map.getView();
    const format = new GeoJSON();
    let extent: number[] | undefined;
    for (const geometria of validas) {
      const geometryOl = format.readGeometry(geometria, {
        dataProjection: 'EPSG:32718',
        featureProjection: view.getProjection()
      });
      if (!geometryOl) continue;
      // Unimos la extensión de cada polígono para centrar el pin en el área
      // completa del parque, no en uno solo de sus polígonos.
      extent = extent ? extend(extent, geometryOl.getExtent()) : geometryOl.getExtent();
    }
    if (!extent || isEmpty(extent)) return;
    this.colocarMarcadorBusqueda(getCenter(extent), text);
  }
  /**
   * Ubica el pin del marcador de búsqueda en la coordenada indicada, creando
   * el overlay la primera vez. Centraliza la lógica compartida por la búsqueda
   * de lotes (una geometría) y la de parques (varias geometrías).
   * @param center Coordenada (proyección de la vista) donde ubicar el pin.
   * @param text Texto opcional del marcador.
   */
  private colocarMarcadorBusqueda(center: Coordinate, text?: string): void {
    const map = this._map();
    if (!map || !this.searchMarkerElement) {
      console.warn('El marcador de búsqueda no se puede dibujar porque el elemento no ha sido registrado en MapService.');
      return;
    }
    if (!this.searchMarkerOverlay) {
      this.searchMarkerOverlay = new Overlay({
        element: this.searchMarkerElement,
        positioning: 'center-center',
        stopEvent: false,
      });
      map.addOverlay(this.searchMarkerOverlay);
    }
    // Actualizamos el texto si se proporciona
    const textElement = this.searchMarkerElement.querySelector('.search-marker-text');
    if (textElement) {
      textElement.innerHTML = text ?? '';
      // Hacemos visible el contenedor del texto si hay texto
      (textElement as HTMLElement).style.display = text ? 'block' : 'none';
    }
    this.searchMarkerElement.style.display = 'block';
    this.searchMarkerOverlay.setPosition(center);
    this.searchMarkerElement.style.transform = 'scale(2)'; // Duplicamos el tamaño del marcador
  }
  /** Limpia el marcador de búsqueda del mapa. */
  clearSearchMarker(): void {
    this.searchMarkerOverlay?.setPosition(undefined);
    this.highlightLayer?.getSource()?.clear();
  }
  /** Limpia solo la capa de resaltado de geometrías. */
  clearHighlightLayer(): void {
    this.highlightLayer?.getSource()?.clear();
  }
  /**
   * Remueve una capa del mapa definitivamente basándose en su ID.
   */
  removeLayerById(id: string): void {
    const currentMap = this._map();
    if (!currentMap) return;
    const layerToRemove = currentMap.getLayers().getArray()
      .find(layer => layer.get('id') === id);
    if (layerToRemove) currentMap.removeLayer(layerToRemove);
  }
  /**
   * Centra y acerca el mapa al área geográfica configurada con un vuelo animado.
   */
  goToCoordinates(lat: number, lon: number, zoom = SAN_ISIDRO_ZOOM, duration = 2200, onComplete?: (complete: boolean) => void): void {
    const map = this._map();
    if (!map) return;

    this.isNavigating.set(true);

    const view = map.getView();
    const currentCenter = view.getCenter()!;
    const destination = fromLonLat([lon, lat]);

    // Calculamos la distancia para decidir si hacer un "zoom out" drástico o no.
    // Una distancia mayor a 500km (500000m) justifica el zoom out.
    const distance = getDistance(currentCenter, destination);

    const completeCallback = (complete: boolean) => {
      this.zone.run(() => { // Ensure signal update runs inside Angular zone
        this.isNavigating.set(false);
        if (complete && onComplete) {
          onComplete(complete);
        }
      });
    };

    if (distance > 500000) { // Si estamos lejos, hacemos un zoom out primero
      const peruCenter = fromLonLat([-75, -10]); // Centro aproximado de Perú
      const zoomOutDuration = duration * 0.4; // 40% de la duración total para el zoom out
      const zoomInDuration = duration * 0.6;  // 60% de la duración total para el zoom in

      // Primera animación: zoom out a una vista más amplia centrada en Perú
      view.animate({
        center: peruCenter,
        zoom: 4, // Zoom a nivel continental para mostrar Perú
        duration: zoomOutDuration,
        easing: easeOut
      }, () => {
        // Segunda animación: zoom a la ubicación de destino
        view.animate({
          center: destination,
          zoom,
          duration: zoomInDuration,
          easing: easeOut
        }, completeCallback);
      });
    } else { // Si estamos cerca, solo nos movemos
      view.animate({ center: destination, zoom, duration, easing: easeOut }, completeCallback);
    }
  }
  /**
   * Desplaza un punto (lon, lat) en metros en coordenadas proyectadas (EPSG:3857)
   * dx: desplazamiento en metros hacia el este (+), dy: hacia el norte (+)
   *
   * OJO: devuelve [lon, lat] en grados (EPSG:4326). NO sirve para
   * `Overlay.setPosition`, que exige la proyección de la vista; para eso usar
   * `fromLonLat([lon, lat], map.getView().getProjection())`.
   */
  offsetLonLat(lon: number, lat: number, dx = 0, dy = 0): [number, number] {
    // Transformar a EPSG:3857, aplicar desplazamiento en metros y volver a EPSG:4326
    const p3857 = transform([lon, lat], 'EPSG:4326', 'EPSG:3857') as [number, number];
    const shifted: [number, number] = [p3857[0] + dx, p3857[1] + dy];
    const res = transform(shifted, 'EPSG:3857', 'EPSG:4326') as [number, number];
    return res;
  }
  /**
   * Centra y acerca el mapa al área geográfica configurada usando la constante
   * `SAN_ISIDRO_CENTER`. Esta función mantiene compatibilidad con llamadas
   * previas que no pasan explícitamente lat/lon.
   */
  goToSanIsidro(duration = 1800, onComplete?: (complete: boolean) => void): void {
    // Usamos goToCoordinates para una animación de "vuelo" más suave.
    this.goToCoordinates(SAN_ISIDRO_CENTER[1], SAN_ISIDRO_CENTER[0], SAN_ISIDRO_ZOOM, duration, onComplete);
  }
  /** Restaura la vista inicial de Perú al pulsar el botón "Mapa Completo". */
  goToInitialView(duration = ANIMATION_DURATION / 2): void {
    const map = this._map();
    if (!map) return;
    const view = map.getView();
    view.animate({
      center: fromLonLat(INITIAL_CENTER, view.getProjection()),
      zoom: INITIAL_ZOOM,
      duration,
      easing: easeOut,
    });
  }
  /**
   * Muestra el modal global de Términos y Condiciones.
   */
  openTermsModal(): void {
    this.showTermsModal.set(true);
  }
  /**
   * Cierra el modal de Términos y Condiciones sin registrar aceptación.
   */
  closeTermsModal(): void {
    this.showTermsModal.set(false);
  }
  /**
   * Registra la aceptación de los términos y cierra el modal.
   * Durante la sesión activa no volverá a mostrarse automáticamente.
   */
  acceptTerms(): void {
    this.termsAccepted.set(true);
    this.showTermsModal.set(false);
  }
  /**
   * Escucha el evento 'moveend' del mapa y muestra el modal de Términos y
   * Condiciones cuando el usuario hace zoom sobre el área geográfica configurada:
   * zoom >= TERMS_ZOOM_DISTRICTO y la vista intersecta SAN_ISIDRO_EXTENT.
   * El aviso se dispara una vez por cada entrada al área (se rearma al salir).
   * @param olMap Instancia del mapa de OpenLayers.
   */
  private setupTermsOnZoom(olMap: OlMap): void {
    olMap.on('moveend', () => {
      if (this.termsAccepted()) {
        return;
      }
      const view = olMap.getView();
      const zoom = view.getZoom();
      const size = olMap.getSize();
      let sobreDistrito = false;
      if (zoom !== undefined && size && zoom >= TERMS_ZOOM_DISTRICTO) {
        // Extensión visible transformada al sistema UTM oficial del distrito (EPSG:32718)
        const extentUTM = transformExtent(view.calculateExtent(size), view.getProjection(), 'EPSG:32718');
        // Intersección de bounding boxes ([oeste, sur, este, norte])
        sobreDistrito =
          extentUTM[0] <= SAN_ISIDRO_EXTENT[2] &&
          extentUTM[2] >= SAN_ISIDRO_EXTENT[0] &&
          extentUTM[1] <= SAN_ISIDRO_EXTENT[3] &&
          extentUTM[3] >= SAN_ISIDRO_EXTENT[1];
      }
      if (!sobreDistrito) {
        // Al alejarse o salir del área se rearma para el próximo ingreso
        this.termsTriggerArmed = true;
        return;
      }
      if (this.termsTriggerArmed) {
        this.termsTriggerArmed = false;
        // Los callbacks de OpenLayers corren fuera de Angular: restauramos la zona
        this.zone.run(() => this.showTermsModal.set(true));
      }
    });
  }
  /**
   * Métodos para actualizar el estado de las secciones desde la UI
   */
  toggleSectionExpanded(sectionId: string): void {
    this.sections.update(s => s.map(sec =>
      sec.id === sectionId ? { ...sec, expanded: !sec.expanded } : sec
    ));
  }
  /**
   * Alterna la visibilidad de una capa. Para las ortofotos, se comporta como
   * un grupo de radio-buttons, asegurando que solo una esté visible a la vez.
   * @param sectionId ID de la sección principal (ej: 'imaAereas').
   * @param layerId ID de la capa a cambiar (ej: 'ortofoto_2024').
   */
  toggleLayerVisibility(sectionId: string, layerId: string) {
    // Se guarda cuántas simbologías había activas para saber si esta acción
    // acaba de encender leyenda y mostrar la ventana automáticamente.
    const simbologiaAntes = capasConSimbologiaVisible(this.panelSections()).length;
    // Lógica especial para ortofotos: solo una puede estar activa a la vez.
    if (layerId.startsWith('ortofoto_')) {
      this.sections.update(currentSections => {
        // Localizamos la capa clicada esté donde esté (capa directa o dentro de una subsección).
        const clicked = currentSections
          .flatMap(sec => sec.items)
          .flatMap(item => ('layers' in item ? item.layers : item.type === 'layer' ? [item] : []))
          .find(l => l.id === layerId);
        // Si ya estaba visible, se apaga (comportamiento de radio-button).
        const isTurningOn = !clicked?.visible;
        if (clicked && clicked.visible !== isTurningOn) {
          this.registrarCambioVisibilidad(clicked, isTurningOn);
        }

        // Apaga todas las ortofotos y deja encendida únicamente la clicada.
        const radioUpdate = (l: LayerItem): LayerItem =>
          l.id.startsWith('ortofoto_') ? { ...l, visible: l.id === layerId ? isTurningOn : false } : l;

        return currentSections.map(sec => ({
          ...sec,
          items: sec.items.map(item => {
            if ('layers' in item) {
              // Subsección que contiene ortofotos: aplicamos el radio a sus capas.
              if (!item.layers.some(l => l.id.startsWith('ortofoto_'))) return item;
              return { ...item, layers: item.layers.map(radioUpdate) };
            }
            // Capa directa de la sección.
            return item.type === 'layer' && item.id.startsWith('ortofoto_') ? radioUpdate(item) : item;
          }),
        }));
      });
    } else {
      // Lógica original para el resto de las capas.
      const clicked = this.findLayerItem(sectionId, layerId);
      if (clicked) this.registrarCambioVisibilidad(clicked, !clicked.visible);
      this.updateLayerProperties(layerId, (layer) => ({ visible: !layer.visible }));
    }
    // La leyenda aparece sola al encender una capa con simbología (y se oculta
    // al apagar la última): ver `sincronizarLeyendaConCapas`.
    this.sincronizarLeyendaConCapas(simbologiaAntes);
  }
  setLayerVisibility(sectionId: string, layerId: string, visible: boolean) {
    const simbologiaAntes = capasConSimbologiaVisible(this.panelSections()).length;
    const layer = this.findLayerItem(sectionId, layerId);
    if (layer && layer.visible !== visible) {
      this.registrarCambioVisibilidad(layer, visible);
    }
    this.updateLayerProperties(layerId, { visible });
    this.sincronizarLeyendaConCapas(simbologiaAntes);
  }
  setLayerOpacity(sectionId: string, layerId: string, opacity: number) {
    this.updateLayerProperties(layerId, { opacity });
  }
  /**
   * Actualiza las propiedades de una capa específica por su ID.
   * @param layerId El ID de la capa a actualizar.
   * @param newProps Un objeto con las nuevas propiedades o una función que devuelve las nuevas propiedades.
   */
  private updateLayerProperties(layerId: string, newProps: Partial<LayerItem> | ((layer: LayerItem) => Partial<LayerItem>)): void {
    this.sections.update(sections => sections.map(section => this.updateSectionItems(section, layerId, newProps)));
  }
  private findLayerItem(sectionId: string, layerId: string): LayerItem | undefined {
    const section = this.sections().find(item => item.id === sectionId);
    return section?.items
      .flatMap(item => item.type === 'subsection' ? item.layers : [item])
      .find(layer => layer.id === layerId);
  }
  private registrarCambioVisibilidad(layer: LayerItem, visible: boolean): void {
    this.auditoria.accion(
      AUDITORIA_OPCIONES.CAPA_VISIBILIDAD,
      `Capa "${layer.label ?? layer.id}" ${visible ? 'activada' : 'desactivada'}`
    );
  }
  /**
   * Itera sobre los items de una sección para actualizar una capa.
   */
  private updateSectionItems(section: Section, layerId: string, newProps: Partial<LayerItem> | ((layer: LayerItem) => Partial<LayerItem>)): Section {
    return {
      ...section,
      items: section.items.map(item => this.updateItem(item, layerId, newProps))
    };
  }
  /**
   * Procesa un item (LayerItem o SubSection) para actualizar una capa.
   */
  private updateItem(item: LayerItem | any, layerId: string, newProps: Partial<LayerItem> | ((layer: LayerItem) => Partial<LayerItem>)): LayerItem | any {
    if ('layers' in item) { // Es una SubSection
      return {
        ...item,
        layers: item.layers.map((l: LayerItem) => this.applyLayerUpdate(l, layerId, newProps))
      };
    } else if (item.type === 'layer') { // Es un LayerItem
      return this.applyLayerUpdate(item, layerId, newProps);
    }
    return item;
  }
  /**
   * Aplica la actualización a una capa si su ID coincide.
   */
  private applyLayerUpdate(layer: LayerItem, layerId: string, newProps: Partial<LayerItem> | ((layer: LayerItem) => Partial<LayerItem>)): LayerItem {
    if (layer.id !== layerId) {
      return layer;
    }
    // Las capas bloqueadas (en desarrollo) no pueden modificarse desde la UI.
    if (layer.disabled) {
      return layer;
    }
    const propsToApply = typeof newProps === 'function' ? newProps(layer) : newProps;
    return { ...layer, ...propsToApply };
  }
  /**
   * Enciende/apaga todas las capas de una sección. Respeta la restricción
   * `requiresAuth`: en modo público esas capas permanecen apagadas.
   */
  toggleAllLayersInSection(sectionId: string, visible: boolean) {
    const simbologiaAntes = capasConSimbologiaVisible(this.panelSections()).length;
    const isAuthed = this.authService.isAuthenticated();
    this.sections.update(s => s.map(sec => {
      if (sec.id !== sectionId) return sec;
      const sectionAllowed = !sec.requiresAuth || isAuthed;
      return {
        ...sec,
        items: sec.items.map(item => {
          if ('layers' in item) {
            // Subsección restringida sin sesión: no se toca.
            if (!sectionAllowed || (item.requiresAuth && !isAuthed)) return item;
            return {
              ...item,
              layers: item.layers.map(l => ({ ...l, visible: (l.disabled || (l.requiresAuth && !isAuthed)) ? false : visible })),
            };
          }
          if (item.type === 'layer') {
            return { ...item, visible: (item.disabled || (item.requiresAuth && !isAuthed)) ? false : visible };
          }
          return item;
        }),
      };
    }));
    this.sincronizarLeyendaConCapas(simbologiaAntes);
  }

  /**
   * Devuelve la sección filtrada para el panel según la sesión, o `null` si
   * debe ocultarse por completo (secciones/subsecciones/capas con `requiresAuth`).
   */
  private filterSectionForPanel(section: Section, isAuthed: boolean): Section | null {
    if (section.requiresAuth && !isAuthed) return null;
    const items = section.items
      .map(item => {
        if ('layers' in item) {
          if (item.requiresAuth && !isAuthed) return null;
          const layers = item.layers.filter(l => !l.requiresAuth || isAuthed);
          return layers.length > 0 ? { ...item, layers } : null;
        }
        return (item.requiresAuth && !isAuthed) ? null : item;
      })
      .filter((item): item is Section['items'][number] => item !== null);
    return items.length > 0 ? { ...section, items } : null;
  }
  /**
   * Alterna la herramienta activa del sidebar. Si se hace clic en la misma, se cierra.
   * @param toolId Identificador de la herramienta (ej: 'layers')
   */
  toggleSidebarTool(toolId: string): void {
    this.activeSidebarTools.update(tools => {
      const newTools = new Set(tools);
      if (newTools.has(toolId)) {
        newTools.delete(toolId);
      } else {
        newTools.add(toolId);
      }
      return newTools;
    });
  }
  /**
   * Ajusta la vista del mapa para encuadrar una geometría GeoJSON (Polygon, MultiPolygon, etc.)
   * @param geometry Geometría GeoJSON que se desea encuadrar.
   * @param offset Indica si se debe desplazar el centro para compensar el sidebar
   * @param zoom Nivel de zoom opcional para forzar en geometrías de tipo Point
   */
  fitToGeometry(geometry: GeoJSONGeometry, sourceProjection: 'EPSG:4326' | 'EPSG:32718' = 'EPSG:32718', zoom?: number, offset = false): void {
    const map = this._map();
    // La guarda debe ser más flexible: una geometría es válida si existe y tiene 'coordinates' (para geometrías simples)
    // o 'geometries' (para GeometryCollection).
    if (!map || !geometry || (!geometry.coordinates && !geometry.geometries)) return;

    // Limpiamos cualquier resaltado anterior para evitar confusiones
    this.clearHighlightLayer();

    const format = new GeoJSON();
    const view = map.getView();
    // Leemos la geometría directamente para evitar la ambigüedad de tipo (Feature vs Feature[])
    // Le indicamos a OL que la data viene en 32718 y la transforme a la proyección del mapa

    const geometryOl = format.readGeometry(geometry, {
      dataProjection: sourceProjection,
      featureProjection: view.getProjection()
    });
    if (!geometryOl) return;
    const extent = geometryOl.getExtent();
    const options: any = {
      duration: ANIMATION_DURATION,
      // Aplicamos el padding solo si 'offset' es true, para no afectar otras llamadas
      padding: offset ? [100, 100, 100, 420] : [50, 50, 50, 50]
    };
    if (geometry.type === 'Point' && zoom) {
      options.zoom = zoom;
    }
    view.fit(extent, options);

    // Resaltamos la nueva geometría en el mapa
    const featureToHighlight = new Feature({ geometry: geometryOl });
    this.highlightLayer?.getSource()?.addFeature(featureToHighlight);

  }
  /**
   * Encuadra en el mapa TODA la extensión de un área encontrada (por ejemplo un
   * parque o área recreacional compuesto por uno o varios polígonos) y resalta
   * cada uno de sus polígonos.
   *
   * Se usa en lugar de `fitToGeometry` cuando la búsqueda devuelve varias
   * geometrías de un mismo elemento porque:
   *  - une la extensión de TODAS ellas, de modo que el zoom resultante abarca el
   *    área completa y no solo uno de sus polígonos,
   *  - añade un margen del 8 % por lado, para que el perímetro completo del área
   *    quede visible y no pegado a los bordes de la vista,
   *  - limita el acercamiento con `maxZoom`, para no perder el contexto del
   *    entorno cuando el área es pequeña,
   *  - reserva espacio superior para el navbar y dibuja cada polígono como
   *    feature independiente en la capa de resaltado de búsquedas.
   * @param geometrias Geometrías GeoJSON (EPSG:32718) que componen el área.
   * @param maxZoom Tope de acercamiento del ajuste de vista (por defecto `ZOOM_MAX_PARQUE`).
   */
  fitToParque(geometrias: GeoJSONGeometry[], maxZoom = ZOOM_MAX_PARQUE): void {
    const map = this._map();
    // Solo consideramos geometrías válidas: con 'coordinates' (simples) o
    // 'geometries' (colecciones).
    const validas = (geometrias ?? []).filter(g => !!g && (!!g.coordinates || !!g.geometries));
    if (!map || validas.length === 0) return;

    // Limpiamos cualquier resaltado anterior para evitar confusiones
    this.clearHighlightLayer();

    const format = new GeoJSON();
    const view = map.getView();
    const source = this.highlightLayer?.getSource();
    let extent: number[] | undefined;

    for (const geometria of validas) {
      const geometryOl = format.readGeometry(geometria, {
        dataProjection: 'EPSG:32718',
        featureProjection: view.getProjection()
      });
      if (!geometryOl) continue;
      // Resaltamos el polígono del área en la capa de resaltado de búsquedas
      source?.addFeature(new Feature({ geometry: geometryOl }));
      // Unimos la extensión de cada polígono para encuadrar el área completa:
      // así el zoom comprende todo lo que abarca el parque encontrado.
      extent = extent ? extend(extent, geometryOl.getExtent()) : geometryOl.getExtent();
    }
    if (!extent || isEmpty(extent)) return;

    // Cuando el buscador solo aporta el centroide del área (Point) la extensión
    // no tiene tamaño; un zoom máximo dejaría el parque sin contexto, así que lo
    // limitamos para que se aprecie el entorno de la ubicación encontrada.
    const soloCentroides = validas.every(geometria => geometria.type === 'Point');
    const topeZoom = soloCentroides ? Math.min(maxZoom, ZOOM_MAX_PARQUE_CENTROIDE) : maxZoom;

    // Margen proporcional (8 % del lado mayor) alrededor del área, para que su
    // perímetro quede holgado dentro de la ventana del mapa.
    const margen = Math.max(extent[2] - extent[0], extent[3] - extent[1]) * 0.08;
    const extentConMargen: number[] = [
      extent[0] - margen,
      extent[1] - margen,
      extent[2] + margen,
      extent[3] + margen
    ];

    view.fit(extentConMargen, {
      duration: ANIMATION_DURATION,
      // El panel de consultas se cierra al ubicar el parque, por lo que el
      // margen es simétrico (no se reserva espacio lateral para el sidebar);
      // el superior es mayor para no quedar bajo el navbar.
      padding: [110, 90, 90, 90],
      maxZoom: topeZoom
    });
  }
  /** Configura la capa que resalta geometrías encontradas. */
  private setupHighlightLayer(): void {
    const map = this._map();
    if (!map) return;
    this.highlightLayer = new VectorLayer({
      source: new VectorSource(),
      // Estilo según el tipo de geometría:
      // - Líneas (vías): trazo ámbar sólido sobre un halo translúcido más ancho,
      //   para que la vía encontrada destaque claramente sobre la cartografía.
      // - Polígonos (lotes, habilitaciones): borde y relleno azules.
      style: feature => {
        const geometryType = feature.getGeometry()?.getType();
        if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
          return [
            new Style({ stroke: new Stroke({ color: 'rgba(255, 193, 7, 0.45)', width: 12 }) }),
            new Style({ stroke: new Stroke({ color: '#ff8f00', width: 5 }) }),
          ];
        }
        // Puntos (centroides de áreas recreativas): un estilo con `stroke` y
        // `fill` NO dibuja nada sobre un Point, así que las áreas de las que
        // solo se conoce su centroide se señalan con un círculo azul.
        if (geometryType === 'Point' || geometryType === 'MultiPoint') {
          return new Style({
            image: new Circle({
              radius: 10,
              fill: new Fill({ color: 'rgba(72, 173, 229, 0.25)' }),
              stroke: new Stroke({ color: '#48ade5', width: 3 }),
            }),
          });
        }
        return new Style({
          stroke: new Stroke({
            color: '#48ade5',
            width: 3,
          }),
          fill: new Fill({
            color: 'rgba(72, 173, 229, 0.2)',
          }),
        });
      },
      zIndex: 1000, // Asegura que esté por encima de otras capas
    });
    map.addLayer(this.highlightLayer);
  }

  /** Configura la capa cyan con la geometría y etiqueta del área calculada. */
  private cuadriculaUtm?: VectorLayer<any>;

  /** Opciones de espaciado (orientadas al papel) de la última activación */
  private opcionesCuadricula?: { mmEntreLineas?: number; dpi?: number };

  /**
   * Activa la cuadrícula de coordenadas UTM zona 18S sobre el mapa.
   * Las líneas se generan a múltiplos "agradables" de metros (1/2/5 × 10ⁿ)
   * con etiquetas Este/Norte. Debe invocarse cuando la vista ya tiene el
   * tamaño y la resolución DEFINITIVOS de la impresión, y desactivarse tras
   * la captura.
   * @param opciones Espaciado orientado al PAPEL impreso:
   *  - `mmEntreLineas`: separación objetivo entre líneas en mm de papel.
   *  - `dpi`: resolución de la captura (px por pulgada de papel).
   * Si se omite, se usa un espaciado pensado para pantalla (~130 px).
   */
  activarCuadriculaUtm(opciones?: { mmEntreLineas?: number; dpi?: number }): void {
    const map = this._map();
    if (!map) return;
    if (!this.cuadriculaUtm) {
      this.cuadriculaUtm = new VectorLayer({
        source: new VectorSource(),
        zIndex: 998,
        style: this.estiloCuadriculaUtm(),
      });
      map.addLayer(this.cuadriculaUtm);
    }
    this.opcionesCuadricula = opciones;
    this.cuadriculaUtm.setVisible(true);
    this.actualizarCuadriculaUtm();
  }

  /** Desactiva la cuadrícula UTM-18S tras la captura del plano. */
  desactivarCuadriculaUtm(): void {
    this.cuadriculaUtm?.setVisible(false);
  }

  /** Estilo de la cuadrícula: líneas punteadas finas + etiquetas Este/Norte. */
  private estiloCuadriculaUtm(): (feature: any) => Style[] {
    const estiloLinea = new Style({
      stroke: new Stroke({ color: 'rgba(27, 42, 78, 0.35)', width: 0.8, lineDash: [5, 4] }),
    });
    return feature => {
      // Features sin geometría válida nunca deben dibujarse (evita errores en
      // el pipeline de renderizado de OpenLayers)
      if (!feature?.getGeometry()) return [];
      if (feature.getGeometry()!.getType() === 'Point') {
        return [new Style({
          text: new Text({
            text: (feature.get('etiqueta') as string) ?? '',
            font: 'bold 9px Helvetica, Arial, sans-serif',
            fill: new Fill({ color: '#1b2a4e' }),
            stroke: new Stroke({ color: 'rgba(255, 255, 255, 0.85)', width: 2.5 }),
            overflow: true,
          }),
        })];
      }
      return [estiloLinea];
    };
  }

  /** Redondea un valor positivo al "número agradable" (1/2/5 × 10ⁿ) inmediato superior. */
  private numeroAgradableSuperior(valor: number): number {
    if (valor <= 0) return 1;
    const base = Math.pow(10, Math.floor(Math.log10(valor)));
    for (const factor of [1, 2, 5, 10]) {
      const candidato = factor * base;
      if (candidato >= valor) return candidato;
    }
    return 10 * base;
  }

  /**
   * Reconstruye las líneas de la cuadrícula UTM-18S para la extensión actual
   * de la vista: convierte los límites del viewport a metros UTM, elige un
   * paso de cuadrilla legible y traza las verticales (Este) y horizontales
   * (Norte) muestreadas para respetar su leve curvatura en la vista web.
   */
  private actualizarCuadriculaUtm(): void {
    const layer = this.cuadriculaUtm;
    const map = this._map();
    if (!layer || !map || !layer.getVisible()) return;
    const source = layer.getSource();
    const size = map.getSize();
    if (!source || !size || size[0] < 2 || size[1] < 2) return;

    const vista = map.getView();
    const proyeccionVista = vista.getProjection()?.getCode() ?? 'EPSG:3857';
    const extension = vista.calculateExtent(size);

    // Límites del viewport en metros UTM-18S
    const esquinaMin = transform([extension[0], extension[1]], proyeccionVista, 'EPSG:32718');
    const esquinaMax = transform([extension[2], extension[3]], proyeccionVista, 'EPSG:32718');
    const xMin = Math.min(esquinaMin[0], esquinaMax[0]);
    const xMax = Math.max(esquinaMin[0], esquinaMax[0]);
    const yMin = Math.min(esquinaMin[1], esquinaMax[1]);
    const yMax = Math.max(esquinaMin[1], esquinaMax[1]);
    if (![xMin, xMax, yMin, yMax].every(Number.isFinite)) return;

    // Paso de cuadrilla orientado al PAPEL: con opciones de impresión, la
    // separación objetivo son milímetros de papel convertidos a píxeles de
    // captura; así, a cualquier escala (1/250…1/2000), las líneas quedan a un
    // intervalo legible, siempre en metros redondos y coherentes con la barra
    // de escala. Sin opciones se conserva el criterio de pantalla (~130 px).
    const resolucion = vista.getResolution() ?? 1;
    const mmEntreLineas = this.opcionesCuadricula?.mmEntreLineas;
    const dpi = this.opcionesCuadricula?.dpi ?? 150;
    const pixelesObjetivo = mmEntreLineas ? (mmEntreLineas * dpi) / 25.4 : 130;
    let paso = this.numeroAgradableSuperior(resolucion * pixelesObjetivo);
    // Seguridad #1: valores patológicos (NaN/Infinity) de la resolución o de
    // la extensión durante la impresión invalidan la cuadrícula completa y
    // derivaban en "RangeError: Invalid array length".
    if (!Number.isFinite(paso) || paso <= 0) return;
    // Seguridad #2: nunca más de ~120 líneas por eje (evita bucles pesados y
    // arrays gigantes si la resolución o la extensión toman valores extremos)
    while ((yMax - yMin) / paso > 120 || (xMax - xMin) / paso > 120) {
      paso *= 2;
      if (!Number.isFinite(paso) || paso <= 0) return;
    }
    const muestras = 9; // puntos por línea para seguir la curvatura

    const aVista = (coordenadaUtm: number[]): number[] =>
      transform(coordenadaUtm, 'EPSG:32718', proyeccionVista);

    const desplazamientoX = (xMax - xMin) * 0.012;
    const desplazamientoY = (yMax - yMin) * 0.018;

    // Regeneramos la cuadrícula desde cero en cada activación
    source.clear();

    // Verticales: Este constante, el Norte recorre [yMin..yMax].
    // Tope defensivo de líneas: aunque el cálculo de `paso` falle, jamás se
    // intentará crear un array de coordenadas gigante/inválido.
    let verticales = 0;
    for (
      let este = Math.ceil(xMin / paso) * paso;
      este <= xMax + 1e-6 && verticales < 160;
      este += paso
    ) {
      verticales++;
      const coordenadas: number[][] = [];
      for (let i = 0; i < muestras; i++) {
        const norte = yMin + ((yMax - yMin) * i) / (muestras - 1);
        const punto = aVista([este, norte]);
        if (!Number.isFinite(punto[0]) || !Number.isFinite(punto[1])) break;
        // IMPORTANTE: LineString espera PARES [[x,y],...]. Pasar un array
        // plano [x,y,x,y…] hacía que OpenLayers detectara stride=undefined,
        // vaciaba las flatCoordinates y provocaba
        // "RangeError: Invalid array length" en douglasPeucker al renderizar.
        coordenadas.push([punto[0], punto[1]]);
      }
      if (coordenadas.length < muestras) continue;
      source.addFeature(new Feature(new LineString(coordenadas)));

      const etiqueta = new Feature(
        new Point(aVista([este + desplazamientoX, yMax - desplazamientoY])),
      );
      etiqueta.set('etiqueta', `${Math.round(este)} E`);
      source.addFeature(etiqueta);
    }

    // Horizontales: Norte constante, el Este recorre [xMin..xMax]
    // (mismos blindajes que las verticales)
    let horizontales = 0;
    for (
      let norte = Math.ceil(yMin / paso) * paso;
      norte <= yMax + 1e-6 && horizontales < 160;
      norte += paso
    ) {
      horizontales++;
      const coordenadas: number[][] = [];
      for (let i = 0; i < muestras; i++) {
        const este = xMin + ((xMax - xMin) * i) / (muestras - 1);
        const punto = aVista([este, norte]);
        if (!Number.isFinite(punto[0]) || !Number.isFinite(punto[1])) break;
        coordenadas.push([punto[0], punto[1]]);
      }
      if (coordenadas.length < muestras) continue;
      source.addFeature(new Feature(new LineString(coordenadas)));

      const etiqueta = new Feature(
        new Point(aVista([xMin + desplazamientoX, norte + desplazamientoY])),
      );
      etiqueta.set('etiqueta', `${Math.round(norte)} N`);
      source.addFeature(etiqueta);
    }
  }

  panMapForSidebar(sidebarOpen: boolean, sidebarWidth: number): void {
    const map = this._map();
    if (!map) return;

    const view = map.getView();
    const currentCenter = view.getCenter();
    if (!currentCenter) return;

    const resolution = view.getResolution()!;
    // El desplazamiento es la mitad del ancho del sidebar para mantener el foco en el centro del área visible.
    const offset = (sidebarOpen ? -sidebarWidth / 2 : sidebarWidth / 2) * resolution;

    const newCenter = [currentCenter[0] + offset, currentCenter[1]];

    view.animate({
      center: newCenter,
      duration: 300, // Coincide con la duración de la animación del sidebar
      easing: easeOut,
    });
  }

  /**
   * Compone todos los canvas de las capas del mapa en un único lienzo
   * (con fondo blanco), respetando el orden visual. Usado para exportar
   * el mapa a imágenes/PDF sin dependencias externas de rasterizado.
   * @returns Lienzo compuesto o `null` si el mapa no está inicializado.
   */
  getMapCanvas(): HTMLCanvasElement | null {
    const map = this._map();
    if (!map) return null;
    // Forzamos un render síncrono para que los tiles pendientes se pinten
    map.renderSync();
    const size = map.getSize() ?? [0, 0];
    const target = document.createElement('canvas');
    target.width = size[0];
    target.height = size[1];
    const ctx = target.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, target.width, target.height);
    // Dibujamos cada canvas de capa en orden (el orden DOM refleja el apilado)
    const canvases = map.getViewport().querySelectorAll('canvas');
    canvases.forEach(canvas => {
      const cssW = parseFloat((canvas as HTMLCanvasElement).style.width) || canvas.width;
      const cssH = parseFloat((canvas as HTMLCanvasElement).style.height) || canvas.height;
      ctx.drawImage(canvas, 0, 0, cssW, cssH);
    });
    return target;
  }

}
