import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  signal,
  computed,
  inject,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AyudaMemoriaComponent } from '../ayuda-memoria/ayuda-memoria.component';
import { CurvaSModalComponent } from '../curva-s/curva-s-modal.component';
import { PnsrHeaderComponent } from '@app/shared/components/pnsr-header/pnsr-header.component';
import { PnsrFooterComponent } from '@app/shared/components/pnsr-footer/pnsr-footer.component';

import { ProjectDataService } from '@services/project-data.service';
import { Proyecto } from '../../interfaces/project.interface';
import {
  calcularIDA,
  obtenerSemaforoIDA,
  calcularDescalce,
  tieneDescalce,
  obtenerEstadoPlazo,
  calcularNivelRiesgo,
  obtenerSemaforoRiesgo,
  formatearMoneda,
  formatearFecha,
  formatearPorcentaje,
  formatearIDA,
  type EstadoPlazoResult,
} from '../../utils/project.utils';

import {
  OlMap,
  View,
  TileLayer,
  XYZ,
  Overlay,
  fromLonLat,
  defaultControls,
} from '@app/modules/openlayers.module';

export interface Indicadores {
  totalProyectos: number;
  priorizados2026: number;
  idaPromedio: number;
  semaforoIDA: { optimos: number; alerta: number; criticos: number };
  descalceCount: number;
  riesgosActivos: { criticos: number; medios: number; bajos: number; total: number };
  mitigacionesVencidas: number;
}

export type FiltroRapidoKPI =
  | 'todos'
  | 'priorizados'
  | 'ida_optimo'
  | 'ida_alerta'
  | 'ida_critico'
  | 'descalce'
  | 'con_riesgo'
  | 'vencidos'
  | 'exposicion_riesgo'
  | 'culminados';

export interface AlertaProyecto {
  cui: string;
  nombre: string;
  accionDescripcion: string;
  fechaMeta: Date;
  avance: number;
}

export interface CeldaMatriz5x5 {
  prob: number;
  imp: number;
  score: number;
  count: number;
  isSelected: boolean;
  bgClass: string;
}

export interface EtapaCicloItem {
  etapa: string;
  etiquetaCorta: string;
  pimM: number;
  devM: number;
  fisicoPct: number;
  finPct: string;
  xCenter: number;
  barPimX: number;
  barPimY: number;
  barPimH: number;
  barDevX: number;
  barDevY: number;
  barDevH: number;
  lineX: number;
  lineY: number;
}

export interface SegmentoDona {
  etiqueta: string;
  cantidad: number;
  porcentaje: number;
  color: string;
  dashArray: string;
  dashOffset: number;
}

const REGION_COORDINATES: Record<string, { center: [number, number]; zoom: number }> = {
  ALL: { center: [-75.0, -9.4], zoom: 5.2 },
  Cajamarca: { center: [-78.5, -7.15], zoom: 8.5 },
  Piura: { center: [-80.6, -5.2], zoom: 8.5 },
  Amazonas: { center: [-77.9, -4.8], zoom: 8 },
  Loreto: { center: [-73.5, -4.2], zoom: 7.2 },
  'San Martín': { center: [-76.6, -6.45], zoom: 8.5 },
  'Jua�n': { center: [-75.25, -11.95], zoom: 8.5 },
  Huancavelica: { center: [-74.95, -12.78], zoom: 8.5 },
  Ayacucho: { center: [-74.3, -13.55], zoom: 8.5 },
  'Apuri�mac': { center: [-73.38, -13.65], zoom: 8.5 },
  Cusco: { center: [-72.05, -13.52], zoom: 8.5 },
  Puno: { center: [-70.35, -15.2], zoom: 8 },
  Huanuco: { center: [-75.98, -9.28], zoom: 8.5 },
};

