import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import {
  ArcGISRestService,
  PERU_LIMITS_MAPSERVER_URL,
  PeruAdministrativeCatalog,
} from '../../../../../../../../services/arcgis-rest.service';
import { MapService } from '../../../../../../../../services/map.service';
import { Busquedas } from './busquedas';

describe('Busquedas', () => {
  let component: Busquedas;
  let fixture: ComponentFixture<Busquedas>;
  const catalog: PeruAdministrativeCatalog = {
    departments: [{ code: '15', name: 'LIMA' }],
    provinces: [{ code: '1501', name: 'LIMA', parentCode: '15' }],
    districts: [{ code: '150101', name: 'LIMA', parentCode: '1501' }],
  };
  const getPeruAdministrativeCatalog = vi.fn(() => of(catalog));
  const geometry = {
    rings: [[[1, 2], [3, 2], [3, 4], [1, 4], [1, 2]]],
    spatialReference: { wkid: 3857 },
  };
  const queryFeatures = vi.fn(() => of({
    features: [{ attributes: { OBJECTID: 1 }, geometry }],
  }));
  const fitToEsriGeometry = vi.fn(() => true);
  const clearAdministrativeSearchHighlight = vi.fn();

  beforeEach(async () => {
    getPeruAdministrativeCatalog.mockClear();
    queryFeatures.mockClear();
    fitToEsriGeometry.mockClear();
    clearAdministrativeSearchHighlight.mockClear();

    await TestBed.configureTestingModule({
      imports: [Busquedas],
      providers: [
        {
          provide: ArcGISRestService,
          useValue: { getPeruAdministrativeCatalog, queryFeatures },
        },
        {
          provide: MapService,
          useValue: { fitToEsriGeometry, clearAdministrativeSearchHighlight },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Busquedas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('uses the preloaded administrative catalog to populate the selectors', () => {
    expect(getPeruAdministrativeCatalog).toHaveBeenCalledTimes(1);
    expect(component.departamentos).toEqual([{ code: '15', name: 'LIMA' }]);

    component.onDepartamentoChange('15');
    component.onProvinciaChange('1501');

    expect(component.provincias).toEqual([{ code: '1501', name: 'LIMA', parentCode: '15' }]);
    expect(component.distritos).toEqual([{ code: '150101', name: 'LIMA', parentCode: '1501' }]);
    expect(queryFeatures).not.toHaveBeenCalled();
  });

  it('searches by department, province or district and fits the selected extent', () => {
    component.onDepartamentoChange('15');
    component.buscar();
    expect(queryFeatures).toHaveBeenLastCalledWith(
      PERU_LIMITS_MAPSERVER_URL,
      6,
      expect.objectContaining({
        where: "id_dpto = '15'",
        outFields: ['OBJECTID'],
        returnGeometry: true,
        outSR: 3857,
      })
    );

    component.onProvinciaChange('1501');
    component.buscar();
    expect(queryFeatures).toHaveBeenLastCalledWith(
      PERU_LIMITS_MAPSERVER_URL,
      7,
      expect.objectContaining({ where: "id_prov = '1501'", returnGeometry: true })
    );

    component.onDistritoChange('150101');
    component.buscar();
    expect(queryFeatures).toHaveBeenLastCalledWith(
      PERU_LIMITS_MAPSERVER_URL,
      8,
      expect.objectContaining({
        where: "id_dist = '150101'",
        returnGeometry: true,
        outSR: 3857,
      })
    );
    expect(fitToEsriGeometry).toHaveBeenCalledTimes(3);
    expect(fitToEsriGeometry).toHaveBeenLastCalledWith(geometry);
  });

  it('shows a small clear button after a result is highlighted', () => {
    component.onDepartamentoChange('15');
    component.buscar();
    fixture.detectChanges();

    expect(component.tieneBusquedaResaltada()).toBe(true);
    const clearButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[aria-label="Limpiar resaltado de búsqueda"]'
    );
    expect(clearButton).not.toBeNull();
    clearButton.click();
    fixture.detectChanges();

    expect(clearAdministrativeSearchHighlight).toHaveBeenCalledOnce();
    expect(component.tieneBusquedaResaltada()).toBe(false);
    expect(fixture.nativeElement.querySelector(
      '[aria-label="Limpiar resaltado de búsqueda"]'
    )).toBeNull();
  });

  it('shows a validation message without querying when no department is selected', () => {
    component.buscar();

    expect(component.mensajeError).toContain('Seleccione al menos un departamento');
    expect(queryFeatures).not.toHaveBeenCalled();
    expect(fitToEsriGeometry).not.toHaveBeenCalled();
  });

  it('clears the processing state when the search request completes', () => {
    const request = new Subject<{
      features: Array<{ attributes: { OBJECTID: number }; geometry: typeof geometry }>;
    }>();
    queryFeatures.mockReturnValue(request);
    component.onDepartamentoChange('15');
    component.buscar();

    expect(component.buscando()).toBe(true);
    request.complete();

    fixture.detectChanges();
    expect(component.buscando()).toBe(false);
    expect(fixture.nativeElement.querySelector('button').textContent).not.toContain('Buscando...');
  });
});
