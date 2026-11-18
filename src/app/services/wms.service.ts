import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import ImageLayer from 'ol/layer/Image';
import ImageWMS, { type Options as ImageWMSOptions } from 'ol/source/ImageWMS';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';
import type { WmsLayerConfig } from '../interfaces/geoLayers';

@Injectable({ providedIn: 'root' })
export class WmsService {
  private readonly http = inject(HttpClient);

  getCapabilities(url: string, version = '1.3.0'): Observable<XMLDocument> {
    if (!url.trim()) {
      throw new Error('WMS service URL is required.');
    }

    const params = new HttpParams()
      .set('SERVICE', 'WMS')
      .set('REQUEST', 'GetCapabilities')
      .set('VERSION', version);

    return this.http.get(url, { params, responseType: 'text' }).pipe(
      map(xml => {
        const document = new DOMParser().parseFromString(xml, 'application/xml');
        if (
          document.querySelector('parsererror')
          || document.querySelector('ServiceExceptionReport, ExceptionReport')
        ) {
          throw new Error('WMS returned an invalid capabilities document.');
        }
        return document;
      })
    );
  }

  createImageLayer(
    options: WmsLayerConfig,
    imageLoadFunction?: ImageWMSOptions['imageLoadFunction']
  ): ImageLayer<ImageWMS> {
    const url = options.url ?? environment.geoserver.wmsUrl;
    const separator = url.includes('?') ? '&' : '?';
    const wmsUrl = options.tiled ? `${url}${separator}tiled=true` : url;
    const source = new ImageWMS({
      url: wmsUrl,
      params: {
        'LAYERS': options.layerName,
        'TILED': true,
        'VERSION': options.version ?? '1.1.0',
        'FORMAT': 'image/png',
        'TRANSPARENT': true,
      },
      crossOrigin: 'anonymous',
      serverType: 'geoserver',
      imageLoadFunction,
    });

    return new ImageLayer({
      source,
      className: options.className ?? options.id,
      zIndex: options.zIndex,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      properties: { id: options.id, title: options.title },
    });
  }
}