@Component({
  selector: 'app-project-inbox',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    AyudaMemoriaComponent,
    CurvaSModalComponent,
    PnsrHeaderComponent,
    PnsrFooterComponent,
  ],
  templateUrl: './project-inbox.component.html',
  styleUrls: ['./project-inbox.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class ProjectInboxComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly dataService = inject(ProjectDataService);
  private readonly router = inject(Router);

  @ViewChild('peruMapContainer') peruMapContainer?: ElementRef<HTMLDivElement>;

  private olMap: OlMap | null = null;
  private mapOverlays: Overlay[] = [];
  private ambientOverlays: Overlay[] = [];

  // ── Contadores animados para la franja ejecutiva superior ────────────
  readonly totalProyectosAnim = signal<number>(0);
  readonly priorizados2026Anim = signal<number>(0);
  readonly idaPromedioAnim = signal<number>(0);
  readonly idaOptimosAnim = signal<number>(0);
  readonly idaAlertaAnim = signal<number>(0);
  readonly idaCriticosAnim = signal<number>(0);
  readonly descalceCountAnim = signal<number>(0);
  readonly riesgosTotalAnim = signal<number>(0);
  readonly mitigacionesVencidasAnim = signal<number>(0);

  // ── Filtros originales de la bandeja ─────────────────────────────────
  readonly filtroCartera = signal<string>('todas');
  readonly filtroBusqueda = signal<string>('');
  readonly filtroPriorizado = signal<boolean>(false);
  readonly filtroRiesgo = signal<string>('todos');
  readonly filtroRapidoKPI = signal<FiltroRapidoKPI>('todos');
  readonly alertasColapsadas = signal<boolean>(false);

  // ── Nuevos Filtros Globales del Tablero Ejecutivo ────────────────────
  readonly filtroPrograma = signal<string>('ALL');
  readonly filtroRegion = signal<string>('ALL');
  readonly filtroYear = signal<string>('ALL');
  readonly filtroModalidad = signal<string>('ALL');
  readonly filtroSeveridadMapa = signal<'ALL' | 'HIGH_CRIT' | 'CRITICAL'>('ALL');
  readonly filtroCeldaMatriz = signal<{ prob: number; imp: number } | null>(null);
  readonly filtroCategoriaRiesgo = signal<string | null>(null);
  readonly filtroNivelRiesgoTabla = signal<string>('ALL');

  // ── Paginación de la tabla y lista responsiva ────────────────────────
  readonly paginaActual = signal<number>(1);
  readonly itemsPorPagina = signal<number>(6);
  readonly opcionesPorPagina = [5, 6, 10, 15, 25];

  // ── Interacción en Gráficos y Mapa ───────────────────────────────────
  readonly etapaHoverIndex = signal<number | null>(null);
  readonly proyectoHoverMapa = signal<Proyecto | null>(null);

  // ── Toast de Exportación CSV ─────────────────────────────────────────
  readonly toastVisible = signal<boolean>(false);
  readonly toastTitulo = signal<string>('Reporte Exportado');
  readonly toastMensaje = signal<string>('Archivo CSV generado exitosamente.');

  // ── Categorías de Riesgos Rurales (Píldoras interactivas) ────────────
  readonly categoriasRiesgoRural = [
    { id: 'Climatológico', label: 'Climatológico / El Niño' },
    { id: 'Conflictos sociales', label: 'Conflictos Sociales' },
    { id: 'Expediente Técnico', label: 'Exp. Técnico / Suelos' },
    { id: 'Logística / Acceso', label: 'Logística / Zonas Alejadas' },
    { id: 'Gestión JASS', label: 'Sostenibilidad JASS' },
  ];

  readonly regionesFiltro = [
    { valor: 'ALL', etiqueta: 'Nacional (Todas las Regiones)' },
    { valor: 'Cajamarca', etiqueta: 'Cajamarca (Sierra Norte)' },
    { valor: 'Piura', etiqueta: 'Piura (Costa / Sierra Norte)' },
    { valor: 'Amazonas', etiqueta: 'Amazonas (Selva Alta)' },
    { valor: 'Loreto', etiqueta: 'Loreto (Amazonía)' },
    { valor: 'San Martín', etiqueta: 'San Martín (Selva Alta)' },
    { valor: 'Huanuco', etiqueta: 'Huánuco (Selva Central)' },
    { valor: 'Junín', etiqueta: 'Junín (Sierra / Selva Central)' },
    { valor: 'Huancavelica', etiqueta: 'Huancavelica (Sierra Centro)' },
    { valor: 'Ayacucho', etiqueta: 'Ayacucho (Sierra Sur Centro)' },
    { valor: 'Apurímac', etiqueta: 'Apurímac (Sierra Sur)' },
    { valor: 'Cusco', etiqueta: 'Cusco (Sierra Sur)' },
    { valor: 'Puno', etiqueta: 'Puno (Altiplano)' },
  ];

  readonly fechaCorteTexto = computed<string>(() => {
    return this.filtroYear() === '2025' ? 'Cierre Diciembre 2025' : 'Noviembre 2026';
  });

  readonly textoFiltroActivo = computed<string | null>(() => {
    const f = this.filtroRapidoKPI();
    switch (f) {
      case 'priorizados':
        return 'Compromisos Priorizados 2026';
      case 'ida_optimo':
        return 'Desempeño Físico Óptimo (IDA ≥ 0.95)';
      case 'ida_alerta':
        return 'Desempeño Físico en Alerta (IDA 0.80 - 0.94)';
      case 'ida_critico':
        return 'Desempeño Físico Crítico (IDA < 0.80)';
      case 'descalce':
        return 'Descalce Financiero Crítico (> 15%)';
      case 'con_riesgo':
        return 'Proyectos con Riesgos Activos';
      case 'vencidos':
        return 'Proyectos con Mitigaciones Vencidas';
      case 'exposicion_riesgo':
        return 'Exposición al Riesgo (Crítico y Alto)';
      case 'culminados':
        return 'Proyectos Culminados / En Liquidación';
      default:
        return null;
    }
  });

  readonly textoFiltroMatrizOCategoria = computed<string | null>(() => {
    const celda = this.filtroCeldaMatriz();
    const cat = this.filtroCategoriaRiesgo();
    if (celda && cat) {
      return `Filtro activo: Matriz ${celda.prob}×${celda.imp} (Severidad ${celda.prob * celda.imp}) + Tipología "${cat}".`;
    }
    if (celda) {
      return `Filtro Matriz 5x5 activo: Probabilidad ${celda.prob} × Impacto ${celda.imp} (Severidad ${celda.prob * celda.imp}).`;
    }
    if (cat) {
      return `Filtro activo por Tipología de Riesgo Rural: ${cat}.`;
    }
    return null;
  });

  // Track open dropdown by CUI
  readonly menuAbierto = signal<string | null>(null);

  // Ayuda de memoria modal state
  readonly proyectoSeleccionadoMemoria = signal<Proyecto | null>(null);
  readonly mostrarModalMemoria = signal<boolean>(false);

  // Curva S modal state
  readonly proyectoSeleccionadoCurvaS = signal<Proyecto | null>(null);
  readonly mostrarModalCurvaS = signal<boolean>(false);

  constructor() {
    effect(() => {
      const listaMapa = this.proyectosMapa();
      if (this.olMap) {
        this.actualizarMarcadoresMapa(listaMapa);
      }
    });
  }

  ngOnInit(): void {
    this.animarContadores();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.inicializarMapaPeru();
    }, 60);
  }

  ngOnDestroy(): void {
    if (this.olMap) {
      this.olMap.setTarget(undefined);
      this.olMap = null;
    }
  }

  abrirAyudaMemoria(p: Proyecto): void {
    this.cerrarMenu();
    this.proyectoSeleccionadoMemoria.set(p);
    this.mostrarModalMemoria.set(true);
  }

  cerrarAyudaMemoria(): void {
    this.mostrarModalMemoria.set(false);
    this.proyectoSeleccionadoMemoria.set(null);
  }

  abrirCurvaS(p: Proyecto): void {
    this.cerrarMenu();
    this.proyectoSeleccionadoCurvaS.set(p);
    this.mostrarModalCurvaS.set(true);
  }

  cerrarCurvaS(): void {
    this.mostrarModalCurvaS.set(false);
    this.proyectoSeleccionadoCurvaS.set(null);
  }

  // ── Animación fluida de contadores KPI (Cubic Ease-Out) ───────────────
  animarContadores(): void {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const ind = this.indicadores();
      this.totalProyectosAnim.set(ind.totalProyectos);
      this.priorizados2026Anim.set(ind.priorizados2026);
      this.idaPromedioAnim.set(ind.idaPromedio);
      this.idaOptimosAnim.set(ind.semaforoIDA.optimos);
      this.idaAlertaAnim.set(ind.semaforoIDA.alerta);
      this.idaCriticosAnim.set(ind.semaforoIDA.criticos);
      this.descalceCountAnim.set(ind.descalceCount);
      this.riesgosTotalAnim.set(ind.riesgosActivos.total);
      this.mitigacionesVencidasAnim.set(ind.mitigacionesVencidas);
      return;
    }

    const duracion = 850;
    const inicio = performance.now();
    const ind = this.indicadores();

    const paso = (tiempoActual: number) => {
      const transcurrido = tiempoActual - inicio;
      const progreso = Math.min(transcurrido / duracion, 1);
      const ease = 1 - Math.pow(1 - progreso, 3);

      this.totalProyectosAnim.set(Math.round(ind.totalProyectos * ease));
      this.priorizados2026Anim.set(Math.round(ind.priorizados2026 * ease));
      this.idaPromedioAnim.set(Math.round(ind.idaPromedio * ease * 100) / 100);
      this.idaOptimosAnim.set(Math.round(ind.semaforoIDA.optimos * ease));
      this.idaAlertaAnim.set(Math.round(ind.semaforoIDA.alerta * ease));
      this.idaCriticosAnim.set(Math.round(ind.semaforoIDA.criticos * ease));
      this.descalceCountAnim.set(Math.round(ind.descalceCount * ease));
      this.riesgosTotalAnim.set(Math.round(ind.riesgosActivos.total * ease));
      this.mitigacionesVencidasAnim.set(Math.round(ind.mitigacionesVencidas * ease));

      if (progreso < 1) {
        requestAnimationFrame(paso);
      } else {
        this.totalProyectosAnim.set(ind.totalProyectos);
        this.priorizados2026Anim.set(ind.priorizados2026);
        this.idaPromedioAnim.set(ind.idaPromedio);
        this.idaOptimosAnim.set(ind.semaforoIDA.optimos);
        this.idaAlertaAnim.set(ind.semaforoIDA.alerta);
        this.idaCriticosAnim.set(ind.semaforoIDA.criticos);
        this.descalceCountAnim.set(ind.descalceCount);
        this.riesgosTotalAnim.set(ind.riesgosActivos.total);
        this.mitigacionesVencidasAnim.set(ind.mitigacionesVencidas);
      }
    };

    requestAnimationFrame(paso);
  }

  // ── Proyectos filtrados por selectores globales superiores (base para Matriz 5x5) ──
  readonly proyectosBaseGlobal = computed<Proyecto[]>(() => {
    let lista = this.dataService.proyectos();

    // Año fiscal
    const year = this.filtroYear();
    if (year !== 'ALL') {
      lista = lista.filter((p) => (p.year || '2026') === year);
    }

    // Programa
    const prog = this.filtroPrograma();
    if (prog !== 'ALL') {
      if (prog === 'PIASAR') {
        lista = lista.filter(
          (p) => p.cartera === 'PIASAR' || p.programa === 'PIASAR 1' || p.programa === 'PIASAR 2',
        );
      } else if (prog === 'PNSR') {
        lista = lista.filter((p) => p.programa === 'PNSR' || p.cartera === 'UTP');
      } else if (prog === 'Amazonía Rural') {
        lista = lista.filter(
          (p) => p.programa === 'Amazonía Rural' || p.cartera === 'Amazonia Rural',
        );
      } else {
        lista = lista.filter((p) => p.programa === prog);
      }
    }

    // Cartera (selector original)
    const cartera = this.filtroCartera();
    if (cartera !== 'todas') {
      lista = lista.filter((p) => p.cartera === cartera);
    }

    // Región
    const reg = this.filtroRegion();
    if (reg !== 'ALL') {
      lista = lista.filter((p) => p.departamento.toLowerCase() === reg.toLowerCase());
    }

    // Modalidad
    const mod = this.filtroModalidad();
    if (mod !== 'ALL') {
      lista = lista.filter((p) => (p.modalidad || 'Contrata') === mod);
    }

    return lista;
  });

  // ── Computed: filtered projects (con todos los filtros combinados) ──
  readonly proyectosFiltrados = computed<Proyecto[]>(() => {
    let lista = this.proyectosBaseGlobal();

    // Filtro Rápido desde la Franja de Indicadores KPI
    const kpi = this.filtroRapidoKPI();
    if (kpi === 'priorizados') {
      lista = lista.filter((p) => p.priorizado2026);
    } else if (kpi === 'descalce') {
      lista = lista.filter((p) => tieneDescalce(p.avanceFinanciero, p.avanceFisicoReal));
    } else if (kpi === 'ida_optimo') {
      lista = lista.filter((p) => calcularIDA(p.avanceFisicoReal, p.avanceFisicoProgramado) >= 0.95);
    } else if (kpi === 'ida_alerta') {
      lista = lista.filter((p) => {
        const ida = calcularIDA(p.avanceFisicoReal, p.avanceFisicoProgramado);
        return ida >= 0.8 && ida < 0.95;
      });
    } else if (kpi === 'ida_critico') {
      lista = lista.filter((p) => calcularIDA(p.avanceFisicoReal, p.avanceFisicoProgramado) < 0.8);
    } else if (kpi === 'con_riesgo') {
      lista = lista.filter((p) => p.riesgos && p.riesgos.length > 0);
    } else if (kpi === 'vencidos') {
      lista = lista.filter((p) => this.tieneAccionVencida(p));
    } else if (kpi === 'exposicion_riesgo') {
      lista = lista.filter(
        (p) => p.riesgoNivel === 'Crítico' || p.riesgoNivel === 'Alto' || p.estado === 'Paralizado',
      );
    } else if (kpi === 'culminados') {
      lista = lista.filter((p) => p.estado === 'Culminado' || p.avanceFisicoReal >= 100);
    }

    // Filtro Celda Matriz 5x5
    const celda = this.filtroCeldaMatriz();
    if (celda) {
      lista = lista.filter((p) => (p.prob ?? 2) === celda.prob && (p.imp ?? 2) === celda.imp);
    }

    // Filtro Categoría de Riesgo Rural
    const cat = this.filtroCategoriaRiesgo();
    if (cat) {
      lista = lista.filter((p) => p.riesgoCategoria === cat);
    }

    // Filtro Nivel de Riesgo en Tabla
    const nivTabla = this.filtroNivelRiesgoTabla();
    if (nivTabla === 'PRIORIZADO') {
      lista = lista.filter((p) => p.priorizado2026);
    } else if (nivTabla !== 'ALL') {
      lista = lista.filter((p) => p.riesgoNivel === nivTabla);
    }

    // Búsqueda textual (CUI, nombre, localidad, departamento)
    const busqueda = this.filtroBusqueda().trim().toLowerCase();
    if (busqueda) {
      lista = lista.filter(
        (p) =>
          p.cui.toLowerCase().includes(busqueda) ||
          p.nombre.toLowerCase().includes(busqueda) ||
          p.localidad.toLowerCase().includes(busqueda) ||
          p.departamento.toLowerCase().includes(busqueda),
      );
    }

    // Casilla Priorizado
    if (this.filtroPriorizado() && kpi !== 'priorizados') {
      lista = lista.filter((p) => p.priorizado2026);
    }

    // Condición de plazo de riesgo (desplegable original)
    const riesgo = this.filtroRiesgo();
    if (riesgo === 'vencido' && kpi !== 'vencidos') {
      lista = lista.filter((p) => this.tieneAccionVencida(p));
    } else if (riesgo === 'por_vencer') {
      lista = lista.filter((p) => this.tieneAccionPorVencer(p));
    } else if (riesgo === 'sin_critico') {
      lista = lista.filter((p) => !this.tieneRiesgoCritico(p));
    }

    return lista;
  });

  // ── Computed: Paginación sobre proyectosFiltrados ────────────────────
  readonly totalPaginas = computed<number>(() => {
    const total = this.proyectosFiltrados().length;
    return Math.max(1, Math.ceil(total / this.itemsPorPagina()));
  });

  readonly paginaSegura = computed<number>(() => {
    return Math.min(Math.max(1, this.paginaActual()), this.totalPaginas());
  });

  readonly proyectosPaginados = computed<Proyecto[]>(() => {
    const lista = this.proyectosFiltrados();
    const tam = this.itemsPorPagina();
    const pag = this.paginaSegura();
    const inicio = (pag - 1) * tam;
    return lista.slice(inicio, inicio + tam);
  });

  readonly rangoPaginacion = computed(() => {
    const total = this.proyectosFiltrados().length;
    if (total === 0) {
      return { desde: 0, hasta: 0, total: 0 };
    }
    const tam = this.itemsPorPagina();
    const pag = this.paginaSegura();
    const desde = (pag - 1) * tam + 1;
    const hasta = Math.min(total, pag * tam);
    return { desde, hasta, total };
  });

  readonly numerosPagina = computed<number[]>(() => {
    const total = this.totalPaginas();
    return Array.from({ length: total }, (_, idx) => idx + 1);
  });

  irAPagina(pagina: number): void {
    const max = this.totalPaginas();
    const destino = Math.min(Math.max(1, pagina), max);
    this.cerrarMenu();
    this.paginaActual.set(destino);
  }

  paginaAnterior(): void {
    this.irAPagina(this.paginaSegura() - 1);
  }

  paginaSiguiente(): void {
    this.irAPagina(this.paginaSegura() + 1);
  }

  primeraPagina(): void {
    this.irAPagina(1);
  }

  ultimaPagina(): void {
    this.irAPagina(this.totalPaginas());
  }

  cambiarItemsPorPagina(cantidad: number): void {
    this.itemsPorPagina.set(Number(cantidad));
    this.paginaActual.set(1);
    this.cerrarMenu();
  }

  // ── Proyectos filtrados para el Mapa (incluye filtro rápido de severidad del mapa) ──
  readonly proyectosMapa = computed<Proyecto[]>(() => {
    const lista = this.proyectosFiltrados();
    const sev = this.filtroSeveridadMapa();
    if (sev === 'CRITICAL') {
      return lista.filter((p) => p.riesgoNivel === 'Crítico');
    }
    if (sev === 'HIGH_CRIT') {
      return lista.filter((p) => p.riesgoNivel === 'Crítico' || p.riesgoNivel === 'Alto');
    }
    return lista;
  });

  readonly conteosMapa = computed(() => {
    const lista = this.proyectosFiltrados();
    let criticos = 0;
    let altos = 0;
    let normales = 0;
    const regionesSet = new Set<string>();

    for (const p of lista) {
      if (p.riesgoNivel === 'Crítico') {
        criticos++;
        regionesSet.add(p.departamento);
      } else if (p.riesgoNivel === 'Alto') {
        altos++;
        regionesSet.add(p.departamento);
      } else {
        normales++;
      }
    }

    const focosTexto =
      regionesSet.size > 0
        ? Array.from(regionesSet).slice(0, 5).join(', ')
        : 'Sin alertas críticas en la selección actual';

    return { criticos, altos, normales, focosTexto };
  });

  // ── Matriz de Riesgos 5x5 Computada ─────────────────────────────────
  readonly celdasMatriz5x5 = computed<CeldaMatriz5x5[]>(() => {
    const base = this.proyectosBaseGlobal();
    const seleccionada = this.filtroCeldaMatriz();
    const celdas: CeldaMatriz5x5[] = [];

    for (let prob = 5; prob >= 1; prob--) {
      for (let imp = 1; imp <= 5; imp++) {
        const score = prob * imp;
        const count = base.filter((p) => (p.prob ?? 2) === prob && (p.imp ?? 2) === imp).length;
        const isSelected = !!seleccionada && seleccionada.prob === prob && seleccionada.imp === imp;

        let bgClass = 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100';
        if (score >= 16) {
          bgClass = 'bg-rojo-nacional text-white border-rojo-nacional-dark hover:bg-rojo-nacional-dark';
        } else if (score >= 10) {
          bgClass = 'bg-amarillo-progreso text-gris-estructura border-amber-500 hover:bg-amber-400';
        } else if (score >= 5) {
          bgClass = 'bg-amber-100 text-gris-estructura border-amber-300 hover:bg-amber-200';
        }

        celdas.push({ prob, imp, score, count, isSelected, bgClass });
      }
    }

    return celdas;
  });

  // ── Resumen Ejecutivo (6 KPIs + Ciclo de Inversión + Estado Situacional) ──
  readonly resumenEjecutivo = computed(() => {
    const projects = this.proyectosFiltrados();
    const totalProyectos = projects.length;

    let pimTotal = 0;
    let devTotal = 0;
    let priorizadosCount = 0;
    let priorizadosPim = 0;
    let weightedFis = 0;
    let weightedProg = 0;
    let culminadas = 0;
    let poblacionTotal = 0;
    let ubsCount = 0;
    let jassCount = 0;
    let paralizados = 0;
    let alertaAlta = 0;

    const modCounts = { ne: 0, contrata: 0, transf: 0 };
    const progCounts = { pnsr: 0, piasar1: 0, piasar2: 0, amazonia: 0 };
    const statusCounts = [0, 0, 0, 0]; // [Normal, En Riesgo, Paralizado, Culminado]

    const stageMap: Record<string, { pim: number; dev: number; weightedFis: number }> = {
      'Expediente Técnico': { pim: 0, dev: 0, weightedFis: 0 },
      'Ejecución de Obra': { pim: 0, dev: 0, weightedFis: 0 },
      'Liquidación y Transf. JASS': { pim: 0, dev: 0, weightedFis: 0 },
    };

    for (const p of projects) {
      const pim = p.pim ?? p.costoInversion ?? 0;
      const dev = p.devengado ?? p.devengadoAcumulado ?? 0;
      const fis = p.avanceFisicoReal ?? 0;
      const prog = p.avanceProg ?? p.avanceFisicoProgramado ?? 0;

      pimTotal += pim;
      devTotal += dev;
      weightedFis += fis * pim;
      weightedProg += prog * pim;
      poblacionTotal += p.beneficiarios ?? 1500;
      ubsCount += p.ubs ?? 320;
      jassCount += 1;

      if (p.priorizado2026) {
        priorizadosCount++;
        priorizadosPim += pim;
      }

      if (p.estado === 'Culminado' || fis >= 100) culminadas++;
      if (p.estado === 'Paralizado') paralizados++;
      if (p.riesgoNivel === 'Crítico' || p.riesgoNivel === 'Alto') alertaAlta++;

      const mod = p.modalidad || 'Contrata';
      if (mod === 'Núcleo Ejecutor') modCounts.ne++;
      else if (mod === 'Contrata') modCounts.contrata++;
      else modCounts.transf++;

      const prg = p.programa || 'PNSR';
      if (prg === 'PNSR') progCounts.pnsr++;
      else if (prg === 'PIASAR 1') progCounts.piasar1++;
      else if (prg === 'PIASAR 2') progCounts.piasar2++;
      else progCounts.amazonia++;

      if (p.estado === 'Normal') statusCounts[0]++;
      else if (p.estado === 'En Riesgo') statusCounts[1]++;
      else if (p.estado === 'Paralizado') statusCounts[2]++;
      else statusCounts[3]++;

      const etapaKey = p.etapa && stageMap[p.etapa] ? p.etapa : 'Ejecución de Obra';
      stageMap[etapaKey].pim += pim;
      stageMap[etapaKey].dev += dev;
      stageMap[etapaKey].weightedFis += fis * pim;
    }

    const pimMillones = pimTotal / 1_000_000;
    const devengadoMillones = devTotal / 1_000_000;
    const priorizadosPimMillones = priorizadosPim / 1_000_000;
    const priorizadosPct =
      totalProyectos > 0 ? Number(((priorizadosCount / totalProyectos) * 100).toFixed(1)) : 0;

    const finPct = pimTotal > 0 ? Number(((devTotal / pimTotal) * 100).toFixed(1)) : 0;
    const fisPct = pimTotal > 0 ? Number((weightedFis / pimTotal).toFixed(1)) : 0;
    const progPct = pimTotal > 0 ? Number((weightedProg / pimTotal).toFixed(1)) : 0;
    const brechaFisica = Number((fisPct - progPct).toFixed(1));

    const metaRef = this.filtroYear() === '2025' ? 90.0 : 72.0;
    const finDiffMeta = Number((finPct - metaRef).toFixed(1));

    const riesgoTotal = alertaAlta;
    const riesgoPct =
      totalProyectos > 0 ? Number(((riesgoTotal / totalProyectos) * 100).toFixed(1)) : 0;
    const alertaAltaSinParalizados = Math.max(0, alertaAlta - paralizados);

    const totalSafe = Math.max(1, totalProyectos);
    const piasarTotal = progCounts.piasar1 + progCounts.piasar2;
    const pnsrPct = totalProyectos > 0 ? Math.round((progCounts.pnsr / totalSafe) * 100) : 0;
    const piasarPct = totalProyectos > 0 ? Math.round((piasarTotal / totalSafe) * 100) : 0;
    const amazoniaPct =
      totalProyectos > 0 ? Math.max(0, 100 - pnsrPct - piasarPct) : 0;

    return {
      totalProyectos,
      pimMillones,
      devengadoMillones,
      priorizadosCount,
      priorizadosPct,
      priorizadosPimMillones,
      finPct,
      finDiffMeta,
      fisPct,
      progPct,
      brechaFisica,
      culminadas,
      poblacionTotal,
      ubsCount,
      jassCount,
      riesgoTotal,
      riesgoPct,
      paralizados,
      alertaAlta: alertaAltaSinParalizados,
      modCounts,
      progCounts: {
        ...progCounts,
        piasarTotal,
        pnsrPct,
        piasarPct,
        amazoniaPct,
      },
      statusCounts,
      stageMap,
    };
  });

  // ── Datos geométricos SVG para Gráfico 1: Ciclo de Inversión ────────
  readonly datosGraficoCiclo = computed(() => {
    const s = this.resumenEjecutivo();
    const orden = [
      { key: 'Expediente Técnico', corta: 'Exp. Técnico' },
      { key: 'Ejecución de Obra', corta: 'Ejec. de Obra' },
      { key: 'Liquidación y Transf. JASS', corta: 'Liq. y Transf. JASS' },
    ];

    const rawStages = orden.map((o) => {
      const st = s.stageMap[o.key];
      const pimM = Number((st.pim / 1_000_000).toFixed(2));
      const devM = Number((st.dev / 1_000_000).toFixed(2));
      const fisicoPct = st.pim > 0 ? Number((st.weightedFis / st.pim).toFixed(1)) : 0;
      const finPct = st.pim > 0 ? ((st.dev / st.pim) * 100).toFixed(1) : '0.0';
      return { etapa: o.key, etiquetaCorta: o.corta, pimM, devM, fisicoPct, finPct };
    });

    const maxVal = Math.max(20, ...rawStages.map((r) => Math.max(r.pimM, r.devM)));
    const step = maxVal <= 50 ? 10 : maxVal <= 120 ? 20 : 40;
    const maxAxisM = Math.ceil(maxVal / step) * step;

    const ticksM: number[] = [];
    for (let v = 0; v <= maxAxisM; v += step) {
      ticksM.push(v);
    }

    const padLeft = 58;
    const padTop = 22;
    const graphW = 510;
    const graphH = 175;
    const baseY = padTop + graphH;
    const colW = graphW / 3;
    const barW = 36;

    const items: EtapaCicloItem[] = rawStages.map((r, idx) => {
      const xCenter = padLeft + colW * idx + colW / 2;
      const barPimH = maxAxisM > 0 ? (r.pimM / maxAxisM) * graphH : 0;
      const barDevH = maxAxisM > 0 ? (r.devM / maxAxisM) * graphH : 0;

      const barPimX = xCenter - barW - 4;
      const barPimY = baseY - barPimH;
      const barDevX = xCenter + 4;
      const barDevY = baseY - barDevH;

      const lineX = xCenter;
      const lineY = baseY - (Math.min(110, r.fisicoPct) / 110) * graphH;

      return {
        ...r,
        xCenter,
        barPimX,
        barPimY,
        barPimH,
        barDevX,
        barDevY,
        barDevH,
        lineX,
        lineY,
      };
    });

    const linePath = items
      .map((it, i) => `${i === 0 ? 'M' : 'L'} ${it.lineX} ${it.lineY}`)
      .join(' ');

    return {
      items,
      ticksM,
      maxAxisM,
      padLeft,
      padTop,
      graphW,
      graphH,
      baseY,
      linePath,
    };
  });

  // ── Datos geométricos SVG para Gráfico 2: Dona de Estado Situacional ─
  readonly segmentosDona = computed<SegmentoDona[]>(() => {
    const counts = this.resumenEjecutivo().statusCounts;
    const total = counts.reduce((a, b) => a + b, 0);
    const circ = 2 * Math.PI * 58; // r = 58 -> ~364.42

    const definiciones = [
      { etiqueta: 'Ejecución Normal', color: 'var(--color-azul-institucional)', cantidad: counts[0] },
      { etiqueta: 'En Riesgo de Retraso', color: 'var(--color-amarillo-progreso)', cantidad: counts[1] },
      { etiqueta: 'Paralizado', color: 'var(--color-rojo-nacional)', cantidad: counts[2] },
      { etiqueta: 'Culminado / Liquidación', color: 'var(--color-verde-eficiencia)', cantidad: counts[3] },
    ];

    let acumuladoLong = 0;
    return definiciones.map((d) => {
      const pct = total > 0 ? (d.cantidad / total) * 100 : 0;
      const segLen = total > 0 ? (d.cantidad / total) * circ : 0;
      const dashArray = `${segLen} ${circ - segLen}`;
      const dashOffset = -acumuladoLong;
      acumuladoLong += segLen;

      return {
        etiqueta: d.etiqueta,
        cantidad: d.cantidad,
        porcentaje: Math.round(pct),
        color: d.color,
        dashArray,
        dashOffset,
      };
    });
  });

  // ── Computed: KPI indicators (originales conservados al 100%) ───────
  readonly indicadores = computed<Indicadores>(() => {
    const todos = this.proyectosBaseGlobal();
    const total = todos.length;
    const priorizados = todos.filter((p) => p.priorizado2026).length;

    let sumaIDA = 0;
    let optimos = 0;
    let alerta = 0;
    let criticos = 0;

    for (const p of todos) {
      const ida = calcularIDA(p.avanceFisicoReal, p.avanceFisicoProgramado);
      sumaIDA += ida;
      const sem = obtenerSemaforoIDA(ida);
      if (sem.color === 'verde') optimos++;
      else if (sem.color === 'ambar') alerta++;
      else criticos++;
    }

    const idaPromedio = total > 0 ? Math.round((sumaIDA / total) * 100) / 100 : 0;

    const descalceCount = todos.filter((p) =>
      tieneDescalce(p.avanceFinanciero, p.avanceFisicoReal),
    ).length;

    let rCriticos = 0;
    let rMedios = 0;
    let rBajos = 0;
    let mitigVencidas = 0;

    for (const p of todos) {
      for (const r of p.riesgos) {
        if (r.estado === 'ATENDIDO') continue;
        const nivel = calcularNivelRiesgo(r.probabilidad, r.impacto);
        const sem = obtenerSemaforoRiesgo(nivel);
        if (sem.color === 'rojo') rCriticos++;
        else if (sem.color === 'ambar') rMedios++;
        else rBajos++;
      }
      mitigVencidas += this.contarMitigacionesVencidas(p);
    }

    return {
      totalProyectos: total,
      priorizados2026: priorizados,
      idaPromedio,
      semaforoIDA: { optimos, alerta, criticos },
      descalceCount,
      riesgosActivos: {
        criticos: rCriticos,
        medios: rMedios,
        bajos: rBajos,
        total: rCriticos + rMedios + rBajos,
      },
      mitigacionesVencidas: mitigVencidas,
    };
  });

  // ── Computed: alerts ────────────────────────────────────────────────
  readonly alertasVencidas = computed<AlertaProyecto[]>(() => {
    const resultado: AlertaProyecto[] = [];
    for (const p of this.proyectosBaseGlobal()) {
      for (const r of p.riesgos) {
        if (r.estado === 'ATENDIDO') continue;
        for (const a of r.acciones) {
          const estado = obtenerEstadoPlazo(a.fechaMeta, a.avance);
          if (estado.estado === 'vencido') {
            resultado.push({
              cui: p.cui,
              nombre: p.nombre,
              accionDescripcion: a.descripcion,
              fechaMeta: a.fechaMeta,
              avance: a.avance,
            });
          }
        }
      }
    }
    return resultado;
  });

  readonly alertasPorVencer = computed<AlertaProyecto[]>(() => {
    const resultado: AlertaProyecto[] = [];
    for (const p of this.proyectosBaseGlobal()) {
      for (const r of p.riesgos) {
        if (r.estado === 'ATENDIDO') continue;
        for (const a of r.acciones) {
          const estado = obtenerEstadoPlazo(a.fechaMeta, a.avance);
          if (estado.estado === 'por_vencer') {
            resultado.push({
              cui: p.cui,
              nombre: p.nombre,
              accionDescripcion: a.descripcion,
              fechaMeta: a.fechaMeta,
              avance: a.avance,
            });
          }
        }
      }
    }
    return resultado;
  });

  readonly proyectosConVencidas = computed<number>(() => {
    const cuis = new Set<string>();
    for (const a of this.alertasVencidas()) {
      cuis.add(a.cui);
    }
    return cuis.size;
  });

  readonly proyectosConPorVencer = computed<number>(() => {
    const cuis = new Set<string>();
    for (const a of this.alertasPorVencer()) {
      cuis.add(a.cui);
    }
    return cuis.size;
  });

  // ── Inicialización y control del Mapa OpenLayers del Perú ───────────
  private inicializarMapaPeru(): void {
    const el = this.peruMapContainer?.nativeElement;
    if (!el || this.olMap) return;

    const baseLayer = new TileLayer({
      source: new XYZ({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        maxZoom: 18,
      }),
    });

    this.olMap = new OlMap({
      target: el,
      layers: [baseLayer],
      controls: defaultControls({ zoom: false, attribution: false, rotate: false }),
      view: new View({
        center: fromLonLat(REGION_COORDINATES['ALL'].center),
        zoom: REGION_COORDINATES['ALL'].zoom,
        minZoom: 4,
        maxZoom: 15,
      }),
    });

    this.actualizarMarcadoresMapa(this.proyectosMapa());
    this.generarPuntosAmbientalesPeru();
    requestAnimationFrame(() => this.olMap?.updateSize());
  }

  private generarPuntosAmbientalesPeru(): void {
    if (!this.olMap) return;

    for (const ov of this.ambientOverlays) {
      this.olMap.removeOverlay(ov);
    }
    this.ambientOverlays = [];

    // Corredores geográficos dentro del territorio peruano (lon, lat)
    const zonasPeru: [number, number][] = [
      [-80.4, -4.9], [-79.2, -5.6], [-78.5, -6.2], [-77.4, -6.5],
      [-75.5, -4.2], [-73.5, -4.4], [-74.8, -6.8], [-76.3, -8.3],
      [-74.6, -9.5], [-77.8, -9.2], [-76.9, -11.2], [-75.2, -11.8],
      [-74.1, -13.0], [-72.8, -13.6], [-71.6, -13.5], [-70.2, -12.6],
      [-70.0, -15.2], [-71.5, -16.2], [-73.2, -15.8], [-70.8, -17.3],
      [-76.1, -14.1], [-78.8, -7.8],
    ];
    const variantes = ['radar-critical', 'radar-high', 'radar-medium', 'radar-low'];

    zonasPeru.forEach(([baseLon, baseLat], idx) => {
      const lon = baseLon + (Math.random() - 0.5) * 0.9;
      const lat = baseLat + (Math.random() - 0.5) * 0.9;

      const wrapper = document.createElement('div');
      const claseRadar = variantes[idx % variantes.length];
      wrapper.className = `radar-marker-wrapper ${claseRadar} peru-ambient-marker`;
      wrapper.style.pointerEvents = 'none';
      wrapper.setAttribute('aria-hidden', 'true');

      const ring = document.createElement('span');
      ring.className = 'radar-ring';
      ring.style.animationDelay = `${(Math.random() * 2.2).toFixed(2)}s`;
      ring.style.animationDuration = `${(1.5 + Math.random() * 1.1).toFixed(2)}s`;
      wrapper.appendChild(ring);

      const core = document.createElement('span');
      core.className = 'radar-core';
      wrapper.appendChild(core);

      const overlay = new Overlay({
        position: fromLonLat([lon, lat]),
        positioning: 'center-center',
        element: wrapper,
        stopEvent: false,
      });

      this.olMap!.addOverlay(overlay);
      this.ambientOverlays.push(overlay);
    });
  }

  private actualizarMarcadoresMapa(proyectos: Proyecto[]): void {
    if (!this.olMap) return;

    for (const ov of this.mapOverlays) {
      this.olMap.removeOverlay(ov);
    }
    this.mapOverlays = [];

    for (const p of proyectos) {
      const lng = p.lng ?? p.coordenadaX ?? -75.0;
      const lat = p.lat ?? p.coordenadaY ?? -9.4;

      const wrapper = document.createElement('div');
      let claseRadar = 'radar-low';
      if (p.riesgoNivel === 'Crítico') claseRadar = 'radar-critical';
      else if (p.riesgoNivel === 'Alto') claseRadar = 'radar-high';
      else if (p.riesgoNivel === 'Medio') claseRadar = 'radar-medium';

      wrapper.className = `radar-marker-wrapper ${claseRadar}`;
      wrapper.setAttribute('role', 'button');
      wrapper.setAttribute('tabindex', '0');
      wrapper.setAttribute('aria-label', `Proyecto CUI ${p.cui}: ${p.nombre}`);

      if (p.riesgoNivel === 'Crítico' || p.riesgoNivel === 'Alto') {
        const ring = document.createElement('span');
        ring.className = 'radar-ring';
        wrapper.appendChild(ring);
      }

      const core = document.createElement('span');
      core.className = 'radar-core';
      wrapper.appendChild(core);

      wrapper.addEventListener('mouseenter', () => {
        this.proyectoHoverMapa.set(p);
      });
      wrapper.addEventListener('mouseleave', () => {
        if (this.proyectoHoverMapa()?.cui === p.cui) {
          this.proyectoHoverMapa.set(null);
        }
      });
      wrapper.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.abrirCurvaS(p);
      });

      const overlay = new Overlay({
        position: fromLonLat([lng, lat]),
        positioning: 'center-center',
        element: wrapper,
        stopEvent: false,
      });

      this.olMap.addOverlay(overlay);
      this.mapOverlays.push(overlay);
    }
  }

  centrarMapaNacional(): void {
    if (!this.olMap) return;
    this.olMap.getView().animate({
      center: fromLonLat(REGION_COORDINATES['ALL'].center),
      zoom: REGION_COORDINATES['ALL'].zoom,
      duration: 500,
    });
  }

  zoomInMapa(): void {
    if (!this.olMap) return;
    const view = this.olMap.getView();
    view.animate({ zoom: (view.getZoom() ?? 5) + 1, duration: 200 });
  }

  zoomOutMapa(): void {
    if (!this.olMap) return;
    const view = this.olMap.getView();
    view.animate({ zoom: Math.max(4, (view.getZoom() ?? 5) - 1), duration: 200 });
  }

  // ── Helper methods for template ─────────────────────────────────────
  calcularIDA = calcularIDA;
  obtenerSemaforoIDA = obtenerSemaforoIDA;
  calcularDescalce = calcularDescalce;
  tieneDescalce = tieneDescalce;
  formatearMoneda = formatearMoneda;
  formatearFecha = formatearFecha;
  formatearPorcentaje = formatearPorcentaje;
  formatearIDA = formatearIDA;
  obtenerEstadoPlazo = obtenerEstadoPlazo;
  calcularNivelRiesgo = calcularNivelRiesgo;
  obtenerSemaforoRiesgo = obtenerSemaforoRiesgo;

  formatMillones(val: number): string {
    return `S/ ${val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
  }

  formatHabitantesCorto(val: number): string {
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}k`;
    }
    return val.toLocaleString('es-PE');
  }

  toggleAlertas(): void {
    this.alertasColapsadas.update((v) => !v);
  }

  seleccionarFiltroRapido(filtro: FiltroRapidoKPI): void {
    this.filtroRapidoKPI.update((actual) => (actual === filtro ? 'todos' : filtro));
  }

  onProgramaGlobalChange(valor: string): void {
    this.filtroPrograma.set(valor);
    if (valor === 'PNSR') this.filtroCartera.set('UTP');
    else if (valor === 'Amazonía Rural') this.filtroCartera.set('Amazonia Rural');
    else if (valor === 'PIASAR' || valor === 'PIASAR 1' || valor === 'PIASAR 2') {
      this.filtroCartera.set('PIASAR');
    } else {
      this.filtroCartera.set('todas');
    }
    this.animarContadores();
  }

  onRegionGlobalChange(valor: string): void {
    this.filtroRegion.set(valor);
    this.animarContadores();
    if (this.olMap) {
      const coords = REGION_COORDINATES[valor] || REGION_COORDINATES['ALL'];
      this.olMap.getView().animate({
        center: fromLonLat(coords.center),
        zoom: coords.zoom,
        duration: 550,
      });
    }
  }

  onYearGlobalChange(valor: string): void {
    this.filtroYear.set(valor);
    this.animarContadores();
  }

  onModalidadGlobalChange(valor: string): void {
    this.filtroModalidad.set(valor);
    this.animarContadores();
  }

  setMapSeverityFilter(sev: 'ALL' | 'HIGH_CRIT' | 'CRITICAL'): void {
    this.filtroSeveridadMapa.set(sev);
  }

  toggleCeldaMatriz(prob: number, imp: number): void {
    const actual = this.filtroCeldaMatriz();
    if (actual && actual.prob === prob && actual.imp === imp) {
      this.filtroCeldaMatriz.set(null);
    } else {
      this.filtroCeldaMatriz.set({ prob, imp });
    }
  }

  toggleCategoriaRiesgo(catId: string): void {
    this.filtroCategoriaRiesgo.update((actual) => (actual === catId ? null : catId));
  }

  limpiarFiltroMatrizYCategoria(): void {
    this.filtroCeldaMatriz.set(null);
    this.filtroCategoriaRiesgo.set(null);
  }

  limpiarTodosFiltros(): void {
    this.filtroRapidoKPI.set('todos');
    this.filtroCartera.set('todas');
    this.filtroPrograma.set('ALL');
    this.filtroRegion.set('ALL');
    this.filtroYear.set('ALL');
    this.filtroModalidad.set('ALL');
    this.filtroSeveridadMapa.set('ALL');
    this.filtroCeldaMatriz.set(null);
    this.filtroCategoriaRiesgo.set(null);
    this.filtroNivelRiesgoTabla.set('ALL');
    this.filtroBusqueda.set('');
    this.filtroPriorizado.set(false);
    this.filtroRiesgo.set('todos');
    this.centrarMapaNacional();
    this.animarContadores();
  }

  exportarCSV(): void {
    const rows = this.proyectosFiltrados();
    const headers = [
      'CUI',
      'Anio',
      'Programa',
      'Cartera',
      'Priorizado',
      'Proyecto',
      'Departamento',
      'Provincia',
      'Distrito',
      'Localidad',
      'Modalidad',
      'Etapa',
      'Estado',
      'PIM_Soles',
      'Devengado_Soles',
      'Avance_Fisico_Pct',
      'Avance_Programado_Pct',
      'Avance_Financiero_Pct',
      'IDA',
      'Nivel_Riesgo',
      'Severidad_5x5',
      'Categoria_Riesgo',
      'Factor_Riesgo',
      'Plan_Mitigacion',
      'Responsable',
    ];

    const csvLines = [
      headers.join(','),
      ...rows.map((p) => {
        const pim = p.pim ?? p.costoInversion;
        const dev = p.devengado ?? p.devengadoAcumulado;
        const ida = calcularIDA(p.avanceFisicoReal, p.avanceFisicoProgramado).toFixed(2);
        const sev = (p.prob ?? 2) * (p.imp ?? 2);
        return [
          p.cui,
          p.year || '2026',
          `"${p.programa || p.cartera}"`,
          `"${p.cartera}"`,
          p.priorizado2026 ? 'SI' : 'NO',
          `"${(p.nombre || '').replace(/"/g, '""')}"`,
          `"${p.departamento}"`,
          `"${p.provincia}"`,
          `"${p.distrito}"`,
          `"${(p.localidad || '').replace(/"/g, '""')}"`,
          `"${p.modalidad || 'Contrata'}"`,
          `"${p.etapa || 'Ejecución de Obra'}"`,
          `"${p.estado || p.estadoAdministrativo}"`,
          pim,
          dev,
          p.avanceFisicoReal,
          p.avanceFisicoProgramado,
          p.avanceFinanciero,
          ida,
          `"${p.riesgoNivel || 'Medio'}"`,
          sev,
          `"${p.riesgoCategoria || ''}"`,
          `"${(p.riesgoFactor || '').replace(/"/g, '""')}"`,
          `"${(p.mitigacion || '').replace(/"/g, '""')}"`,
          `"${p.responsable || p.responsablePnsr}"`,
        ].join(',');
      }),
    ];

    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reporte_Ejecutivo_PNSR_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.toastTitulo.set('Reporte CSV Exportado');
    this.toastMensaje.set(
      `Se exportaron ${rows.length} proyectos de saneamiento rural exitosamente.`,
    );
    this.toastVisible.set(true);
    setTimeout(() => {
      this.toastVisible.set(false);
    }, 3500);
  }

  filtrarVencidos(): void {
    this.seleccionarFiltroRapido('vencidos');
  }

  filtrarPorVencer(): void {
    this.filtroRiesgo.set('por_vencer');
  }

  onBusquedaChange(valor: string): void {
    this.filtroBusqueda.set(valor);
  }

  onCarteraChange(valor: string): void {
    this.filtroCartera.set(valor);
    if (valor === 'UTP') this.filtroPrograma.set('PNSR');
    else if (valor === 'PIASAR') this.filtroPrograma.set('PIASAR');
    else if (valor === 'Amazonia Rural') this.filtroPrograma.set('Amazonía Rural');
    else this.filtroPrograma.set('ALL');
    this.animarContadores();
  }

  onPriorizadoChange(valor: boolean): void {
    this.filtroPriorizado.set(valor);
  }

  onRiesgoChange(valor: string): void {
    this.filtroRiesgo.set(valor);
  }

  toggleMenu(cui: string): void {
    this.menuAbierto.update((actual) => (actual === cui ? null : cui));
  }

  cerrarMenu(): void {
    this.menuAbierto.set(null);
  }

  navegarADetalle(cui: string): void {
    this.cerrarMenu();
    this.router.navigate(['/proyectos/detalle', cui]);
  }

  navegarAEditar(cui: string): void {
    this.cerrarMenu();
    this.router.navigate(['/proyectos/editar', cui]);
  }

  navegarARiesgos(cui: string): void {
    this.cerrarMenu();
    this.router.navigate(['/proyectos/riesgos', cui]);
  }

  navegarAAyudaMemoria(cui: string): void {
    this.cerrarMenu();
    const p = this.dataService.getProyecto(cui);
    if (p) {
      this.abrirAyudaMemoria(p);
    }
  }

  navegarAMapa(cui: string): void {
    this.cerrarMenu();
    const p = this.dataService.getProyecto(cui);
    this.router.navigate(['/visor'], {
      queryParams: { cui, x: p?.coordenadaX, y: p?.coordenadaY },
    });
  }

  enlaceSSI(cui: string): string {
    return `https://ofi5.mef.gob.pe/invierte/formato/verProyecto/${cui}`;
  }

  obtenerUbicacion(p: Proyecto): string {
    return `${p.distrito}, ${p.provincia}, ${p.departamento}`;
  }

  obtenerRiesgoMasCritico(p: Proyecto): EstadoPlazoResult | null {
    let peor: EstadoPlazoResult | null = null;

    for (const r of p.riesgos) {
      if (r.estado === 'ATENDIDO') continue;
      for (const a of r.acciones) {
        const estado = obtenerEstadoPlazo(a.fechaMeta, a.avance);
        if (!peor) {
          peor = estado;
          continue;
        }
        if (estado.estado === 'vencido' && peor.estado !== 'vencido') {
          peor = estado;
        } else if (
          estado.estado === 'por_vencer' &&
          peor.estado !== 'vencido' &&
          peor.estado !== 'por_vencer'
        ) {
          peor = estado;
        }
      }
    }

    return peor;
  }

  obtenerFechaVencimientoMasAntigua(p: Proyecto): Date | null {
    let oldest: Date | null = null;
    for (const r of p.riesgos) {
      if (r.estado === 'ATENDIDO') continue;
      for (const a of r.acciones) {
        const estado = obtenerEstadoPlazo(a.fechaMeta, a.avance);
        if (estado.estado === 'vencido') {
          const fecha = new Date(a.fechaMeta);
          if (!oldest || fecha < oldest) {
            oldest = fecha;
          }
        }
      }
    }
    return oldest;
  }

  obtenerDiasProximoVencimiento(p: Proyecto): number | null {
    let minDias: number | null = null;
    for (const r of p.riesgos) {
      if (r.estado === 'ATENDIDO') continue;
      for (const a of r.acciones) {
        const estado = obtenerEstadoPlazo(a.fechaMeta, a.avance);
        if (estado.estado === 'por_vencer' && estado.diasRestantes !== null) {
          if (minDias === null || estado.diasRestantes < minDias) {
            minDias = estado.diasRestantes;
          }
        }
      }
    }
    return minDias;
  }

  private tieneAccionVencida(p: Proyecto): boolean {
    return p.riesgos.some((r) =>
      r.estado !== 'ATENDIDO' &&
      r.acciones.some(
        (a) => obtenerEstadoPlazo(a.fechaMeta, a.avance).estado === 'vencido',
      ),
    );
  }

  private tieneAccionPorVencer(p: Proyecto): boolean {
    return p.riesgos.some((r) =>
      r.estado !== 'ATENDIDO' &&
      r.acciones.some(
        (a) =>
          obtenerEstadoPlazo(a.fechaMeta, a.avance).estado === 'por_vencer',
      ),
    );
  }

  private tieneRiesgoCritico(p: Proyecto): boolean {
    return p.riesgos.some((r) => {
      if (r.estado === 'ATENDIDO') return false;
      const nivel = calcularNivelRiesgo(r.probabilidad, r.impacto);
      return obtenerSemaforoRiesgo(nivel).color === 'rojo';
    });
  }

  private contarMitigacionesVencidas(p: Proyecto): number {
    let count = 0;
    for (const r of p.riesgos) {
      if (r.estado === 'ATENDIDO') continue;
      for (const a of r.acciones) {
        if (obtenerEstadoPlazo(a.fechaMeta, a.avance).estado === 'vencido') {
          count++;
        }
      }
    }
    return count;
  }
}
