import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';

import { AuthSgpiService } from '@services/auth-sgpi.service';
import { ProjectDataService } from '@services/project-data.service';
import {
  Proyecto,
  Riesgo,
  ProbabilidadNivelOSCE,
  ImpactoNivelOSCE,
  EstrategiaRespuestaRiesgo,
} from '@app/components/projects/interfaces/project.interface';
import {
  calcularRiesgoOSCE,
  formularIdentificacionRiesgo,
} from '@app/components/projects/utils/project.utils';

export interface DashboardKpis {
  totalProyectos: number;
  inversionTotal: number;
  proyectosCriticos: number;
  alertasRiesgo: number;
}

@Injectable({ providedIn: 'root' })
export class ApiSgpiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthSgpiService);
  private readonly projectData = inject(ProjectDataService);

  private readonly baseUrl = '/api/sgpi';

  // ── Headers ──────────────────────────────────────────────────────────
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.auth.token()}`,
      'Content-Type': 'application/json',
    });
  }

  // ── Proyectos ────────────────────────────────────────────────────────
  getProyectos(): Observable<Proyecto[]> {
    return of(this.projectData.proyectos()).pipe(delay(300));
  }

  getProyecto(cui: string): Observable<Proyecto | undefined> {
    return of(this.projectData.getProyecto(cui)).pipe(delay(200));
  }

  // ── Dashboard KPIs ──────────────────────────────────────────────────
  getDashboardKpis(): Observable<DashboardKpis> {
    const proyectos = this.projectData.proyectos();

    const totalProyectos = proyectos.length;

    const inversionTotal = proyectos.reduce(
      (sum, p) => sum + p.costoInversion,
      0,
    );

    const proyectosCriticos = proyectos.filter(
      (p) => p.avanceFisicoReal < p.avanceFisicoProgramado * 0.8,
    ).length;

    const alertasRiesgo = proyectos.reduce(
      (count, p) =>
        count +
        (p.riesgos || []).filter((r) => r.prioridad === 'ALTA').length,
      0,
    );

    const kpis: DashboardKpis = {
      totalProyectos,
      inversionTotal,
      proyectosCriticos,
      alertasRiesgo,
    };

    return of(kpis).pipe(delay(300));
  }

  // ── Registrar riesgo ────────────────────────────────────────────────
  registrarRiesgo(
    cui: string,
    riesgoData: {
      categoria: string;
      causa: string;
      evento: string;
      consecuencia: string;
      probabilidadNivel: string;
      impactoNivel: string;
      estrategiaRespuesta: string;
    },
  ): Observable<{ success: boolean; message: string }> {
    const evaluacion = calcularRiesgoOSCE(
      riesgoData.probabilidadNivel as ProbabilidadNivelOSCE,
      riesgoData.impactoNivel as ImpactoNivelOSCE,
    );

    const identificacionCompleta = formularIdentificacionRiesgo(
      riesgoData.causa,
      riesgoData.evento,
      riesgoData.consecuencia,
    );

    const nuevoRiesgo: Riesgo = {
      id: `R-${Date.now()}`,
      categoria: riesgoData.categoria,
      causa: riesgoData.causa,
      evento: riesgoData.evento,
      consecuencia: riesgoData.consecuencia,
      identificacionCompleta,
      probabilidadNivel: evaluacion.probabilidadNivel,
      probabilidadValor: evaluacion.probabilidadValor,
      impactoNivel: evaluacion.impactoNivel,
      impactoValor: evaluacion.impactoValor,
      puntuacion: evaluacion.resultado,
      prioridad: evaluacion.prioridad,
      estrategiaRespuesta:
        riesgoData.estrategiaRespuesta as EstrategiaRespuestaRiesgo,
      probabilidad: evaluacion.probabilidadValor,
      impacto: evaluacion.impactoValor,
      acciones: [],
    };

    this.projectData.addRiesgo(cui, nuevoRiesgo);

    return of({ success: true, message: 'Riesgo registrado correctamente' }).pipe(
      delay(300),
    );
  }
}
