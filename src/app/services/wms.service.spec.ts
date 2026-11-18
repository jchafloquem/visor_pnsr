import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { WmsService } from './wms.service';

describe('WmsService', () => {
  let service: WmsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(WmsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('reads and parses WMS GetCapabilities', async () => {
    const result = firstValueFrom(service.getCapabilities('https://gis.example.test/geoserver/wms'));
    const request = httpMock.expectOne(req =>
      req.url === 'https://gis.example.test/geoserver/wms'
      && req.params.get('SERVICE') === 'WMS'
      && req.params.get('REQUEST') === 'GetCapabilities'
      && req.params.get('VERSION') === '1.3.0'
    );

    request.flush('<WMS_Capabilities><Capability><Layer><Name>parcels</Name></Layer></Capability></WMS_Capabilities>');

    await expect(result).resolves.toMatchObject({
      documentElement: { tagName: 'WMS_Capabilities' },
    });
  });

  it('creates a WMS image layer with the configured map layer', () => {
    const layer = service.createImageLayer({
      id: 'parcels',
      layerName: 'workspace:parcels',
      title: 'Parcels',
      zIndex: 5,
      url: 'https://gis.example.test/geoserver/wms',
      version: '1.3.0',
    });

    expect(layer.get('id')).toBe('parcels');
    expect(layer.getZIndex()).toBe(5);
    expect(layer.getSource()?.getParams()).toMatchObject({
      LAYERS: 'workspace:parcels',
      VERSION: '1.3.0',
      FORMAT: 'image/png',
    });
  });
});
