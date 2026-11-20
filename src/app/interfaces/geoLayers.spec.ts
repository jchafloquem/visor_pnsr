import {
  capaAportaSimbologia,
  capasConSimbologiaVisible,
  capasDeSeccion,
  sincroniaLeyenda,
} from './geoLayers';
import type { LayerItem, Section } from './geoLayers';

/**
 * Utilidades de simbología (`geoLayers.ts`): son la fuente única de verdad con
 * la que el panel de leyenda decide qué imágenes mostrar y el `MapService` si la
 * ventana flotante debe aparecer u ocultarse sola al activar capas.
 */
describe('geoLayers · utilidades de simbología', () => {
  /** Capa mínima de prueba (apagada, con leyenda de un solo servicio). */
  const capa = (cambios: Partial<LayerItem> = {}): LayerItem => ({
    type: 'layer',
    id: 'zonificacion',
    label: 'Zonificación usos del suelo',
    visible: false,
    opacity: 1,
    showInLegend: true,
    legendUrl: 'https://maps.example.test/legend/poligono.png',
    ...cambios,
  });

  /** Sección de prueba con los items indicados. */
  const seccion = (items: Section['items']): Section => ({
    id: 'normativaUrbana',
    title: 'NORMATIVA URBANA',
    expanded: false,
    items,
  });

  describe('capasDeSeccion', () => {
    it('devuelve las capas directas y las de las subsecciones, en orden', () => {
      const resultado = capasDeSeccion(
        seccion([
          capa({ id: 'zona', label: 'Zonificación' }),
          {
            type: 'subsection',
            id: 'normativa',
            title: 'NORMATIVA',
            expanded: false,
            layers: [capa({ id: 'alturas', label: 'Alturas' }), capa({ id: 'parametros', label: 'Parámetros' })],
          },
          capa({ id: 'alineamiento', label: 'Alineamiento' }),
        ])
      );
      expect(resultado.map(l => l.id)).toEqual(['zona', 'alturas', 'parametros', 'alineamiento']);
    });
  });

  describe('capaAportaSimbologia', () => {
    it('es falsa para una capa apagada', () => {
      expect(capaAportaSimbologia(capa({ visible: false }))).toBe(false);
    });

    it('es falsa cuando la capa se excluyó de la leyenda', () => {
      expect(capaAportaSimbologia(capa({ visible: true, showInLegend: false }))).toBe(false);
    });

    it('es falsa cuando una capa no tiene imagen de leyenda', () => {
      expect(capaAportaSimbologia(capa({ visible: true, legendUrl: undefined }))).toBe(false);
    });

    it('es verdadera con una sola imagen (legendUrl)', () => {
      expect(capaAportaSimbologia(capa({ visible: true }))).toBe(true);
    });

    it('es verdadera para una capa compuesta que aporta varias imágenes', () => {
      expect(
        capaAportaSimbologia(capa({ visible: true, legendUrl: undefined, legendUrls: ['a', 'b'] }))
      ).toBe(true);
    });

    it('es verdadera para una capa con entradas de leyenda dinámicas', () => {
      expect(
        capaAportaSimbologia(capa({
          visible: true,
          legendUrl: undefined,
          legendEntries: [{ label: 'Departamentos', url: 'data:image/png;base64,abc' }],
        }))
      ).toBe(true);
    });

    it('es verdadera para una capa vectorial visible con color de símbolo', () => {
      expect(
        capaAportaSimbologia(capa({ visible: true, legendUrl: undefined, legendColor: '#16803c' }))
      ).toBe(true);
    });
  });

  describe('capasConSimbologiaVisible', () => {
    it('filtra las capas apagadas, sin leyenda, imagen o símbolo', () => {
      const secciones = [
        seccion([
          capa({ id: 'visible', visible: true }),
          capa({ id: 'apagada', visible: true, showInLegend: false }),
          capa({ id: 'sinImagen', visible: true, legendUrl: undefined }),
          capa({ id: 'sinSimbolo', visible: true, legendUrl: undefined, legendColor: undefined }),
        ]),
        seccion([
          {
            type: 'subsection',
            id: 'sub',
            title: 'SUB',
            expanded: false,
            layers: [
              capa({ id: 'subVisible', visible: true }),
              capa({ id: 'subApagada', visible: false }),
            ],
          },
        ]),
      ];
      expect(capasConSimbologiaVisible(secciones).map(l => l.id)).toEqual(['visible', 'subVisible']);
    });

    it('cuenta una sola capa aunque aporte dos leyendas', () => {
      const secciones = [
        seccion([
          capa({
            visible: true,
            legendUrls: ['poligono', 'limites'],
          }),
        ]),
      ];
      expect(capasConSimbologiaVisible(secciones)).toHaveLength(1);
    });
  });

  describe('sincroniaLeyenda', () => {
    it('pide abrir la ventana cuando se encendió simbología nueva', () => {
      expect(sincroniaLeyenda(0, 1, false)).toBe('abrir');
      // Con la ventana ya abierta, encender otra capa no cambia nada.
      expect(sincroniaLeyenda(1, 2, true)).toBe('abrir');
    });

    it('pide cerrarla cuando se apagó la última capa con leyenda', () => {
      expect(sincroniaLeyenda(1, 0, true)).toBe('cerrar');
    });

    it('respeta la ventana abierta a mano aunque no quede simbología', () => {
      expect(sincroniaLeyenda(1, 0, false)).toBe('ninguna');
    });

    it('no hace nada si solo se apagó una capa entre varias', () => {
      expect(sincroniaLeyenda(3, 2, true)).toBe('ninguna');
      expect(sincroniaLeyenda(2, 2, false)).toBe('ninguna');
    });
  });
});
