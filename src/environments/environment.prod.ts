import { crearEnvironment } from './environment.model';

/**
 * Ambiente de PRODUCCIÓN.
 * Se selecciona con `ng build -c production` o `npm run build:prod`
 * (fileReplacements en angular.json sustituye environment.ts por este archivo).
 */
export const environment = crearEnvironment({
  production: true,
  ambiente: 'Producción',
  portalUrl: 'https://munisanisidro.gob.pe',
  geoserverUrl: 'https://geomapas.munisanisidro.gob.pe/geoserver'
});
