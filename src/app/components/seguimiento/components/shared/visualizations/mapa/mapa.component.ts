import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ARCGIS_WORLD_TOPO_TILES_URL,
  GOOGLE_SATELLITE_URL,
  INITIAL_CENTER,
} from '../../../../../../interfaces/mapas.config';
import {
  Circle as OlCircleStyle,
  Feature,
  Fill,
  fromLonLat,
  OlMap,
  Point,
  Stroke,
  Style,
  TileLayer,
  VectorLayer,
  VectorSource,
  View,
  XYZ,
  defaultControls,
} from '../../../../../../modules/openlayers.module';

export type MapaRiskLevel = 'CRÍTICO' | 'ALTA' | 'MODERADA' | 'BAJA' | null;
export type MapaSeverityFilter = 'todos' | 'altos' | 'crit';
export type MapaBaseMode = 'topo' | 'sat';

export interface MapaProjectPoint {
  cui: string;
  corto: string;
  dist: string;
  dep: string;
  uoLabel: string;
  lat: number;
  lng: number;
  riskLevel: MapaRiskLevel;
  activeRiskCount: number;
}

const LEGEND_ITEMS: ReadonlyArray<{
  key: Exclude<MapaRiskLevel, null>;
  label: string;
  colorVar: string;
}> = [
  { key: 'CRÍTICO', label: 'Crítico (alta y no mitigable)', colorVar: 'var(--color-risk-crit)' },
  { key: 'ALTA', label: 'Alta', colorVar: 'var(--color-rojo-nacional)' },
  { key: 'MODERADA', label: 'Moderada', colorVar: 'var(--color-risk-mid)' },
  { key: 'BAJA', label: 'Baja', colorVar: 'var(--color-verde-eficiencia)' },
];

