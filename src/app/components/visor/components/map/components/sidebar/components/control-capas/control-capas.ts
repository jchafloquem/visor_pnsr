import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from '../../../../../../../../services/map.service';
import { LayerItem, Section } from '../../../../../../../../interfaces/geoLayers';

interface LayerGroup {
  id: string;
  title: string;
  sectionId: string;
  expanded: boolean;
  layers: LayerItem[];
}

@Component({
  selector: 'app-control-capas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './control-capas.html',
  styleUrls: ['./control-capas.css']
})
export class ControlCapas {
  private readonly mapService = inject(MapService);

  readonly layerGroups = computed(() =>
    this.mapService.panelSections().flatMap(section => this.toLayerGroups(section))
  );

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

  private toLayerGroups(section: Section): LayerGroup[] {
    const groups: LayerGroup[] = [];
    const standaloneLayers: LayerItem[] = [];

    for (const item of section.items) {
      if (item.type === 'subsection') {
        groups.push({
          id: `${section.id}:${item.id}`,
          title: item.title,
          sectionId: section.id,
          expanded: item.expanded,
          layers: item.layers,
        });
      } else {
        standaloneLayers.push(item);
      }
    }

    if (standaloneLayers.length > 0) {
      groups.push({
        id: section.id,
        title: section.title,
        sectionId: section.id,
        expanded: section.expanded,
        layers: standaloneLayers,
      });
    }

    return groups;
  }
}
