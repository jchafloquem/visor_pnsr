import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from '../../../../../../../../services/map.service';
import { LayerItem, Section } from '../../../../../../../../interfaces/geoLayers';

@Component({
  selector: 'app-control-capas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './control-capas.html',
  styleUrls: ['./control-capas.css']
})
export class ControlCapas {
  private readonly mapService = inject(MapService);

  readonly sections = computed(() => this.mapService.panelSections());

  getLayerCount(section: Section): number {
    return section.items.reduce(
      (count, item) => count + (item.type === 'subsection' ? item.layers.length : 1),
      0
    );
  }

  onLayerVisibilityChange(sectionId: string, layerId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      throw new TypeError('Layer visibility control must be a checkbox input.');
    }

    this.mapService.setLayerVisibility(sectionId, layerId, target.checked);
  }

  getOpacityPercent(layer: LayerItem): number {
    return layer.opacity * 100;
  }

  setLayerOpacityFromEvent(sectionId: string, layerId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'range') {
      throw new TypeError('Layer opacity control must be a range input.');
    }

    const percent = target.valueAsNumber;
    if (!Number.isFinite(percent)) {
      throw new TypeError('Layer opacity must be a finite number.');
    }

    this.mapService.setLayerOpacity(sectionId, layerId, Math.min(100, Math.max(0, percent)) / 100);
  }

}
