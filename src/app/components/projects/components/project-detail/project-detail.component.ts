import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProjectDataService } from '@app/services/project-data.service';
import {
  Proyecto,
  Riesgo,
  Hito,
} from '@app/components/projects/interfaces/project.interface';
import {
  calcularIDA,
  obtenerSemaforoIDA,
  calcularDescalce,
  tieneDescalce,
  calcularNivelRiesgo,
  obtenerSemaforoRiesgo,
  obtenerEstadoPlazo,
  formatearMoneda,
  formatearFecha,
  formatearPorcentaje,
  formatearIDA,
  SemaforoIDAResult,
  SemaforoResult,
  EstadoPlazoResult,
} from '@app/components/projects/utils/project.utils';

export interface RiesgoResumenViewModel {
  riesgo: Riesgo;
  nivel: number;
  semaforo: SemaforoResult;
  estadoPlazo: EstadoPlazoResult | null;
  accionesCount: number;
}

import { PnsrHeaderComponent } from '@app/shared/components/pnsr-header/pnsr-header.component';
import { PnsrFooterComponent } from '@app/shared/components/pnsr-footer/pnsr-footer.component';
import { AyudaMemoriaComponent } from '../ayuda-memoria/ayuda-memoria.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, PnsrHeaderComponent, PnsrFooterComponent, AyudaMemoriaComponent],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css'],
})
export class ProjectDetailComponent implements OnInit {
  private readonly projectService = inject(ProjectDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly cui = signal<string | null>(null);
  readonly mostrarAyudaMemoria = signal<boolean>(false);
  readonly fechaGeneracion = signal<Date>(new Date());

  // Proyecto reactivo
  readonly proyecto = computed<Proyecto | undefined>(() => {
    const cuiVal = this.cui();
    if (!cuiVal) return undefined;
    return this.projectService.getProyecto(cuiVal);
  });

  // Métricas de desempeño calculadas con utilitarios
  readonly ida = computed<number>(() => {
    const p = this.proyecto();
    if (!p) return 0;
    return calcularIDA(p.avanceFisicoReal, p.avanceFisicoProgramado);
  });

  readonly semaforoIDA = computed<SemaforoIDAResult>(() => {
    return obtenerSemaforoIDA(this.ida());
  });

  readonly descalce = computed<number>(() => {
    const p = this.proyecto();
    if (!p) return 0;
    return calcularDescalce(p.avanceFinanciero, p.avanceFisicoReal);
  });

  readonly existeDescalce = computed<boolean>(() => {
    const p = this.proyecto();
    if (!p) return false;
    return tieneDescalce(p.avanceFinanciero, p.avanceFisicoReal);
  });

  readonly porcentajeDevengado = computed<number>(() => {
    const p = this.proyecto();
    if (!p || !p.costoInversion || p.costoInversion === 0) return 0;
    return Math.round((p.devengadoAcumulado / p.costoInversion) * 1000) / 10;
  });

  // Top 3 riesgos más críticos ordenados por severidad (p * i descendente)
  readonly riesgosCriticos = computed<RiesgoResumenViewModel[]>(() => {
    const p = this.proyecto();
    if (!p || !p.riesgos || p.riesgos.length === 0) return [];

    const ordenados = [...p.riesgos].sort((a, b) => {
      const scoreA = a.probabilidad * a.impacto;
      const scoreB = b.probabilidad * b.impacto;
      return scoreB - scoreA;
    });

    return ordenados.slice(0, 3).map((r) => {
      const nivel = calcularNivelRiesgo(r.probabilidad, r.impacto);
      const semaforo = obtenerSemaforoRiesgo(nivel);

      // Evaluar la acción más urgente del riesgo si existe
      let estadoPlazo: EstadoPlazoResult | null = null;
      if (r.acciones && r.acciones.length > 0) {
        // Encontrar la primera no completada o con plazo más vencido
        const ordenadasAcciones = [...r.acciones].sort(
          (x, y) => new Date(x.fechaMeta).getTime() - new Date(y.fechaMeta).getTime()
        );
        estadoPlazo = obtenerEstadoPlazo(
          ordenadasAcciones[0].fechaMeta,
          ordenadasAcciones[0].avance
        );
      }

      return {
        riesgo: r,
        nivel,
        semaforo,
        estadoPlazo,
        accionesCount: r.acciones ? r.acciones.length : 0,
      };
    });
  });

  // Próximos hitos pendientes o en proceso
  readonly proximosHitos = computed<Hito[]>(() => {
    const p = this.proyecto();
    if (!p || !p.hitos || p.hitos.length === 0) return [];

    return [...p.hitos]
      .filter((h) => h.estado !== 'Cumplido')
      .sort(
        (a, b) =>
          new Date(a.fechaFinProgramada).getTime() -
          new Date(b.fechaFinProgramada).getTime()
      )
      .slice(0, 2);
  });

  ngOnInit(): void {
    const cuiParam = this.route.snapshot.paramMap.get('cui');
    this.cui.set(cuiParam);
  }

  // Cerrar modal al presionar la tecla Escape
  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    if (this.mostrarAyudaMemoria()) {
      this.cerrarAyudaMemoria();
    }
  }

  abrirAyudaMemoria(): void {
    this.fechaGeneracion.set(new Date());
    this.mostrarAyudaMemoria.set(true);
  }

  cerrarAyudaMemoria(): void {
    this.mostrarAyudaMemoria.set(false);
  }

  imprimirAyudaMemoria(): void {
    window.print();
  }

  // Métodos formateadores accesibles desde el template
  fmtMoneda(val: number): string {
    return formatearMoneda(val || 0);
  }

  fmtFecha(date: Date | string | null | undefined): string {
    if (!date) return '—';
    return formatearFecha(new Date(date));
  }

  fmtPorcentaje(val: number): string {
    return formatearPorcentaje(val || 0);
  }

  fmtIDA(val: number): string {
    return formatearIDA(val || 0);
  }

  // Helper de semáforo de hito
  obtenerClaseEstadoHito(estado: string): { border: string; bg: string; text: string } {
    switch (estado) {
      case 'Cumplido':
        return {
          border: 'border-emerald-600',
          bg: 'bg-emerald-50',
          text: 'text-emerald-900',
        };
      case 'En Proceso':
        return {
          border: 'border-blue-600',
          bg: 'bg-blue-50',
          text: 'text-blue-900',
        };
      case 'Retrasado':
        return {
          border: 'border-red-600',
          bg: 'bg-red-50',
          text: 'text-red-900',
        };
      case 'Pendiente':
      default:
        return {
          border: 'border-gray-400',
          bg: 'bg-gray-100',
          text: 'text-gray-800',
        };
    }
  }
}
