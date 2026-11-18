import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from '../../../../../../../../services/map.service';
import { SubSection } from '../../../../../../../../interfaces/geoLayers';

@Component({
  selector: 'app-control-capas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './control-capas.html',
  styleUrls: ['./control-capas.css']
})
export class ControlCapas {
  private readonly mapService = inject(MapService);

  readonly groups = computed(() =>
    this.mapService.panelSections()
      .find(section => section.id === 'viviendasRurales')
      ?.items.filter((item): item is SubSection => item.type === 'subsection') ?? []
  );

  onLayerVisibilityChange(layerId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      throw new TypeError('Layer visibility control must be a checkbox input.');
    }

    this.mapService.setLayerVisibility('viviendasRurales', layerId, target.checked);
  }
}
