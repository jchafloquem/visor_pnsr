import {
  COEN_FEN_2027_LAYER_GROUPS,
  LAYER_PANEL_SECTIONS,
  ORTOFOTOS_LAYER_CONFIGS,
  PERU_ADMINISTRATIVE_LAYER_IDS,
  PERU_LIMITS_LAYER_CONFIGS,
  PERU_LIMITS_PANEL_ITEMS,
  VIVIENDAS_RURALES_LAYER_CONFIGS,
} from './controlCapasConfig';
import type { LayerItem, SubSection } from './geoLayers';

/**
 * `controlCapasConfig.ts` declara la estructura completa del panel de capas del
 * visor mediante las fábricas `capa()` y `subseccion()`, y aplica al final la
 * política de acceso que consume `MapService.panelSections`. Estas pruebas fijan
 * las reglas de las que depende el panel:
 *
 *  1. Los valores por defecto de toda capa del panel (apagada, opacidad 1),
 *     de modo que cada entrada solo declara aquello que se desvía.
 *  2. La política de acceso para las secciones del panel disponibles.
 *  3. La coherencia entre el panel y las capas que aún tienen fuente activa:
 *     ArcGIS REST.
 */

/** Capas directas y de subsecciones de todas las secciones del panel. */
const capasDelPanel = (): LayerItem[] =>
  LAYER_PANEL_SECTIONS.flatMap(seccion =>
    seccion.items.flatMap(item => ('layers' in item ? item.layers : [item]))
  );

/** Todas las subsecciones del panel. */
const subsecciones = (): SubSection[] =>
  LAYER_PANEL_SECTIONS.flatMap(s => s.items.filter((i): i is SubSection => 'layers' in i));

describe('controlCapasConfig · valores por defecto', () => {
  it('toda capa nace apagada y con opacidad 1 salvo que se declare lo contrario', () => {
    expect(capasDelPanel().length).toBeGreaterThan(0);
    for (const layer of capasDelPanel()) {
      expect(layer.type).toBe('layer');
      expect(layer.opacity).toBe(1);
      expect(typeof layer.visible).toBe('boolean');
      expect(typeof layer.showInLegend).toBe('boolean');
    }
  });

  it('inicia con visibles solo los límites políticos', () => {
    expect(capasDelPanel().filter(l => l.visible).map(l => l.id)).toEqual([
      'limites-departamentos',
      'limites-provincias',
      'limites-distritos',
    ]);
    expect(PERU_LIMITS_LAYER_CONFIGS
      .filter(layer => layer.visible)
      .map(layer => layer.arcgisLayerId)).toEqual([
      PERU_ADMINISTRATIVE_LAYER_IDS.departments,
      PERU_ADMINISTRATIVE_LAYER_IDS.provinces,
      PERU_ADMINISTRATIVE_LAYER_IDS.districts,
    ]);
    expect(VIVIENDAS_RURALES_LAYER_CONFIGS.every(layer =>
      !capasDelPanel().find(item => item.id === layer.itemId)?.visible
    )).toBe(true);
  });

  it('ninguna capa del panel tiene el identificador vacío', () => {
    // La fábrica marca `disabled` cuando el id viene vacío: hoy no debe pasar.
    for (const layer of capasDelPanel()) {
      expect(layer.id).not.toBe('');
      expect(layer.id.trim()).toBe(layer.id);
      expect(layer.label.trim()).not.toBe('');
    }
  });
});
describe('controlCapasConfig · política de acceso', () => {
  it('deja públicas las secciones con capas disponibles', () => {
    expect(LAYER_PANEL_SECTIONS.every(s => !s.requiresAuth)).toBe(true);
  });
});

