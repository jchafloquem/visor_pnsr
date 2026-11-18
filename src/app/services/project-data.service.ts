import { Injectable, signal } from '@angular/core';
import {
  Proyecto,
  Riesgo,
  AccionMitigacion,
} from '@app/components/projects/interfaces/project.interface';
import { MOCK_PROJECTS } from '@app/components/projects/mock/mock-projects';

export interface ProjectFilters {
  departamento?: string;
  cartera?: 'UTP' | 'PIASAR' | 'Amazonia Rural';
  priorizado2026?: boolean;
  estadoAdministrativo?: string;
  busqueda?: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectDataService {
  readonly proyectos = signal<Proyecto[]>(MOCK_PROJECTS);

  getProyecto(cui: string): Proyecto | undefined {
    return this.proyectos().find((p) => p.cui === cui);
  }

  addProyecto(proyecto: Proyecto): void {
    this.proyectos.update((list) => [proyecto, ...list]);
  }

  updateProyecto(proyecto: Proyecto): void {
    this.proyectos.update((list) =>
      list.map((p) => (p.cui === proyecto.cui ? proyecto : p)),
    );
  }

  addRiesgo(cui: string, riesgo: Riesgo): void {
    this.proyectos.update((list) =>
      list.map((p) => {
        if (p.cui === cui) {
          return { ...p, riesgos: [...(p.riesgos || []), riesgo] };
        }
        return p;
      }),
    );
  }

  updateRiesgo(cui: string, riesgo: Riesgo): void {
    this.proyectos.update((list) =>
      list.map((p) => {
        if (p.cui === cui) {
          return {
            ...p,
            riesgos: (p.riesgos || []).map((r) =>
              r.id === riesgo.id ? riesgo : r,
            ),
          };
        }
        return p;
      }),
    );
  }

  addAccionMitigacion(
    cui: string,
    riesgoId: string,
    accion: AccionMitigacion,
  ): void {
    this.proyectos.update((list) =>
      list.map((p) => {
        if (p.cui === cui) {
          return {
            ...p,
            riesgos: (p.riesgos || []).map((r) => {
              if (r.id === riesgoId) {
                return { ...r, acciones: [...(r.acciones || []), accion] };
              }
              return r;
            }),
          };
        }
        return p;
      }),
    );
  }

  atenderRiesgo(
    cui: string,
    riesgoId: string,
    descripcion: string,
    evidencia: string,
  ): void {
    this.proyectos.update((list) =>
      list.map((p) => {
        if (p.cui === cui) {
          return {
            ...p,
            riesgos: (p.riesgos || []).map((r) => {
              if (r.id === riesgoId) {
                return {
                  ...r,
                  estado: 'ATENDIDO',
                  atencionDescripcion: descripcion.trim(),
                  atencionEvidencia: evidencia.trim(),
                  fechaAtencion: new Date(),
                };
              }
              return r;
            }),
          };
        }
        return p;
      }),
    );
  }

  getProyectosByCriteria(filters: ProjectFilters): Proyecto[] {
    let resultado = this.proyectos();

    if (filters.departamento) {
      resultado = resultado.filter(
        (p) => p.departamento === filters.departamento,
      );
    }

    if (filters.cartera) {
      resultado = resultado.filter((p) => p.cartera === filters.cartera);
    }

    if (filters.priorizado2026 !== undefined) {
      resultado = resultado.filter(
        (p) => p.priorizado2026 === filters.priorizado2026,
      );
    }

    if (filters.estadoAdministrativo) {
      resultado = resultado.filter((p) =>
        p.estadoAdministrativo
          .toLowerCase()
          .includes(filters.estadoAdministrativo!.toLowerCase()),
      );
    }

    if (filters.busqueda) {
      const termino = filters.busqueda.toLowerCase();
      resultado = resultado.filter(
        (p) =>
          p.cui.includes(termino) ||
          p.nombre.toLowerCase().includes(termino) ||
          p.localidad.toLowerCase().includes(termino) ||
          p.contratista.toLowerCase().includes(termino),
      );
    }

    return resultado;
  }
}
