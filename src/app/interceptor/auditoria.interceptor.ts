import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { AUDITORIA_OPCIONES, AuditoriaService } from '../services/auditoria.service';

/** Prefijo de la aplicación WSGEOVISOR, que aloja los API de geovisor y seguridad. */
const PREFIJO_API = environment.geovisorApiUrl.replace(/\/api\/geovisor$/, '');
const SUFIJO_API = '/api/';

/** Parámetros de la petición como cadena, o cadena vacía si no lleva ninguno. */
function parametrosDe(req: { params: { toString(): string } }): string {
  return req.params.toString();
}

/** Audita las consultas del visor al API del WSGEOVISOR. */
export const auditoriaInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${PREFIJO_API}${SUFIJO_API}`)) return next(req);
  // La auditoría no se audita a sí misma (si no, cada registro generaría otro).
  if (req.url.startsWith(`${environment.seguridadApiUrl}/auditoria/`)) return next(req);
  // El login tampoco pasa por aquí: `AuthService.iniciarSesion` ya emite su
  // propio evento `SESION` con el usuario correcto. El interceptor lo registraría
  // ADEMÁS y en el momento equivocado: su `tap` corre antes del `map` que
  // llama a `guardarSesion()`, así que todavía no hay `codigoUsuario` ni token,
  // y esa fila se guardaría como ANONIMO/visitante anónimo. Con la exclusión el
  // login deja un solo registro, ya con el login del usuario.
  if (req.url.startsWith(`${environment.seguridadApiUrl}/auth/`)) return next(req);

  const auditoria = inject(AuditoriaService);
  const inicio = performance.now();
  const opcion = AUDITORIA_OPCIONES.CONSULTA_GEOVISOR;
  const contexto = { conexionNombre: 'REST', tiempoMs: performance.now() - inicio };
  const detalle = `${req.method} ${req.url.replace(`${PREFIJO_API}${SUFIJO_API}`, '')}${
    parametrosDe(req) ? ` ${parametrosDe(req)}` : ''
  }`;

  return next(req).pipe(
    tap(respuesta => {
      // El API responde HTTP 200 también ante errores de negocio: el resultado
      // real va en `codigoRespuesta` del cuerpo (BeBaseRespuesta).
      const cuerpo = respuesta as { codigoRespuesta?: string; mensajeRespuesta?: string };
      const codigo = cuerpo?.codigoRespuesta ?? '';
      const ok = !codigo || codigo === '00';

      if (ok) {
        auditoria.accion(opcion, `${detalle} ${cuerpo?.mensajeRespuesta ?? ''}`.trim(), contexto);
      } else {
        auditoria.error(opcion, `${detalle} ${cuerpo.mensajeRespuesta ?? ''}`.trim(), contexto, codigo);
      }
    }),
    catchError((fallo: unknown) => {
      const status = (fallo as { status?: number })?.status;
      // 0 = no hubo respuesta (DNS caído, sin red, CORS); se marca como RED.
      const codigo = status ? `ERR-${status}` : 'ERR-RED';
      auditoria.error(
        opcion,
        `${detalle} → ${(fallo as { message?: string })?.message ?? 'sin respuesta'}`,
        { conexionNombre: 'REST', tiempoMs: performance.now() - inicio },
        codigo
      );
      // El error se propaga intacto: auditar no cambia el comportamiento de la app.
      return throwError(() => fallo);
    })
  );
};
