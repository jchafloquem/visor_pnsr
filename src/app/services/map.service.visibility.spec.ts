import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { Section } from '../interfaces/geoLayers';
import { ArcGISRestService } from './arcgis-rest.service';
import { AuthService } from './auth.service';
import { AUDITORIA_OPCIONES, AuditoriaService } from './auditoria.service';
import { DrawMeasureService } from './draw.service';
import { MapService } from './map.service';

describe('MapService layer visibility audit', () => {
  const auditoria = { accion: vi.fn() };
  let service: MapService;

  beforeEach(() => {
    auditoria.accion.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: DrawMeasureService, useValue: {} },
        { provide: AuthService, useValue: { isAuthenticated: signal(false) } },
        { provide: ArcGISRestService, useValue: {} },
        { provide: AuditoriaService, useValue: auditoria },
      ],
    });
    service = TestBed.inject(MapService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('audits only actual layer visibility changes', () => {
    service.sections.set([sectionWithLayer()]);

    service.setLayerVisibility('test-section', 'test-layer', true);
    service.setLayerVisibility('test-section', 'test-layer', true);
    service.setLayerVisibility('test-section', 'test-layer', false);

    expect(auditoria.accion).toHaveBeenNthCalledWith(
      1,
      AUDITORIA_OPCIONES.CAPA_VISIBILIDAD,
      'Capa "Test layer" activada'
    );
    expect(auditoria.accion).toHaveBeenNthCalledWith(
      2,
      AUDITORIA_OPCIONES.CAPA_VISIBILIDAD,
      'Capa "Test layer" desactivada'
    );
    expect(auditoria.accion).toHaveBeenCalledTimes(2);
  });

  function sectionWithLayer(): Section {
    return {
      id: 'test-section',
      title: 'Test section',
      expanded: false,
      items: [{
        type: 'subsection',
        id: 'test-group',
        title: 'Test group',
        expanded: false,
        layers: [{
          type: 'layer',
          id: 'test-layer',
          label: 'Test layer',
          visible: false,
          opacity: 1,
          showInLegend: false,
        }],
      }],
    };
  }
});