describe('controlCapasConfig · estructura del panel', () => {
  it('expone secciones con título y contenido', () => {
    for (const seccion of LAYER_PANEL_SECTIONS) {
      expect(seccion.title.trim()).not.toBe('');
      expect(seccion.items.length).toBeGreaterThan(0);
      expect(typeof seccion.expanded).toBe('boolean');
    }
  });

  it('mantiene el orden de secciones declarado', () => {
    expect(LAYER_PANEL_SECTIONS.map(s => s.id)).toEqual([
      'limitesPeru',
      'viviendasRurales',
      'coenFen2027',
      'ortofotos',
    ]);
  });

  it('no repite identificadores de sección ni de subsección', () => {
    const idsSeccion = LAYER_PANEL_SECTIONS.map(s => s.id);
    expect(new Set(idsSeccion).size).toBe(idsSeccion.length);

    const idsSubseccion = subsecciones().map(s => s.id);
    expect(new Set(idsSubseccion).size).toBe(idsSubseccion.length);
  });

  it('no deja subsecciones vacías', () => {
    for (const sub of subsecciones()) {
      expect(sub.layers.length).toBeGreaterThan(0);
      expect(typeof sub.expanded).toBe('boolean');
    }
  });
});
describe('controlCapasConfig · coherencia con los servicios del mapa', () => {
  it('solo publica capas ArcGIS REST con fuente activa', () => {
    const idsArcGis = new Set([
      ...PERU_LIMITS_LAYER_CONFIGS.map(layer => layer.itemId),
      ...VIVIENDAS_RURALES_LAYER_CONFIGS.map(layer => layer.itemId),
      ...COEN_FEN_2027_LAYER_GROUPS.flatMap(group => group.layers.map(layer => layer.itemId)),
      ...ORTOFOTOS_LAYER_CONFIGS.map(layer => layer.itemId),
    ]);
    expect(capasDelPanel().every(layer => idsArcGis.has(layer.id))).toBe(true);
    expect(PERU_LIMITS_LAYER_CONFIGS).toHaveLength(12);
    expect(capasDelPanel().filter(layer => idsArcGis.has(layer.id))).toHaveLength(
      idsArcGis.size
    );
  });

  it('representa las subcapas del MapServer de límites en su jerarquía publicada', () => {
    const section = LAYER_PANEL_SECTIONS.find(item => item.id === 'limitesPeru');
    const groups = section?.items.filter((item): item is SubSection => 'layers' in item);

    expect(PERU_LIMITS_LAYER_CONFIGS.map(layer => layer.arcgisLayerId)).toEqual([
      0, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13,
    ]);
    expect(groups?.map(group => group.title)).toEqual(['VÍAS', 'HIDROGRAFÍA']);
    expect(groups?.map(group => group.layers.map(layer => layer.label))).toEqual([
      ['Vías Vecinales', 'Vías Departamentales', 'Vías Nacionales', 'Vía Férrea'],
      ['Ríos Principales', 'Ríos', 'Quebradas'],
    ]);
    expect(PERU_LIMITS_PANEL_ITEMS.filter(item => item.type === 'layer')).toHaveLength(5);
  });

  it('representa FEN 2027 con sección, grupos y subcapas hoja del MapServer', () => {
    const section = LAYER_PANEL_SECTIONS.find(item => item.id === 'coenFen2027');
    const groups = section?.items.filter((item): item is SubSection => 'layers' in item);

    expect(section?.title).toBe('FEN2027');
    expect(groups?.map(group => group.title)).toEqual([
      'COMISIÓN FEN',
      'CALLAO',
      'CENEPRED',
      'INDECI',
      'Vivienda',
      'ANA',
    ]);
    expect(groups?.map(group => group.layers.length)).toEqual([2, 2, 1, 1, 2, 2]);
    expect(COEN_FEN_2027_LAYER_GROUPS.flatMap(group =>
      group.layers.map(layer => layer.arcgisLayerId)
    )).toEqual([
      59, 60, 56, 55, 52, 31, 51, 22, 24, 25,
    ]);
    expect(groups?.flatMap(group => group.layers.map(layer => layer.id))).toEqual(
      COEN_FEN_2027_LAYER_GROUPS.flatMap(group => group.layers.map(layer => layer.itemId))
    );
  });

  it('representa las ortofotos IDEP como capas disponibles en una sección pública', () => {
    const section = LAYER_PANEL_SECTIONS.find(item => item.id === 'ortofotos');

    expect(section?.title).toBe('ORTOFOTOS');
    expect(section?.requiresAuth).toBeUndefined();
    expect(section?.items.map(item => item.id)).toEqual(
      ORTOFOTOS_LAYER_CONFIGS.map(layer => layer.itemId)
    );
    expect(section?.items).toHaveLength(21);
    expect(section?.items.every(item => item.type === 'layer' && !item.visible)).toBe(true);
    expect(ORTOFOTOS_LAYER_CONFIGS.find(layer => layer.itemId === 'ortofoto-casma')?.subLayerId)
      .toBe(0);
  });

  it('no repite ids entre las capas disponibles', () => {
    const conteo = new Map<string, number>();
    for (const layer of capasDelPanel()) {
      conteo.set(layer.id, (conteo.get(layer.id) ?? 0) + 1);
    }
    expect([...conteo.entries()].filter(([, n]) => n > 1)).toEqual([]);
  });
});