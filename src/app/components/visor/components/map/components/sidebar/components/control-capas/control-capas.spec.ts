import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { ControlCapas } from './control-capas';
import { MapService } from '../../../../../../../../services/map.service';
import { Section } from '../../../../../../../../interfaces/geoLayers';
import {
  LAYER_PANEL_SECTIONS,
  PERU_LIMITS_LAYER_CONFIGS,
} from '../../../../../../../../interfaces/controlCapasConfig';

describe('ControlCapas', () => {
  let component: ControlCapas;
  let fixture: ComponentFixture<ControlCapas>;
  const sections = signal<Section[]>([
    {
      id: 'viviendasRurales',
      title: 'VIVIENDAS RURALES',
      expanded: true,
      items: [
        {
          type: 'subsection',
          id: 'agua',
          title: 'ACCESO A AGUA',
          expanded: true,
          layers: [
            {
              type: 'layer',
              id: 'viviendas-rurales-agua-con-acceso',
              label: 'Con acceso a agua',
              visible: true,
              opacity: 1,
              showInLegend: false,
            },
            {
              type: 'layer',
              id: 'viviendas-rurales-agua-sin-acceso',
              label: 'Sin acceso a agua',
              visible: true,
              opacity: 1,
              showInLegend: false,
            },
          ],
        },
        {
          type: 'subsection',
          id: 'alcantarillado',
          title: 'ACCESO A ALCANTARILLADO',
          expanded: true,
          layers: [
            {
              type: 'layer',
              id: 'viviendas-rurales-alcantarillado-con-acceso',
              label: 'Con acceso a alcantarillado',
              visible: true,
              opacity: 1,
              showInLegend: false,
            },
            {
              type: 'layer',
              id: 'viviendas-rurales-alcantarillado-sin-acceso',
              label: 'Sin acceso a alcantarillado',
              visible: true,
              opacity: 1,
              showInLegend: false,
            },
          ],
        },
      ],
    },
    ...LAYER_PANEL_SECTIONS.filter(section => section.id === 'limitesPeru'),
    ...LAYER_PANEL_SECTIONS.filter(section => section.id === 'coenFen2027'),
  ]);
  const setLayerVisibility = vi.fn();
  const setLayerOpacity = vi.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ControlCapas],
      providers: [
        {
          provide: MapService,
          useValue: {
            panelSections: sections,
            setLayerVisibility,
            setLayerOpacity,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ControlCapas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders section, group and sublayer controls for the published FEN hierarchy', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('ACCESO A AGUA');
    expect(fixture.nativeElement.textContent).toContain('ACCESO A ALCANTARILLADO');
    expect(fixture.nativeElement.textContent).toContain('LÍMITES DEL PERÚ');
    expect(fixture.nativeElement.textContent).toContain('FEN2027');
    const fenSection = fixture.nativeElement.querySelector('[data-section-id="coenFen2027"]');
    const anaGroup = fenSection?.querySelector('[data-subsection-id="ana"]');
    expect(anaGroup?.querySelector('input[aria-label="Puntos críticos 2027"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('input[type="checkbox"]').length)
      .toBe(14 + PERU_LIMITS_LAYER_CONFIGS.length);
  });

  it('updates the layer visibility from its checkbox', () => {
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[aria-label="Con acceso a agua"]'
    );
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));

    expect(setLayerVisibility).toHaveBeenCalledWith(
      'viviendasRurales',
      'viviendas-rurales-agua-con-acceso',
      false
    );
  });

  it('updates Peru limits visibility from its checkbox', () => {
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[aria-label="Departamentos"]'
    );
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));

    expect(setLayerVisibility).toHaveBeenCalledWith('limitesPeru', 'limites-departamentos', false);
  });

  it('updates layer opacity from its range control', () => {
    const opacity: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[aria-label="Opacidad de Con acceso a agua"]'
    );
    opacity.value = '45';
    opacity.dispatchEvent(new Event('input'));

    expect(setLayerOpacity).toHaveBeenCalledWith(
      'viviendasRurales',
      'viviendas-rurales-agua-con-acceso',
      0.45
    );
  });
});
