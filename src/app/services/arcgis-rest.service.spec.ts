import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { get as getProjection } from 'ol/proj';
import { firstValueFrom } from 'rxjs';

import {
  ArcGISRestService,
  VIVIENDAS_RURALES_FEATURE_SERVER_URL,
} from './arcgis-rest.service';

describe('ArcGISRestService', () => {
  let service: ArcGISRestService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(ArcGISRestService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('reads ArcGIS REST service metadata as JSON', async () => {
    const result = firstValueFrom(service.getServiceMetadata('https://gis.example.test/MapServer/'));
    const request = httpMock.expectOne(req =>
      req.url === 'https://gis.example.test/MapServer' && req.params.get('f') === 'json'
    );

    request.flush({ currentVersion: 11.2, layers: [{ id: 0, name: 'Parcels' }] });

    await expect(result).resolves.toMatchObject({
      currentVersion: 11.2,
      layers: [{ id: 0, name: 'Parcels' }],
    });
  });

  it('queries a layer and passes the requested ArcGIS parameters', async () => {
    const result = firstValueFrom(service.queryFeatures<{ OBJECTID: number }>(
      'https://gis.example.test/FeatureServer',
      2,
      { where: 'OBJECTID = 5', outFields: ['OBJECTID'], returnGeometry: false }
    ));
    const request = httpMock.expectOne(req =>
      req.url === 'https://gis.example.test/FeatureServer/2/query'
    );

    expect(request.request.params.get('f')).toBe('json');
    expect(request.request.params.get('where')).toBe('OBJECTID = 5');
    expect(request.request.params.get('outFields')).toBe('OBJECTID');
    expect(request.request.params.get('returnGeometry')).toBe('false');
    request.flush({ features: [{ attributes: { OBJECTID: 5 } }] });

    await expect(result).resolves.toMatchObject({
      features: [{ attributes: { OBJECTID: 5 } }],
    });
  });

  it('creates a Viviendas Rurales layer that requests features by visible extent', async () => {
    const layer = service.createViviendasRuralesLayer(1, {
      title: 'Viviendas con acceso a agua',
      color: '#16803c',
      zIndex: 20,
    });
    const source = layer.getSource()!;
    const projection = getProjection('EPSG:3857')!;

    expect(layer.getMinZoom()).toBeLessThan(4);
    source.loadFeatures([100, 200, 300, 400], 10, projection);

    const countRequest = httpMock.expectOne(req =>
      req.url === `${VIVIENDAS_RURALES_FEATURE_SERVER_URL}/1/query`
    );
    expect(countRequest.request.params.get('returnCountOnly')).toBe('true');
    expect(countRequest.request.params.get('resultRecordCount')).toBeNull();
    expect(countRequest.request.params.get('geometryType')).toBe('esriGeometryEnvelope');
    expect(countRequest.request.params.get('spatialRel')).toBe('esriSpatialRelIntersects');
    expect(countRequest.request.params.get('inSR')).toBe('3857');
    expect(countRequest.request.params.get('outSR')).toBe('3857');
    expect(JSON.parse(countRequest.request.params.get('geometry')!)).toMatchObject({
      xmin: 100,
      ymin: 200,
      xmax: 300,
      ymax: 400,
      spatialReference: { wkid: 3857 },
    });
    countRequest.flush({ count: 1001 });
    await new Promise(resolve => setTimeout(resolve, 0));

    const pages = [0, 250, 501].map(offset => httpMock.expectOne(req =>
      req.url === `${VIVIENDAS_RURALES_FEATURE_SERVER_URL}/1/query` &&
      req.params.get('resultOffset') === String(offset)
    ));
    pages.forEach((request, index) => {
      expect(request.request.params.get('resultRecordCount')).toBe('500');
      expect(request.request.params.get('orderByFields')).toBe('OBJECTID ASC');
      expect(request.request.params.get('outFields')).toBe('OBJECTID');
      request.flush({
        objectIdFieldName: 'OBJECTID',
        features: [{
          attributes: { OBJECTID: 10 + index },
          geometry: { x: 150 + index, y: 250 + index },
        }],
      });
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(source.getFeatures()).toHaveLength(3);
    expect(source.getFeatures()[0].getId()).toBe(10);
  });

  it('distributes national-scale requests across the visible extent', async () => {
    const layer = service.createViviendasRuralesLayer(1, {
      title: 'Viviendas con acceso a agua',
      color: '#16803c',
      zIndex: 20,
    });
    const source = layer.getSource()!;
    const projection = getProjection('EPSG:3857')!;

    source.loadFeatures([100, 200, 300, 400], 2445, projection);

    const requests = httpMock.match(req =>
      req.url === `${VIVIENDAS_RURALES_FEATURE_SERVER_URL}/1/query`
    );
    expect(requests).toHaveLength(4);
    const expectedExtents = [
      [100, 200, 200, 300],
      [200, 200, 300, 300],
      [100, 300, 200, 400],
      [200, 300, 300, 400],
    ];
    requests.forEach((request, index) => {
      const geometry = JSON.parse(request.request.params.get('geometry')!);
      expect([geometry.xmin, geometry.ymin, geometry.xmax, geometry.ymax])
        .toEqual(expectedExtents[index]);
      expect(request.request.params.get('resultRecordCount')).toBe('500');
      request.flush({
        objectIdFieldName: 'OBJECTID',
        features: [{
          attributes: { OBJECTID: index + 1 },
          geometry: { x: 150 + index, y: 250 + index },
        }],
      });
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(source.getFeatures()).toHaveLength(4);
  });

  it('exposes the Viviendas Rurales service for bounded test queries', async () => {
    const metadata = firstValueFrom(service.getViviendasRuralesMetadata());
    const metadataRequest = httpMock.expectOne(req =>
      req.url === VIVIENDAS_RURALES_FEATURE_SERVER_URL && req.params.get('f') === 'json'
    );
    metadataRequest.flush({ layers: [{ id: 1, name: 'Con Acceso' }] });
    await expect(metadata).resolves.toMatchObject({
      layers: [{ id: 1, name: 'Con Acceso' }],
    });

    const features = firstValueFrom(service.queryViviendasRurales<{ OBJECTID: number }>(1));
    const queryRequest = httpMock.expectOne(req =>
      req.url === `${VIVIENDAS_RURALES_FEATURE_SERVER_URL}/1/query`
    );
    expect(queryRequest.request.params.get('resultRecordCount')).toBe('100');
    expect(queryRequest.request.params.get('where')).toBe('1=1');
    queryRequest.flush({ features: [{ attributes: { OBJECTID: 1 } }] });
    await expect(features).resolves.toMatchObject({
      features: [{ attributes: { OBJECTID: 1 } }],
    });
  });

  it('creates a tiled source for display in OpenLayers', () => {
    const source = service.createTileSource(
      'https://gis.example.test/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 }
    );

    expect(source.getUrls()?.[0]).toContain('/MapServer/tile/{z}/{y}/{x}');
    expect(source.getTileGrid()?.getMaxZoom()).toBe(19);
  });
});
