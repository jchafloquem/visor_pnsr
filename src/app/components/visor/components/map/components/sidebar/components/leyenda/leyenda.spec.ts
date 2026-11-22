import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';

import { MapService } from '@app/services/map.service';
import type { LayerItem, Section } from '@interfaces/geoLayers';
import { Leyenda } from './leyenda';

describe('Leyenda', () => {
  let component: Leyenda;
  let fixture: ComponentFixture<Leyenda>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Leyenda],
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Leyenda);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

/**
 * El panel de leyenda recibe del `MapService` las capas activas y cada capa puede
 * aportar VARIAS leyendas cuando es una capa compuesta (p. ej. la zonificación:
 * los polígonos de usos del suelo y sus límites normativos). Estas pruebas fijan
 * ese comportamiento con un `MapService` simulado, de modo que se vea la leyenda
 * de los límites sin perder la de los polígonos.
 */
describe('Leyenda · capas compuestas', () => {
  const URL_POLIGONOS =
    'https://maps.example.test/legend/poligonos.png';
  const URL_LIMITES =
    'https://maps.example.test/legend/limites.png';

  /** Panel de capas con la zonificación compuesta activa y su lista de leyendas. */
  const panelConZonificacion = (cambios: Partial<LayerItem> = {}): Section[] => [
    {
      id: 'normativaUrbana',
      title: 'NORMATIVA URBANA',
      expanded: false,
      items: [
        {
          type: 'layer',
          id: 'zonificacion',
          label: 'Zonificación usos del suelo',
          visible: true,
          opacity: 1,
          showInLegend: true,
          legendUrl: URL_POLIGONOS,
          legendUrls: [URL_POLIGONOS, URL_LIMITES],
          ...cambios,
        },
      ],
    },
  ];

  /** Monta el componente con un MapService simulado que devuelve ese panel. */
  const montarConPanel = async (secciones: Section[]): Promise<ComponentFixture<Leyenda>> => {
    await TestBed.configureTestingModule({
      imports: [Leyenda],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        {
          provide: MapService,
          useValue: {
            panelSections: signal(secciones),
            leyendaVisible: signal(true),
            closeLeyenda: () => {},
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Leyenda);
    fixture.detectChanges();
    return fixture;
  };

  it('muestra una leyenda por cada capa de la capa compuesta', async () => {
    const fixture = await montarConPanel(panelConZonificacion());
    expect(fixture.componentInstance.activeLegends().map((l) => l.url)).toEqual([
      URL_POLIGONOS,
      URL_LIMITES,
    ]);
    expect(fixture.nativeElement.querySelectorAll('img').length).toBe(2);
  });

  it('comparte el título del panel de capas entre las dos simbologías', async () => {
    const fixture = await montarConPanel(panelConZonificacion());
    expect(fixture.componentInstance.activeLegends().map((l) => l.label)).toEqual([
      'Zonificación usos del suelo',
      'Zonificación usos del suelo',
    ]);
  });

  it('no repite la leyenda cuando la capa declara una sola URL', async () => {
    const fixture = await montarConPanel(panelConZonificacion({ legendUrls: [] }));
    expect(fixture.componentInstance.activeLegends().map((l) => l.url)).toEqual([URL_POLIGONOS]);
  });

  it('no muestra la leyenda de una capa oculta', async () => {
    const fixture = await montarConPanel(panelConZonificacion({ visible: false }));
    expect(fixture.componentInstance.activeLegends()).toHaveLength(0);
  });

  it('no muestra la leyenda de una capa marcada con showInLegend en falso', async () => {
    const fixture = await montarConPanel(panelConZonificacion({ showInLegend: false }));
    expect(fixture.componentInstance.activeLegends()).toHaveLength(0);
  });

  it('muestra el símbolo de color de una capa vectorial', async () => {
    const secciones: Section[] = [
      {
        id: 'viviendasRurales',
        title: 'VIVIENDAS RURALES',
        expanded: true,
        items: [
          {
            type: 'layer',
            id: 'viviendas-rurales-agua-con-acceso',
            label: 'Con acceso a agua',
            visible: true,
            opacity: 1,
            showInLegend: true,
            legendColor: '#16803c',
          },
        ],
      },
    ];
    const fixture = await montarConPanel(secciones);

    expect(fixture.componentInstance.activeLegends()).toEqual([
      {
        key: 'symbol:viviendas-rurales-agua-con-acceso',
        label: 'Con acceso a agua',
        color: '#16803c',
      },
    ]);
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="img"]').style.backgroundColor).toBe('rgb(22, 128, 60)');
  });

  it('muestra las entradas de leyenda de un servicio ArcGIS REST', async () => {
    const sections: Section[] = [
      {
        id: 'limitesPeru',
        title: 'LÍMITES DEL PERÚ',
        expanded: false,
        items: [
          {
            type: 'layer',
            id: 'limites-departamentos',
            label: 'Departamentos',
            visible: true,
            opacity: 1,
            showInLegend: true,
            legendEntries: [
              { label: 'Departamentos', url: 'data:image/png;base64,abc' },
            ],
          },
        ],
      },
    ];
    const fixture = await montarConPanel(sections);

    expect(fixture.componentInstance.activeLegends()).toEqual([
      {
        key: 'image:data:image/png;base64,abc',
        label: 'Departamentos',
        url: 'data:image/png;base64,abc',
      },
    ]);
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('alt')).toBe('Departamentos');
  });
});
