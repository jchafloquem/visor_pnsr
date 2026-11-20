import { LAYER_PANEL_SECTIONS } from './controlCapasConfig';
import type { LayerItem, SubSection } from './geoLayers';
import { ORTOFOTO_YEARS } from './ortofotos';
import { VIVIENDAS_RURALES_LAYER_CONFIGS } from './controlCapasConfig';

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
 *     ArcGIS REST y ortofotos XYZ.
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

  it('mantiene visibles por defecto las capas ArcGIS disponibles', () => {
    expect(capasDelPanel().filter(l => l.visible).map(l => l.id)).toEqual([
      'limites-peru',
      ...VIVIENDAS_RURALES_LAYER_CONFIGS.map(layer => layer.itemId),
    ]);
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
      'imaAereas',
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
  const ortofotos = (): LayerItem[] => capasDelPanel().filter(l => l.id.startsWith('ortofoto_'));

  it('solo publica capas ArcGIS REST y ortofotos XYZ', () => {
    const idsArcGis = new Set([
      'limites-peru',
      ...VIVIENDAS_RURALES_LAYER_CONFIGS.map(layer => layer.itemId),
    ]);
    expect(capasDelPanel().every(layer => idsArcGis.has(layer.id) || layer.id.startsWith('ortofoto_')))
      .toBe(true);
    expect(capasDelPanel().some(layer => layer.id === 'limites-peru')).toBe(true);
    expect(capasDelPanel().filter(layer => idsArcGis.has(layer.id))).toHaveLength(
      idsArcGis.size
    );
    expect(ortofotos()).toHaveLength(ORTOFOTO_YEARS.length);
  });

  it('no repite ids entre las capas disponibles', () => {
    const conteo = new Map<string, number>();
    for (const layer of capasDelPanel()) {
      conteo.set(layer.id, (conteo.get(layer.id) ?? 0) + 1);
    }
    expect([...conteo.entries()].filter(([, n]) => n > 1)).toEqual([]);
  });
});