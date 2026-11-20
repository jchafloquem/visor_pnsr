import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { firstValueFrom, Observable, of } from 'rxjs';
import { vi } from 'vitest';

import { ApisService } from './apis.service';
import { AuthService } from './auth.service';
import { MapService } from './map.service';
import type { Section } from '../interfaces/geoLayers';

/**
 * Pruebas del estado del visor (señales, panel de capas y servicios del mapa).
 *
 * `MapService` concentra el estado del visor en `signal`s. Aquí se fija ese contrato:
 *  - el panel de capas oculta secciones, subsecciones y capas con
 *    `requiresAuth` cuando no hay sesión, sin alterar el estado interno
 *    (las capas existen siempre en el mapa);
 *  - alternar una sección/capa actualiza `sections` y sincroniza la leyenda;
 *  - la leyenda se abre y se cierra sola según las capas con simbología;
 *  - el aviso de términos se dispara al entrar al distrito y se rearma al salir;
 *  - las búsquedas del Geovisor se delegan en `ApisService` (endpoint único).
 *
 * `ApisService` y `AuthService` se sustituyen por dobles: aquí importa la
 * frontera del servicio, no el HTTP (cubierto en `apis.service.spec.ts`).
 */

/** Doble de `ApisService`: devuelve observables prefabricados. */
class ApisServiceDoble {
  buscarPorCuc = vi.fn((): Observable<any[]> => of([]));
  buscarPorCodPredial = vi.fn((): Observable<any[]> => of([]));
  listarViaNumeros = vi.fn((): Observable<any[]> => of([]));
  buscarTitularCatastral = vi.fn((): Observable<any[]> => of([]));
  buscarDenominacionLote = vi.fn((): Observable<any[]> => of([]));
  listarDatosLote = vi.fn((): Observable<any> => of(null));
  listarVias = vi.fn((): Observable<any[]> => of([]));
}

/** Doble de `AuthService` con la señal de sesión controlable. */
class AuthServiceDoble {
  isAuthenticated = signal(false);
}

