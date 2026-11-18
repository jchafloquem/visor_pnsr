import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { ControlCapas } from './control-capas';
import { MapService } from '../../../../../../../../services/map.service';
import { Section } from '../../../../../../../../interfaces/geoLayers';

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
  ]);
  const setLayerVisibility = vi.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ControlCapas],
      providers: [
        {
          provide: MapService,
          useValue: {
            panelSections: sections,
            setLayerVisibility,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ControlCapas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the available rural layer controls', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('ACCESO A AGUA');
    expect(fixture.nativeElement.textContent).toContain('ACCESO A ALCANTARILLADO');
    expect(fixture.nativeElement.querySelectorAll('input[type="checkbox"]').length).toBe(4);
  });

  it('updates the layer visibility from its checkbox', () => {
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));

    expect(setLayerVisibility).toHaveBeenCalledWith(
      'viviendasRurales',
      'viviendas-rurales-agua-con-acceso',
      false
    );
  });
});
