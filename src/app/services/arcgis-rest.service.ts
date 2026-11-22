import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import EsriJSON from 'ol/format/EsriJSON';
import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import { bbox } from 'ol/loadingstrategy';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import { get as getProjection } from 'ol/proj';
import ImageArcGISRest from 'ol/source/ImageArcGISRest';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import VectorSource from 'ol/source/Vector';
import XYZ, { type Options as XYZOptions } from 'ol/source/XYZ';
import { Observable, firstValueFrom, map } from 'rxjs';

export const VIVIENDAS_RURALES_FEATURE_SERVER_URL =
  'https://portalgis.vivienda.gob.pe/servergis/rest/services/OGEI/Viviendas_Rurales/FeatureServer';
export const PERU_LIMITS_MAPSERVER_URL =
  'https://portalgis.vivienda.gob.pe/servergis/rest/services/Limites_Peru/MapServer';
export const COEN_FEN_2027_MAPSERVER_URL =
  'https://sigrid.cenepred.gob.pe/arcgis/rest/services/sectores/COEN_FEN_2027/MapServer';
export const IDEP_IMAGENES_MAPSERVER_URL =
  'https://www.idep.gob.pe/geoportal/rest/services/IMAGENES';
export const VIVIENDAS_RURALES_COARSE_RESOLUTION = 1200;

export interface ArcGISRestError {
  code: number;
  message: string;
  details?: string[];
}

export interface ArcGISServiceMetadata {
  currentVersion?: number;
  serviceDescription?: string;
  layers?: Array<{ id: number; name: string; type?: string }>;
  error?: ArcGISRestError;
  [key: string]: unknown;
}

export interface ArcGISMapServerLegendResponse {
  layers?: Array<{
    layerId?: number;
    layerName: string;
    legend?: Array<{
      label?: string;
      imageData?: string;
      contentType?: string;
    }>;
  }>;
  error?: ArcGISRestError;
}

export interface ArcGISFeatureSet<T> {
  features?: Array<{
    attributes: T;
    geometry?: Record<string, unknown>;
  }>;
  objectIdFieldName?: string;
  fields?: Array<{ name: string; type: string; alias?: string }>;
  count?: number;
  error?: ArcGISRestError;
}

export interface ArcGISQueryOptions {
  where?: string;
  outFields?: string | string[];
  returnGeometry?: boolean;
  outSR?: number;
  resultRecordCount?: number;
  resultOffset?: number;
  orderByFields?: string;
  returnCountOnly?: boolean;
  geometry?: string;
  geometryType?: string;
  inSR?: number;
  spatialRel?: string;
}

export interface ViviendasRuralesLayerOptions {
  title: string;
  color: string;
  zIndex: number;
}

