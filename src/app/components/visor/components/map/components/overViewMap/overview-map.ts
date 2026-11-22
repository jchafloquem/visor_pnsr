import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnDestroy,
  ViewEncapsulation,
} from '@angular/core';
import {
  OlMap,
  OverviewMap,
  TileLayer,
  View,
} from '../../../../../../modules/openlayers.module';
import { ARCGIS_WORLD_TOPO_TILES_URL } from '../../../../../../interfaces/mapas.config';
import { ArcGISRestService } from '../../../../../../services/arcgis-rest.service';
import type { ObjectEvent } from 'ol/Object';

/**
 * Componente para integrar el control OverviewMap de OpenLayers.
 * Muestra un mapa de contexto que indica la extensión actual del mapa principal.
 */
@Component({
  selector: 'app-overview-map',
  standalone: true,
  templateUrl: './overview-map.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './overview-map.css',
})
export class OverviewMapComponent implements OnDestroy, AfterViewInit {
  @Input({ required: true }) mainMap!: OlMap;

  private overviewMapControl?: OverviewMap;
  private toggleButton?: HTMLButtonElement;
  private resizeFrame?: number;
  private syncFrame?: number;
  private readonly arcgisRestService = inject(ArcGISRestService);

  private readonly onToggleButtonClick = (): void => {
    this.scheduleOverviewMapResize();
  };

  private readonly onMainViewPropertyChange = (event: ObjectEvent): void => {
    if (event.key !== 'center' && event.key !== 'resolution') return;
    this.scheduleOverviewViewSync();
  };

  ngAfterViewInit(): void {
    this.initOverviewMap();
  }

  private initOverviewMap(): void {
    const mainView = this.mainMap.getView();
    const overviewTileLayer = new TileLayer({
      source: this.arcgisRestService.createTileSource(ARCGIS_WORLD_TOPO_TILES_URL, {
        maxZoom: 19,
      }),
    });

    const control = new OverviewMap({
      className: 'ol-overviewmap custom-overview',
      layers: [overviewTileLayer],
      view: new View({
        projection: mainView.getProjection(),
        center: mainView.getCenter(),
        zoom: Math.max(0, (mainView.getZoom() ?? 4) - 4),
      }),
      collapsible: true,
      collapsed: false,
      label: '−',
      collapseLabel: '⌖',
      tipLabel: 'Mapa de contexto',
    });

    this.overviewMapControl = control;
    mainView.on('change:center', this.onMainViewPropertyChange);
    mainView.on('change:resolution', this.onMainViewPropertyChange);
    this.mainMap.addControl(control);

    this.toggleButton =
      this.mainMap.getTargetElement()?.querySelector<HTMLButtonElement>('.custom-overview button') ??
      undefined;
    if (!this.toggleButton) {
      this.mainMap.removeControl(control);
      mainView.un('change:center', this.onMainViewPropertyChange);
      mainView.un('change:resolution', this.onMainViewPropertyChange);
      this.overviewMapControl = undefined;
      throw new Error('No se pudo crear el botón del mapa de contexto.');
    }

    this.toggleButton.addEventListener('click', this.onToggleButtonClick);
    this.updateToggleButton();
    this.scheduleOverviewMapResize();
    this.syncOverviewView();
  }

  private syncOverviewView(): void {
    const overviewMap = this.overviewMapControl?.getOverviewMap();
    if (!overviewMap) return;

    const mainView = this.mainMap.getView();
    const overviewView = overviewMap.getView();
    const center = mainView.getCenter();
    const zoom = mainView.getZoom();

    if (center) overviewView.setCenter(center);
    if (zoom !== undefined) overviewView.setZoom(Math.max(0, zoom - 4));
  }

  private scheduleOverviewViewSync(): void {
    if (this.syncFrame !== undefined) {
      cancelAnimationFrame(this.syncFrame);
    }

    this.syncFrame = requestAnimationFrame(() => {
      this.syncFrame = undefined;
      this.syncOverviewView();
    });
  }

  private updateToggleButton(): void {
    if (!this.toggleButton || !this.overviewMapControl) return;

    const collapsed = this.overviewMapControl.getCollapsed();
    const label = collapsed ? 'Expandir mapa de contexto' : 'Contraer mapa de contexto';
    this.toggleButton.setAttribute('aria-label', label);
    this.toggleButton.setAttribute('aria-expanded', String(!collapsed));
    this.toggleButton.title = label;
  }

  private scheduleOverviewMapResize(): void {
    if (this.resizeFrame !== undefined) {
      cancelAnimationFrame(this.resizeFrame);
    }

    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = undefined;
      this.updateToggleButton();
      const overviewMap = this.overviewMapControl?.getOverviewMap();
      if (!overviewMap) return;

      overviewMap.updateSize();
      overviewMap.getView().changed();
    });
  }

  ngOnDestroy(): void {
    if (this.resizeFrame !== undefined) {
      cancelAnimationFrame(this.resizeFrame);
    }
    if (this.syncFrame !== undefined) {
      cancelAnimationFrame(this.syncFrame);
    }
    if (!this.overviewMapControl) return;

    this.toggleButton?.removeEventListener('click', this.onToggleButtonClick);
    const mainView = this.mainMap.getView();
    mainView.un('change:center', this.onMainViewPropertyChange);
    mainView.un('change:resolution', this.onMainViewPropertyChange);
    this.mainMap.removeControl(this.overviewMapControl);
    this.overviewMapControl = undefined;
  }
}