const PERU_DEFAULT_ZOOM = 5.4;

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mapa.component.html',
  styleUrl: './mapa.component.css',
})
export class MapaComponent implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly projects = input.required<readonly MapaProjectPoint[]>();
  readonly severityFilter = model<MapaSeverityFilter>('todos');
  readonly selectProject = output<string>();

  readonly mapWrapRef = viewChild<ElementRef<HTMLElement>>('mapWrap');
  readonly olTargetRef = viewChild<ElementRef<HTMLElement>>('olTarget');

  readonly baseMode = signal<MapaBaseMode>('topo');
  readonly hoveredProject = signal<MapaProjectPoint | null>(null);
  readonly tooltipX = signal<number>(16);
  readonly tooltipY = signal<number>(16);

  readonly filterOptions: ReadonlyArray<{ value: MapaSeverityFilter; label: string }> = [
    { value: 'todos', label: 'Todos' },
    { value: 'altos', label: 'Alto y crítico' },
    { value: 'crit', label: 'Solo críticos' },
  ];

  private olMap: OlMap | null = null;
  private topoLayer: TileLayer<XYZ> | null = null;
  private satLayer: TileLayer<XYZ> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private vectorSource = new VectorSource();
  private styleCache = new Map<string, Style[]>();

  readonly filteredProjects = computed<readonly MapaProjectPoint[]>(() => {
    const sev = this.severityFilter();
    const list = this.projects();
    if (sev === 'altos') {
      return list.filter((p) => p.riskLevel === 'ALTA' || p.riskLevel === 'CRÍTICO');
    }
    if (sev === 'crit') {
      return list.filter((p) => p.riskLevel === 'CRÍTICO');
    }
    return list;
  });

  readonly legendCounts = computed(() => {
    const all = this.projects();
    return LEGEND_ITEMS.map((item) => ({
      ...item,
      count: all.filter((p) => p.riskLevel === item.key).length,
    }));
  });

  readonly noRiskCount = computed(() => {
    return this.projects().filter((p) => !p.riskLevel).length;
  });

  constructor() {
    effect(() => {
      const pts = this.filteredProjects();
      this.syncMarkers(pts);
    });

    this.destroyRef.onDestroy(() => {
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      if (this.olMap) {
        this.olMap.setTarget(undefined);
        this.olMap = null;
      }
    });
  }

  ngAfterViewInit(): void {
    const target = this.olTargetRef()?.nativeElement;
    if (!target || typeof window === 'undefined') return;

    this.topoLayer = new TileLayer({
      source: new XYZ({
        maxZoom: 19,
        crossOrigin: 'anonymous',
        tileUrlFunction: (tileCoord) => {
          if (!tileCoord) return undefined;
          const [z, x, y] = tileCoord;
          return ARCGIS_WORLD_TOPO_TILES_URL
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y));
        },
      }),
      visible: true,
    });

    this.satLayer = new TileLayer({
      source: new XYZ({
        url: GOOGLE_SATELLITE_URL,
        maxZoom: 19,
        crossOrigin: 'anonymous',
      }),
      visible: false,
    });

    const markersLayer = new VectorLayer({
      source: this.vectorSource,
      style: (feature) => {
        const pt = feature.get('project') as MapaProjectPoint | undefined;
        return this.getMarkerStyle(pt?.riskLevel ?? null);
      },
      zIndex: 10,
    });

    this.olMap = new OlMap({
      target,
      controls: defaultControls({ zoom: false, attribution: false, rotate: false }),
      layers: [this.topoLayer, this.satLayer, markersLayer],
      view: new View({
        center: fromLonLat(INITIAL_CENTER),
        zoom: PERU_DEFAULT_ZOOM,
        minZoom: 4,
        maxZoom: 18,
      }),
    });

    this.olMap.on('pointermove', (evt) => {
      if (!this.olMap || evt.dragging) return;
      const hit = this.olMap.forEachFeatureAtPixel(evt.pixel, (f) => f, { hitTolerance: 6 });
      const pt = hit ? (hit.get('project') as MapaProjectPoint | undefined) : undefined;

      target.style.cursor = pt ? 'pointer' : '';
      if (!pt) {
        this.hoveredProject.set(null);
        return;
      }

      this.hoveredProject.set(pt);
      const wrapWidth = this.mapWrapRef()?.nativeElement.clientWidth ?? 480;
      const [px, py] = evt.pixel;
      this.tooltipX.set(Math.min(px + 16, Math.max(8, wrapWidth - 270)));
      this.tooltipY.set(Math.max(8, py - 14));
    });

    this.olMap.on('singleclick', (evt) => {
      if (!this.olMap) return;
      const hit = this.olMap.forEachFeatureAtPixel(evt.pixel, (f) => f, { hitTolerance: 6 });
      const pt = hit ? (hit.get('project') as MapaProjectPoint | undefined) : undefined;
      if (pt) {
        this.selectProject.emit(pt.cui);
      }
    });

    this.syncMarkers(this.filteredProjects());

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.olMap?.updateSize();
      });
      this.resizeObserver.observe(target);
    }

    requestAnimationFrame(() => {
      this.olMap?.updateSize();
      this.olMap?.getView().setCenter(fromLonLat(INITIAL_CENTER));
    });
  }

  setBaseMode(mode: MapaBaseMode): void {
    this.baseMode.set(mode);
    if (this.topoLayer) this.topoLayer.setVisible(mode === 'topo');
    if (this.satLayer) this.satLayer.setVisible(mode === 'sat');
  }

  zoomBy(delta: number): void {
    const view = this.olMap?.getView();
    if (!view) return;
    const cur = view.getZoom() ?? PERU_DEFAULT_ZOOM;
    view.animate({ zoom: cur + delta, duration: 200 });
  }

  resetNationalView(): void {
    const view = this.olMap?.getView();
    if (!view) return;
    view.animate({
      center: fromLonLat(INITIAL_CENTER),
      zoom: PERU_DEFAULT_ZOOM,
      duration: 350,
    });
  }

  clearHover(): void {
    this.hoveredProject.set(null);
  }

  private syncMarkers(points: readonly MapaProjectPoint[]): void {
    this.vectorSource.clear(true);
    if (!points.length) return;

    // Render lower-severity markers first so CRÍTICO / ALTA always stay on top
    const order = (lvl: MapaRiskLevel): number => {
      if (lvl === 'CRÍTICO') return 4;
      if (lvl === 'ALTA') return 3;
      if (lvl === 'MODERADA') return 2;
      if (lvl === 'BAJA') return 1;
      return 0;
    };

    const sorted = [...points].sort((a, b) => order(a.riskLevel) - order(b.riskLevel));
    const features = sorted.map((p) => {
      const f = new Feature({
        geometry: new Point(fromLonLat([p.lng, p.lat])),
      });
      f.set('project', p);
      return f;
    });
    this.vectorSource.addFeatures(features);
  }

  private resolveCssColor(varName: string, fallback: string): string {
    if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
    const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return val || fallback;
  }

  private getMarkerStyle(level: MapaRiskLevel): Style[] {
    const key = level || 'NONE';
    const cached = this.styleCache.get(key);
    if (cached) return cached;

    const white = this.resolveCssColor('--color-surface-card', '#FFFFFF');
    const colorMap: Record<string, [string, string]> = {
      CRÍTICO: ['--color-risk-crit', '#7A0712'],
      ALTA: ['--color-risk-high', '#DF1021'],
      MODERADA: ['--color-risk-mid', '#E9A21F'],
      BAJA: ['--color-risk-low', '#2E9B62'],
      NONE: ['--color-risk-none', '#7F8FA6'],
    };

    const [cssVar, fb] = colorMap[key];
    const fillHex = this.resolveCssColor(cssVar, fb);
    const isHighOrCrit = level === 'CRÍTICO' || level === 'ALTA';

    const styles: Style[] = [];
    if (isHighOrCrit) {
      styles.push(
        new Style({
          image: new OlCircleStyle({
            radius: 13,
            fill: new Fill({
              color: level === 'CRÍTICO' ? 'rgba(122, 7, 18, 0.20)' : 'rgba(223, 16, 33, 0.18)',
            }),
            stroke: new Stroke({
              color: level === 'CRÍTICO' ? 'rgba(122, 7, 18, 0.45)' : 'rgba(223, 16, 33, 0.35)',
              width: 1.5,
            }),
          }),
        })
      );
    }

    styles.push(
      new Style({
        image: new OlCircleStyle({
          radius: isHighOrCrit ? 6.5 : 5,
          fill: new Fill({ color: fillHex }),
          stroke: new Stroke({ color: white, width: 2 }),
        }),
      })
    );

    this.styleCache.set(key, styles);
    return styles;
  }
}
