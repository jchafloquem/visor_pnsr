import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { ProjectDataService } from '@app/services/project-data.service';
import {
  Proyecto,
  Riesgo,
  AccionMitigacion,
  CategoriaRiesgoOSCE,
  ProbabilidadNivelOSCE,
  ImpactoNivelOSCE,
  PrioridadRiesgoOSCE,
  EstrategiaRespuestaRiesgo,
} from '@app/components/projects/interfaces/project.interface';
import {
  CATEGORIAS_RIESGO_OSCE,
  TABLA_PROBABILIDAD_OSCE,
  TABLA_IMPACTO_OSCE,
  calcularRiesgoOSCE,
  formularIdentificacionRiesgo,
  obtenerEstadoPlazo,
  formatearFecha,
  calcularNivelRiesgo,
  obtenerSemaforoRiesgo,
  type EvaluacionRiesgoOSCE,
  type EstadoPlazoResult,
  type SemaforoResult,
} from '@app/components/projects/utils/project.utils';
import { AyudaMemoriaComponent } from '../ayuda-memoria/ayuda-memoria.component';
import { PnsrHeaderComponent } from '@app/shared/components/pnsr-header/pnsr-header.component';
import { PnsrFooterComponent } from '@app/shared/components/pnsr-footer/pnsr-footer.component';