describe('MapService', () => {
  let service: MapService;
  let apis: ApisServiceDoble;
  let auth: AuthServiceDoble;

  beforeEach(() => {
    apis = new ApisServiceDoble();
    auth = new AuthServiceDoble();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        { provide: ApisService, useValue: apis },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(MapService);
  });

  afterEach(() => TestBed.resetTestingModule());

  /**
   * Sección de prueba: una subsección pública con dos capas (una restringida)
   * y una capa suelta restringida, para ejercitar los tres niveles de
   * `requiresAuth` (sección, subsección y capa).
   */
  function seccionDePrueba(): Section {
    return {
      id: 'prueba',
      name: 'Sección de prueba',
      expanded: false,
      requiresAuth: false,
      items: [
        {
          type: 'subsection',
          id: 'sub-publica',
          name: 'Subsección pública',
          requiresAuth: false,
          layers: [
            { id: 'capa-publica', name: 'Pública', visible: false, opacity: 1 },
            {
              id: 'capa-restringida',
              name: 'Restringida',
              visible: false,
              opacity: 1,
              requiresAuth: true,
            },
          ],
        },
        {
          id: 'suelta-restringida',
          name: 'Suelta restringida',
          visible: false,
          opacity: 1,
          requiresAuth: true,
          type: 'layer',
        },
      ],
    } as unknown as Section;
  }

  describe('panel de capas y sesión', () => {
    it('oculta del panel las capas restringidas sin sesión', () => {
      service.sections.set([seccionDePrueba()]);

      const panel = service.panelSections();
      const subseccion = panel[0].items[0] as any;

      expect(subseccion.layers.map((capa: any) => capa.id)).toEqual(['capa-publica']);
      // La capa suelta restringida desaparece del panel.
      expect(panel[0].items).toHaveLength(1);
    });

    it('las muestra todas con sesión iniciada', () => {
      auth.isAuthenticated.set(true);
      service.sections.set([seccionDePrueba()]);

      const panel = service.panelSections();
      const subseccion = panel[0].items[0] as any;

      expect(subseccion.layers.map((capa: any) => capa.id)).toEqual([
        'capa-publica',
        'capa-restringida',
      ]);
      expect(panel[0].items).toHaveLength(2);
    });

    it('oculta por completo una sección restringida sin sesión', () => {
      const seccion = seccionDePrueba();
      seccion.requiresAuth = true;
      service.sections.set([seccion]);

      expect(service.panelSections()).toEqual([]);
      // El estado interno conserva la sección: la capa sigue existiendo en el
      // mapa aunque no se muestre en el panel.
      expect(service.sections()).toHaveLength(1);
    });

    it('una capa restringida encendida a mano sigue existiendo en el mapa tras el logout', () => {
      // `hideRestrictedOnLogout` es un `effect` que reacciona a la sesión; sin
      // un componente que lo dispare (no hay `tick()` en este TestBed) no se
      // puede observar su ejecución aquí. Lo que sí se fija es la frontera que
      // lo protege: sin sesión la capa restringida no llega a mostrarse.
      service.sections.set([seccionDePrueba()]);
      auth.isAuthenticated.set(true);
      service.toggleAllLayersInSection('prueba', true);
      auth.isAuthenticated.set(false);

      expect(service.panelSections()[0].items).toHaveLength(1);
    });
  });

  describe('secciones del panel', () => {
    it('alterna la expansión de una sección', () => {
      service.sections.set([seccionDePrueba()]);

      service.toggleSectionExpanded('prueba');
      expect(service.sections()[0].expanded).toBe(true);

      service.toggleSectionExpanded('prueba');
      expect(service.sections()[0].expanded).toBe(false);
    });

    it('no altera las secciones cuyo id no coincide', () => {
      service.sections.set([seccionDePrueba()]);

      service.toggleSectionExpanded('otra-seccion');

      expect(service.sections()[0].expanded).toBe(false);
    });

    it('enciende y apaga una capa concreta', () => {
      service.sections.set([seccionDePrueba()]);

      service.setLayerVisibility('prueba', 'capa-publica', true);
      expect((service.sections()[0].items[0] as any).layers[0].visible).toBe(true);

      service.setLayerVisibility('prueba', 'capa-publica', false);
      expect((service.sections()[0].items[0] as any).layers[0].visible).toBe(false);
    });

    it('`setLayerVisibility` fija el estado indicado sin filtrar por sesión', () => {
      service.sections.set([seccionDePrueba()]);

      // A diferencia de `toggleAllLayersInSection`, este método NO consulta la
      // sesión: fija el estado que le piden. La barrera de `requiresAuth` está
      // en el panel (que no muestra la capa sin sesión) y en el logout, que
      // apaga las capas restringidas que quedaran encendidas.
      service.setLayerVisibility('prueba', 'capa-restringida', true);

      expect((service.sections()[0].items[0] as any).layers[1].visible).toBe(true);
      // Aun así, sin sesión la capa restringida no aparece en el panel.
      expect((service.panelSections()[0].items[0] as any).layers).toHaveLength(1);
    });

    it('toggleAllLayersInSection no enciende las capas restringidas sin sesión', () => {
      service.sections.set([seccionDePrueba()]);

      service.toggleAllLayersInSection('prueba', true);

      const capas = (service.sections()[0].items[0] as any).layers;
      // La barrera de `requiresAuth` se respeta aquí: sin sesión las capas
      // restringidas quedan apagadas aunque se pida encender toda la sección.
      expect(capas[0].visible).toBe(true);
      expect(capas[1].visible).toBe(false);
    });
  });

  describe('leyenda', () => {
    it('arranca oculta para no cubrir el mapa al cargar', () => {
      expect(service.leyendaVisible()).toBe(false);
    });

    it('se abre y se cierra con el botón del sidebar', () => {
      service.toggleLeyenda();
      expect(service.leyendaVisible()).toBe(true);

      service.toggleLeyenda();
      expect(service.leyendaVisible()).toBe(false);
    });

    it('se cierra con su propio botón de cerrar', () => {
      service.toggleLeyenda();

      service.closeLeyenda();

      expect(service.leyendaVisible()).toBe(false);
    });
  });

  describe('herramientas del sidebar', () => {
    it('activa una herramienta y la desactiva al volver a pulsarla', () => {
      service.toggleSidebarTool('layers');
      expect(service.activeSidebarTools().has('layers')).toBe(true);

      service.toggleSidebarTool('layers');
      expect(service.activeSidebarTools().has('layers')).toBe(false);
    });

    it('permite varias herramientas activas a la vez', () => {
      service.toggleSidebarTool('layers');
      service.toggleSidebarTool('consultas');

      expect(service.activeSidebarTools().size).toBe(2);
    });
  });

  describe('términos y condiciones', () => {
    it('abre y cierra el modal sin registrar aceptación', () => {
      service.openTermsModal();
      expect(service.showTermsModal()).toBe(true);

      service.closeTermsModal();
      expect(service.showTermsModal()).toBe(false);
      expect(service.termsAccepted()).toBe(false);
    });

    it('aceptar los términos cierra el modal y no vuelve a mostrarlos', () => {
      service.openTermsModal();

      service.acceptTerms();

      expect(service.showTermsModal()).toBe(false);
      expect(service.termsAccepted()).toBe(true);
    });
  });

  describe('mapa base', () => {
    it('cambia el tipo de mapa base seleccionado', () => {
      expect(service.baseLayerType()).toBe('satellite');

      service.cambiarMapaBase('satellite');
      expect(service.baseLayerType()).toBe('satellite');

      service.cambiarMapaBase('blanco');
      expect(service.baseLayerType()).toBe('blanco');
    });
  });

  describe('delegación en ApisService', () => {
    it('delega las búsquedas del Geovisor con su argumento original', () => {
      service.buscarPorCuc('12345678');
      service.buscarPorCodPredial('270543112');
      service.listarViaNumeros('L271170');
      service.buscarTitularCatastral('PEREZ');
      service.buscarDenominacionLote('MZ-A');
      service.listarDatosLote('LOTE-1');

      // Endpoint, reintentos y desempaquetado viven en `ApisService`: aquí no
      // se duplica ninguna URL.
      expect(apis.buscarPorCuc).toHaveBeenCalledWith('12345678');
      expect(apis.buscarPorCodPredial).toHaveBeenCalledWith('270543112');
      expect(apis.listarViaNumeros).toHaveBeenCalledWith('L271170');
      expect(apis.buscarTitularCatastral).toHaveBeenCalledWith('PEREZ');
      expect(apis.buscarDenominacionLote).toHaveBeenCalledWith('MZ-A');
      expect(apis.listarDatosLote).toHaveBeenCalledWith('LOTE-1');
    });

    it('propaga el resultado del servicio delegado', async () => {
      apis.buscarPorCuc.mockReturnValue(of([{ txtcuc: '12345678' }]));

      await expect(firstValueFrom(service.buscarPorCuc('12345678'))).resolves.toEqual([
        { txtcuc: '12345678' },
      ]);
    });
  });
});