export interface ArcGISMapServerLayerOptions {
  title: string;
  zIndex: number;
  subLayerId?: number;
  visible?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ArcGISRestService {
  private readonly http = inject(HttpClient);

  getServiceMetadata(url: string): Observable<ArcGISServiceMetadata> {
    const serviceUrl = this.normalizeUrl(url);
    const params = new HttpParams().set('f', 'json');

    return this.http.get<ArcGISServiceMetadata>(serviceUrl, { params }).pipe(
      map(response => this.assertSuccess(response))
    );
  }

  getMapServerLegend(serviceUrl: string): Observable<ArcGISMapServerLegendResponse> {
    const url = `${this.normalizeUrl(serviceUrl)}/legend`;
    const params = new HttpParams().set('f', 'json');

    return this.http.get<ArcGISMapServerLegendResponse>(url, { params }).pipe(
      map(response => this.assertSuccess(response))
    );
  }

  getViviendasRuralesMetadata(): Observable<ArcGISServiceMetadata> {
    return this.getServiceMetadata(VIVIENDAS_RURALES_FEATURE_SERVER_URL);
  }

  queryViviendasRurales<T extends Record<string, unknown>>(
    layerId: number,
    options: ArcGISQueryOptions = {}
  ): Observable<ArcGISFeatureSet<T>> {
    return this.queryFeatures<T>(VIVIENDAS_RURALES_FEATURE_SERVER_URL, layerId, {
      resultRecordCount: options.returnCountOnly ? undefined : 100,
      ...options,
    });
  }

  queryFeatures<T extends Record<string, unknown>>(
    serviceUrl: string,
    layerId: number,
    options: ArcGISQueryOptions = {}
  ): Observable<ArcGISFeatureSet<T>> {
    if (!Number.isInteger(layerId) || layerId < 0) {
      throw new Error('ArcGIS REST layerId must be a non-negative integer.');
    }

    let params = new HttpParams()
      .set('f', 'json')
      .set('where', options.where ?? '1=1')
      .set('outFields', Array.isArray(options.outFields) ? options.outFields.join(',') : options.outFields ?? '*')
      .set('returnGeometry', String(options.returnGeometry ?? true));
    if (options.outSR !== undefined) {
      params = params.set('outSR', String(options.outSR));
    }
    if (options.resultRecordCount !== undefined) {
      params = params.set('resultRecordCount', String(options.resultRecordCount));
    }
    if (options.resultOffset !== undefined) {
      params = params.set('resultOffset', String(options.resultOffset));
    }
    if (options.orderByFields !== undefined) {
      params = params.set('orderByFields', options.orderByFields);
    }
    if (options.returnCountOnly !== undefined) {
      params = params.set('returnCountOnly', String(options.returnCountOnly));
    }
    if (options.geometry !== undefined) {
      params = params.set('geometry', options.geometry);
    }
    if (options.geometryType !== undefined) {
      params = params.set('geometryType', options.geometryType);
    }
    if (options.inSR !== undefined) {
      params = params.set('inSR', String(options.inSR));
    }
    if (options.spatialRel !== undefined) {
      params = params.set('spatialRel', options.spatialRel);
    }

    const url = `${this.normalizeUrl(serviceUrl)}/${layerId}/query`;
    return this.http.get<ArcGISFeatureSet<T>>(url, { params }).pipe(
      map(response => this.assertSuccess(response))
    );
  }

  createViviendasRuralesLayer(
    layerId: number,
    options: ViviendasRuralesLayerOptions
  ): VectorLayer<VectorSource<Feature<Geometry>>> {
    const format = new EsriJSON();
    let source: VectorSource<Feature<Geometry>>;
    source = new VectorSource<Feature<Geometry>>({
      strategy: bbox,
      loader: async (extent, resolution, projection) => {
        const wkid = this.getProjectionWkid(projection.getCode());
        try {
          const spatialQueryForExtent = (queryExtent: number[]) => ({
            outFields: 'OBJECTID',
            returnGeometry: true,
            geometry: JSON.stringify({
              xmin: queryExtent[0],
              ymin: queryExtent[1],
              xmax: queryExtent[2],
              ymax: queryExtent[3],
              spatialReference: { wkid },
            }),
            geometryType: 'esriGeometryEnvelope',
            inSR: wkid,
            outSR: wkid,
            spatialRel: 'esriSpatialRelIntersects',
          });
          let responses: ArcGISFeatureSet<Record<string, unknown>>[];
          if (resolution >= VIVIENDAS_RURALES_COARSE_RESOLUTION) {
            const quadrants = this.splitExtentIntoQuadrants(extent);
            responses = await Promise.all(quadrants.map(queryExtent =>
              firstValueFrom(this.queryViviendasRurales<Record<string, unknown>>(
                layerId,
                { ...spatialQueryForExtent(queryExtent), resultRecordCount: 500 }
              ))
            ));
          } else {
            const spatialQuery = spatialQueryForExtent(extent);
            const countResponse = await firstValueFrom(
              this.queryViviendasRurales<Record<string, unknown>>(layerId, {
                ...spatialQuery,
                returnGeometry: false,
                returnCountOnly: true,
              })
            );
            const count = countResponse.count ?? 0;
            if (count === 0) return [];

            const pageSize = 500;
            const pageCount = Math.min(3, Math.ceil(count / pageSize));
            const lastOffset = Math.max(count - pageSize, 0);
            const offsets = Array.from({ length: pageCount }, (_, index) =>
              pageCount === 1
                ? 0
                : Math.floor(index * lastOffset / (pageCount - 1))
            );
            responses = await Promise.all(offsets.map(resultOffset =>
              firstValueFrom(this.queryViviendasRurales<Record<string, unknown>>(layerId, {
                ...spatialQuery,
                resultRecordCount: pageSize,
                resultOffset,
                orderByFields: 'OBJECTID ASC',
              }))
            ));
          }
          const features = responses.flatMap(response => format.readFeatures(response, {
            dataProjection: projection,
            featureProjection: projection,
          }));
          const objectIdFieldName = responses[0].objectIdFieldName ?? 'OBJECTID';
          features.forEach(feature => {
            const id = feature.get(objectIdFieldName);
            if (typeof id === 'number' || typeof id === 'string') {
              feature.setId(id);
            }
          });
          source.addFeatures(features);
          return features;
        } catch (error) {
          console.error(`No se pudieron cargar las viviendas rurales de la capa ${layerId}.`, error);
          throw error;
        }
      },
    });

    return new VectorLayer({
      source,
      properties: { title: options.title },
      zIndex: options.zIndex,
      style: new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: options.color }),
          stroke: new Stroke({ color: '#ffffff', width: 1 }),
        }),
      }),
    });
  }

  createTileSource(urlTemplate: string, options: Pick<
    XYZOptions,
    'maxZoom' | 'tileLoadFunction' | 'tileUrlFunction'
  > = {}): XYZ {
    if (!urlTemplate.trim()) {
      throw new Error('ArcGIS REST tile URL is required.');
    }

    return new XYZ({
      url: urlTemplate,
      crossOrigin: 'anonymous',
      transition: 1000,
      interpolate: true,
      wrapX: true,
      ...options,
    });
  }

  createMapServerLayer(
    serviceUrl: string,
    options: ArcGISMapServerLayerOptions
  ): ImageLayer<ImageArcGISRest> {
    const params = options.subLayerId === undefined
      ? undefined
      : { LAYERS: `show:${options.subLayerId}` };
    const source = new ImageArcGISRest({
      url: this.normalizeUrl(serviceUrl),
      params,
      crossOrigin: 'anonymous',
    });

    return new ImageLayer({
      source,
      properties: { title: options.title },
      zIndex: options.zIndex,
      visible: options.visible ?? true,
    });
  }

  private splitExtentIntoQuadrants(extent: number[]): [number, number, number, number][] {
    const midX = (extent[0] + extent[2]) / 2;
    const midY = (extent[1] + extent[3]) / 2;
    return [
      [extent[0], extent[1], midX, midY],
      [midX, extent[1], extent[2], midY],
      [extent[0], midY, midX, extent[3]],
      [midX, midY, extent[2], extent[3]],
    ];
  }

  private normalizeUrl(url: string): string {
    const normalized = url.trim().replace(/\/+$/, '');
    if (!normalized) {
      throw new Error('ArcGIS REST service URL is required.');
    }
    return normalized;
  }

  private getProjectionWkid(projectionCode: string): number {
    const projection = getProjection(projectionCode);
    const match = projectionCode.match(/EPSG:(\d+)$/);
    if (!projection || !match) {
      throw new Error(`Unsupported projection for ArcGIS REST query: ${projectionCode}`);
    }
    return Number(match[1]);
  }

  private assertSuccess<T extends { error?: ArcGISRestError }>(response: T): T {
    if (response.error) {
      const details = response.error.details?.filter(Boolean).join(' ');
      throw new Error(`ArcGIS REST ${response.error.code}: ${response.error.message}${details ? ` — ${details}` : ''}`);
    }
    return response;
  }
}