@Component({
  selector: 'app-project-risks',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    AyudaMemoriaComponent,
    PnsrHeaderComponent,
    PnsrFooterComponent,
  ],
  templateUrl: './project-risks.component.html',
  styleUrls: ['./project-risks.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectRisksComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly projectService = inject(ProjectDataService);
  private readonly fb = inject(FormBuilder);

  readonly cui = signal<string | null>(null);
  readonly mostrarFormularioRiesgo = signal<boolean>(false);
  readonly mostrarMatrizGuia = signal<boolean>(false);
  readonly riesgoExpandidoId = signal<string | null>(null);
  readonly agregarAccionRiesgoId = signal<string | null>(null);
  readonly atenderRiesgoId = signal<string | null>(null);
  readonly mostrarModalMemoria = signal<boolean>(false);

  // Tablas maestras OSCE (Directiva N° 012-2017-OSCE/CD)
  readonly categoriasOSCE = CATEGORIAS_RIESGO_OSCE;
  readonly tablaProbabilidadOSCE = TABLA_PROBABILIDAD_OSCE;
  readonly tablaImpactoOSCE = TABLA_IMPACTO_OSCE;
  readonly estrategiasRespuesta: EstrategiaRespuestaRiesgo[] = [
    'MITIGAR',
    'EVITAR',
    'TRANSFERIR',
    'ACEPTAR',
  ];

  // Formulario reactivo para nuevo riesgo
  formRiesgo!: FormGroup;

  // Formulario reactivo para nueva acción de mitigación
  formAccion!: FormGroup;

  // Formulario reactivo para atender y cerrar riesgo
  formAtender!: FormGroup;

  // Proyecto reactivo según CUI
  readonly proyecto = computed<Proyecto | undefined>(() => {
    const c = this.cui();
    if (!c) return undefined;
    return this.projectService.getProyecto(c);
  });

  // Señales de reactividad en tiempo real para inputs de fórmula OSCE
  readonly causaInput = signal<string>('');
  readonly eventoInput = signal<string>('');
  readonly consecuenciaInput = signal<string>('');
  readonly probabilidadSeleccionada = signal<ProbabilidadNivelOSCE>('Alta');
  readonly impactoSeleccionado = signal<ImpactoNivelOSCE>('Alto');

  // Concatenación en vivo de la fórmula estándar OSCE:
  // "Debido a ...(causa)... podría ocurrir ...(evento)... lo que impactaría en ...(consecuencia)"
  readonly identificacionFormulada = computed<string>(() => {
    return formularIdentificacionRiesgo(
      this.causaInput(),
      this.eventoInput(),
      this.consecuenciaInput()
    );
  });

  // Cálculo en vivo de la evaluación cuantitativa OSCE (P × I = Resultado y Prioridad)
  readonly evaluacionCalculada = computed<EvaluacionRiesgoOSCE>(() => {
    return calcularRiesgoOSCE(
      this.probabilidadSeleccionada(),
      this.impactoSeleccionado()
    );
  });

  // Retrocompatibilidad con plantillas previas
  readonly semaforoCalculado = computed<SemaforoResult>(() => {
    return obtenerSemaforoRiesgo(this.evaluacionCalculada().resultado);
  });

  readonly nivelCalculado = computed<number>(() => {
    return this.evaluacionCalculada().resultado;
  });

  ngOnInit(): void {
    const paramCui = this.route.snapshot.paramMap.get('cui');
    if (paramCui) {
      this.cui.set(paramCui);
    }

    this.inicializarFormularios();
  }

  private inicializarFormularios(): void {
    this.formRiesgo = this.fb.group({
      categoria: ['Legales y contractuales', [Validators.required]],
      causa: ['', [Validators.required, Validators.minLength(4)]],
      evento: ['', [Validators.required, Validators.minLength(4)]],
      consecuencia: ['', [Validators.required, Validators.minLength(4)]],
      probabilidadNivel: ['Alta' as ProbabilidadNivelOSCE, [Validators.required]],
      impactoNivel: ['Alto' as ImpactoNivelOSCE, [Validators.required]],
      estrategiaRespuesta: ['MITIGAR' as EstrategiaRespuestaRiesgo, [Validators.required]],
    });

    // Suscripciones para reflejar cambios en las señales reactivas
    this.formRiesgo.get('causa')?.valueChanges.subscribe((v) => {
      this.causaInput.set(v || '');
    });

    this.formRiesgo.get('evento')?.valueChanges.subscribe((v) => {
      this.eventoInput.set(v || '');
    });

    this.formRiesgo.get('consecuencia')?.valueChanges.subscribe((v) => {
      this.consecuenciaInput.set(v || '');
    });

    this.formRiesgo.get('probabilidadNivel')?.valueChanges.subscribe((v) => {
      if (v) this.probabilidadSeleccionada.set(v);
    });

    this.formRiesgo.get('impactoNivel')?.valueChanges.subscribe((v) => {
      if (v) this.impactoSeleccionado.set(v);
    });

    this.formAccion = this.fb.group({
      descripcion: ['', [Validators.required, Validators.minLength(5)]],
      responsable: ['', [Validators.required]],
      fechaInicio: ['', [Validators.required]],
      fechaMeta: ['', [Validators.required]],
      avance: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      medioProbatorio: ['', [Validators.required]],
    });

    this.formAtender = this.fb.group({
      descripcion: ['', [Validators.required, Validators.minLength(5)]],
      evidencia: ['', [Validators.required]],
    });
  }

  toggleExpandirRiesgo(riesgoId: string): void {
    this.riesgoExpandidoId.update((actual) => (actual === riesgoId ? null : riesgoId));
  }

  toggleMatrizGuia(): void {
    this.mostrarMatrizGuia.update((v) => !v);
  }

  abrirFormularioRiesgo(): void {
    this.formRiesgo.reset({
      categoria: 'Legales y contractuales',
      causa: '',
      evento: '',
      consecuencia: '',
      probabilidadNivel: 'Alta',
      impactoNivel: 'Alto',
      estrategiaRespuesta: 'MITIGAR',
    });
    this.causaInput.set('');
    this.eventoInput.set('');
    this.consecuenciaInput.set('');
    this.probabilidadSeleccionada.set('Alta');
    this.impactoSeleccionado.set('Alto');
    this.mostrarFormularioRiesgo.set(true);
  }

  cancelarFormularioRiesgo(): void {
    this.mostrarFormularioRiesgo.set(false);
  }

  guardarNuevoRiesgo(): void {
    if (this.formRiesgo.invalid) {
      this.formRiesgo.markAllAsTouched();
      return;
    }

    const c = this.cui();
    if (!c) return;

    const v = this.formRiesgo.value;
    const evaluacion = calcularRiesgoOSCE(v.probabilidadNivel, v.impactoNivel);
    const formulaCompleta = formularIdentificacionRiesgo(
      v.causa,
      v.evento,
      v.consecuencia
    );

    const nuevoRiesgo: Riesgo = {
      id: `R-${Date.now().toString().slice(-4)}`,
      categoria: v.categoria,
      causa: v.causa.trim(),
      evento: v.evento.trim(),
      consecuencia: v.consecuencia.trim(),
      identificacionCompleta: formulaCompleta,

      // Retrocompatibilidad
      causaRaiz: v.causa.trim(),
      efecto: `${v.evento.trim()}, lo que impactaría en ${v.consecuencia.trim()}`,

      probabilidadNivel: evaluacion.probabilidadNivel,
      probabilidadValor: evaluacion.probabilidadValor,
      impactoNivel: evaluacion.impactoNivel,
      impactoValor: evaluacion.impactoValor,
      puntuacion: evaluacion.resultado,
      prioridad: evaluacion.prioridad,
      estrategiaRespuesta: v.estrategiaRespuesta,

      // Retrocompatibilidad numérica
      probabilidad: evaluacion.probabilidadValor,
      impacto: evaluacion.impactoValor,

      acciones: [],
    };

    this.projectService.addRiesgo(c, nuevoRiesgo);
    this.mostrarFormularioRiesgo.set(false);
    this.riesgoExpandidoId.set(nuevoRiesgo.id);
  }

  abrirFormularioAccion(riesgoId: string): void {
    this.atenderRiesgoId.set(null);
    this.formAccion.reset({
      descripcion: '',
      responsable: this.proyecto()?.responsablePnsr || '',
      fechaInicio: new Date().toISOString().substring(0, 10),
      fechaMeta: '',
      avance: 0,
      medioProbatorio: '',
    });
    this.agregarAccionRiesgoId.set(riesgoId);
  }

  cancelarFormularioAccion(): void {
    this.agregarAccionRiesgoId.set(null);
  }

  abrirFormularioAtender(riesgoId: string): void {
    this.agregarAccionRiesgoId.set(null);
    this.formAtender.reset({
      descripcion: '',
      evidencia: '',
    });
    this.atenderRiesgoId.set(riesgoId);
  }

  cancelarFormularioAtender(): void {
    this.atenderRiesgoId.set(null);
  }

  guardarAtencionRiesgo(riesgoId: string): void {
    if (this.formAtender.invalid) {
      this.formAtender.markAllAsTouched();
      return;
    }

    const c = this.cui();
    if (!c) return;

    const v = this.formAtender.value;
    this.projectService.atenderRiesgo(c, riesgoId, v.descripcion, v.evidencia);
    this.atenderRiesgoId.set(null);
  }

  guardarNuevaAccion(riesgoId: string): void {
    if (this.formAccion.invalid) {
      this.formAccion.markAllAsTouched();
      return;
    }

    const c = this.cui();
    if (!c) return;

    const v = this.formAccion.value;

    if (new Date(v.fechaMeta) < new Date(v.fechaInicio)) {
      alert('La fecha meta improrrogable no puede ser anterior a la fecha de inicio.');
      return;
    }

    const nuevaAccion: AccionMitigacion = {
      id: `ACT-${Date.now().toString().slice(-4)}`,
      descripcion: v.descripcion.trim(),
      responsable: v.responsable.trim(),
      fechaInicio: new Date(v.fechaInicio),
      fechaMeta: new Date(v.fechaMeta),
      avance: Number(v.avance),
      medioProbatorio: v.medioProbatorio.trim(),
    };

    this.projectService.addAccionMitigacion(c, riesgoId, nuevaAccion);
    this.agregarAccionRiesgoId.set(null);
  }

  // Helpers para visualización de tabla
  obtenerTextoIdentificacion(r: Riesgo): string {
    if (r.identificacionCompleta && r.identificacionCompleta.trim().length > 0) {
      return r.identificacionCompleta;
    }
    if (r.causa && r.evento && r.consecuencia) {
      return formularIdentificacionRiesgo(r.causa, r.evento, r.consecuencia);
    }
    if (r.causaRaiz && r.efecto) {
      return `Debido a ${r.causaRaiz} podría ocurrir ${r.efecto}.`;
    }
    return r.causaRaiz || r.efecto || 'Riesgo registrado sin desglose detallado';
  }

  obtenerPuntuacionNumerica(r: Riesgo): number {
    if (typeof r.puntuacion === 'number') {
      return r.puntuacion;
    }
    if (r.probabilidadValor && r.impactoValor) {
      return Math.round(r.probabilidadValor * r.impactoValor * 1000) / 1000;
    }
    if (r.probabilidad && r.impacto) {
      if (r.probabilidad <= 1 && r.impacto <= 1) {
        return Math.round(r.probabilidad * r.impacto * 1000) / 1000;
      }
      // Escala entera tradicional 1 a 25 convertida a ratio
      return Math.round((r.probabilidad * r.impacto) / 25 * 0.72 * 1000) / 1000;
    }
    return 0;
  }

  // Retrocompatibilidad para plantillas previas
  calcularNivel(r: Riesgo): number {
    return this.obtenerPuntuacionNumerica(r);
  }

  obtenerSemaforo(r: Riesgo | number): SemaforoResult {
    const valor = typeof r === 'number' ? r : this.obtenerPuntuacionNumerica(r);
    return obtenerSemaforoRiesgo(valor);
  }

  obtenerPuntuacionTexto(r: Riesgo): string {
    const val = this.obtenerPuntuacionNumerica(r);
    return val > 0 ? val.toFixed(3) : '—';
  }

  obtenerPrioridadTexto(r: Riesgo): PrioridadRiesgoOSCE {
    if (r.prioridad) return r.prioridad;
    const score = this.obtenerPuntuacionNumerica(r);
    if (score >= 0.180) return 'ALTA';
    if (score >= 0.070) return 'MODERADA';
    return 'BAJA';
  }

  obtenerPrioridadColor(prioridad: PrioridadRiesgoOSCE | string): {
    badgeClass: string;
    markerClass: string;
    label: string;
  } {
    switch (prioridad) {
      case 'ALTA':
        return {
          badgeClass: 'bg-red-100 text-red-800 border-red-300 font-bold',
          markerClass: 'bg-rojo-nacional',
          label: 'ALTA',
        };
      case 'MODERADA':
        return {
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
          markerClass: 'bg-amarillo-progreso',
          label: 'MODERADA',
        };
      case 'BAJA':
      default:
        return {
          badgeClass: 'bg-green-100 text-green-800 border-green-300 font-bold',
          markerClass: 'bg-verde-eficiencia',
          label: 'BAJA',
        };
    }
  }

  obtenerEstado(a: AccionMitigacion): EstadoPlazoResult {
    return obtenerEstadoPlazo(a.fechaMeta, a.avance);
  }

  obtenerPeorEstadoRiesgo(r: Riesgo): EstadoPlazoResult | null {
    if (!r.acciones || r.acciones.length === 0) return null;
    let peor: EstadoPlazoResult | null = null;
    for (const a of r.acciones) {
      const e = obtenerEstadoPlazo(a.fechaMeta, a.avance);
      if (!peor) {
        peor = e;
        continue;
      }
      if (e.estado === 'vencido' && peor.estado !== 'vencido') {
        peor = e;
      } else if (e.estado === 'por_vencer' && peor.estado !== 'vencido' && peor.estado !== 'por_vencer') {
        peor = e;
      }
    }
    return peor;
  }

  formatearFechaTexto(d: Date | null): string {
    if (!d) return '—';
    return formatearFecha(d);
  }

  esUrl(texto: string): boolean {
    return /^https?:\/\//i.test(texto);
  }
}
