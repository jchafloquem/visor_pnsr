import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectDataService } from '@app/services/project-data.service';
import {
  Proyecto,
  Hito,
} from '@app/components/projects/interfaces/project.interface';
import {
  formatearMoneda,
  formatearFecha,
} from '@app/components/projects/utils/project.utils';

function fechaHitoValidator(group: AbstractControl): ValidationErrors | null {
  const inicio = group.get('fechaInicioProgramada')?.value;
  const fin = group.get('fechaFinProgramada')?.value;
  if (inicio && fin) {
    const dInicio = new Date(inicio);
    const dFin = new Date(fin);
    if (dFin < dInicio) {
      return { fechaFinInvalida: true };
    }
  }
  return null;
}

function coordXValidator(control: AbstractControl): ValidationErrors | null {
  if (control.value === null || control.value === '' || control.value === undefined) {
    return null;
  }
  const val = Number(control.value);
  if (isNaN(val)) {
    return { coordInvalida: 'Debe ser un número válido' };
  }
  // Coordenada geográfica Perú (-82 a -68) o UTM Este (100,000 a 900,000)
  const isGeo = val >= -82 && val <= -68;
  const isUtm = val >= 100000 && val <= 900000;
  if (!isGeo && !isUtm) {
    return {
      coordXInvalida:
        'Coordenada X inválida. Ingrese Longitud (-82 a -68) o UTM Este (100000 a 900000)',
    };
  }
  return null;
}

function coordYValidator(control: AbstractControl): ValidationErrors | null {
  if (control.value === null || control.value === '' || control.value === undefined) {
    return null;
  }
  const val = Number(control.value);
  if (isNaN(val)) {
    return { coordInvalida: 'Debe ser un número válido' };
  }
  // Coordenada geográfica Perú (-19 a 0) o UTM Norte (7,800,000 a 10,000,000)
  const isGeo = val >= -19 && val <= 0;
  const isUtm = val >= 7800000 && val <= 10000000;
  if (!isGeo && !isUtm) {
    return {
      coordYInvalida:
        'Coordenada Y inválida. Ingrese Latitud (-19 a 0) o UTM Norte (7800000 a 10000000)',
    };
  }
  return null;
}

import { PnsrHeaderComponent } from '@app/shared/components/pnsr-header/pnsr-header.component';
import { PnsrFooterComponent } from '@app/shared/components/pnsr-footer/pnsr-footer.component';

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PnsrHeaderComponent, PnsrFooterComponent],
  templateUrl: './project-form.component.html',
  styleUrls: ['./project-form.component.css'],
})
export class ProjectFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly projectService = inject(ProjectDataService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Estados reactivos
  readonly isEditMode = signal<boolean>(false);
  readonly editingCui = signal<string | null>(null);
  readonly isLoadingProject = signal<boolean>(false);
  readonly isSearchingCui = signal<boolean>(false);
  readonly cuiFound = signal<boolean>(false);
  readonly cuiSearchMessage = signal<string | null>(null);
  readonly cuiSearchSuccess = signal<string | null>(null);
  readonly isSaved = signal<boolean>(false);
  readonly deleteConfirmationIndex = signal<number | null>(null);

  // Formulario reactivo principal
  projectForm!: FormGroup;

  // Opciones de cartera
  readonly carteras: Array<'UTP' | 'PIASAR' | 'Amazonia Rural'> = [
    'UTP',
    'PIASAR',
    'Amazonia Rural',
  ];

  // Opciones de estado de hito
  readonly estadosHito: Array<'Pendiente' | 'En Proceso' | 'Cumplido' | 'Retrasado'> = [
    'Pendiente',
    'En Proceso',
    'Cumplido',
    'Retrasado',
  ];

  ngOnInit(): void {
    this.buildForm();
    const cuiParam = this.route.snapshot.paramMap.get('cui');
    if (cuiParam) {
      this.isEditMode.set(true);
      this.editingCui.set(cuiParam);
      this.loadProjectForEdit(cuiParam);
    } else {
      // No existe registro de nuevo proyecto; solo se permite editar proyectos existentes para definir su prioridad
      this.router.navigate(['/proyectos']);
    }
  }

  private buildForm(): void {
    this.projectForm = this.fb.group({
      cui: [
        '',
        [
          Validators.required,
          Validators.pattern(/^\d{7}$/),
        ],
      ],
      nombre: ['', [Validators.required]],
      departamento: ['', [Validators.required]],
      provincia: ['', [Validators.required]],
      distrito: ['', [Validators.required]],
      localidad: ['', [Validators.required]],
      cartera: ['UTP', [Validators.required]],
      priorizado2026: [false],
      responsablePnsr: ['', [Validators.required, Validators.minLength(3)]],
      contratista: [''],
      coordenadaX: [null, [coordXValidator]],
      coordenadaY: [null, [coordYValidator]],
      costoInversion: [0],
      devengadoAcumulado: [0],
      estadoAdministrativo: ['En ejecución'],
      avanceFisicoReal: [0, [Validators.min(0), Validators.max(100)]],
      avanceFisicoProgramado: [0, [Validators.min(0), Validators.max(100)]],
      avanceFinanciero: [0, [Validators.min(0), Validators.max(100)]],
      hitos: this.fb.array([]),
    });
  }

  get hitosArray(): FormArray {
    return this.projectForm.get('hitos') as FormArray;
  }

  private loadProjectForEdit(cui: string): void {
    this.isLoadingProject.set(true);
    const proyecto = this.projectService.getProyecto(cui);

    if (!proyecto) {
      this.isLoadingProject.set(false);
      this.cuiSearchMessage.set(`No se encontró el proyecto con CUI ${cui}.`);
      return;
    }

    // Cargar datos en el formulario
    this.projectForm.patchValue({
      cui: proyecto.cui,
      nombre: proyecto.nombre,
      departamento: proyecto.departamento,
      provincia: proyecto.provincia,
      distrito: proyecto.distrito,
      localidad: proyecto.localidad,
      cartera: proyecto.cartera,
      priorizado2026: proyecto.priorizado2026,
      responsablePnsr: proyecto.responsablePnsr,
      contratista: proyecto.contratista,
      coordenadaX: proyecto.coordenadaX,
      coordenadaY: proyecto.coordenadaY,
      costoInversion: proyecto.costoInversion,
      devengadoAcumulado: proyecto.devengadoAcumulado,
      estadoAdministrativo: proyecto.estadoAdministrativo,
      avanceFisicoReal: proyecto.avanceFisicoReal,
      avanceFisicoProgramado: proyecto.avanceFisicoProgramado,
      avanceFinanciero: proyecto.avanceFinanciero,
    });

    // Deshabilitar campos protegidos provenientes del Banco de Inversiones (SSI MEF / SSP)
    // El usuario únicamente define la prioridad del proyecto en la cartera
    this.projectForm.get('cui')?.disable();
    this.projectForm.get('nombre')?.disable();
    this.projectForm.get('departamento')?.disable();
    this.projectForm.get('provincia')?.disable();
    this.projectForm.get('distrito')?.disable();
    this.projectForm.get('localidad')?.disable();
    this.projectForm.get('costoInversion')?.disable();
    this.projectForm.get('devengadoAcumulado')?.disable();
    this.projectForm.get('estadoAdministrativo')?.disable();
    this.projectForm.get('avanceFisicoReal')?.disable();
    this.projectForm.get('avanceFisicoProgramado')?.disable();
    this.projectForm.get('avanceFinanciero')?.disable();
    this.projectForm.get('contratista')?.disable();
    this.projectForm.get('coordenadaX')?.disable();
    this.projectForm.get('coordenadaY')?.disable();

    // Poblar hitos
    this.hitosArray.clear();
    if (proyecto.hitos && proyecto.hitos.length > 0) {
      proyecto.hitos.forEach((hito) => {
        this.hitosArray.push(this.createHitoGroup(hito));
      });
    }

    this.isLoadingProject.set(false);
    this.cuiFound.set(true);
  }

  private createHitoGroup(hito?: Partial<Hito>): FormGroup {
    const inicioStr = hito?.fechaInicioProgramada
      ? this.toDateInputString(hito.fechaInicioProgramada)
      : '';
    const finStr = hito?.fechaFinProgramada
      ? this.toDateInputString(hito.fechaFinProgramada)
      : '';
    const realStr = hito?.fechaReal
      ? this.toDateInputString(hito.fechaReal)
      : '';

    return this.fb.group(
      {
        id: [hito?.id || `H-${Date.now()}-${Math.floor(Math.random() * 1000)}`],
        descripcion: [hito?.descripcion || '', [Validators.required]],
        fechaInicioProgramada: [inicioStr, [Validators.required]],
        fechaFinProgramada: [finStr, [Validators.required]],
        fechaReal: [realStr],
        avanceEsperado: [
          hito?.avanceEsperado ?? 0,
          [Validators.required, Validators.min(0), Validators.max(100)],
        ],
        estado: [hito?.estado || 'Pendiente', [Validators.required]],
        responsable: [hito?.responsable || '', [Validators.required]],
      },
      { validators: [fechaHitoValidator] }
    );
  }

  private toDateInputString(date: Date | string): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Consulta simulada SSI MEF / SSP
  lookupCui(): void {
    if (this.isEditMode()) return;

    const cuiControl = this.projectForm.get('cui');
    if (!cuiControl || cuiControl.invalid) {
      this.cuiSearchMessage.set('Ingrese un CUI válido de 7 dígitos numéricos.');
      this.cuiSearchSuccess.set(null);
      return;
    }

    const cuiVal = String(cuiControl.value).trim();
    if (cuiVal.length !== 7 || !/^\d{7}$/.test(cuiVal)) {
      this.cuiSearchMessage.set('El CUI debe contener exactamente 7 dígitos.');
      this.cuiSearchSuccess.set(null);
      return;
    }

    this.isSearchingCui.set(true);
    this.cuiSearchMessage.set(null);
    this.cuiSearchSuccess.set(null);

    setTimeout(() => {
      // Simulación de búsqueda
      const existing = this.projectService.getProyecto(cuiVal);

      if (existing) {
        this.projectForm.patchValue({
          nombre: existing.nombre,
          departamento: existing.departamento,
          provincia: existing.provincia,
          distrito: existing.distrito,
          localidad: existing.localidad,
          contratista: existing.contratista,
          costoInversion: existing.costoInversion,
          devengadoAcumulado: existing.devengadoAcumulado,
          estadoAdministrativo: existing.estadoAdministrativo,
          avanceFisicoReal: existing.avanceFisicoReal,
          avanceFisicoProgramado: existing.avanceFisicoProgramado,
          avanceFinanciero: existing.avanceFinanciero,
        });

        if (this.hitosArray.length === 0 && existing.hitos.length > 0) {
          existing.hitos.forEach((h) => this.hitosArray.push(this.createHitoGroup(h)));
        }

        this.cuiFound.set(true);
        this.cuiSearchSuccess.set(
          'Proyecto encontrado. Datos autocompletados desde SSI MEF y SSP.'
        );
      } else if (cuiVal === '0000000') {
        this.cuiFound.set(false);
        this.cuiSearchMessage.set(
          'CUI no encontrado en los registros de SSI MEF ni SSP.'
        );
      } else {
        // Datos simulados oficiales de SSI/SSP para nuevo CUI válido
        this.projectForm.patchValue({
          nombre: `Instalación y mejoramiento del servicio de agua potable y saneamiento rural en la localidad del CUI ${cuiVal}`,
          costoInversion: 5200000,
          devengadoAcumulado: 1450000,
          estadoAdministrativo: 'En ejecución',
          departamento: 'Junín',
          provincia: 'Concepción',
          distrito: 'Mito',
          localidad: 'Sector Central',
          contratista: 'Consorcio Saneamiento Rural Centro',
          avanceFisicoReal: 28.0,
          avanceFisicoProgramado: 32.5,
          avanceFinanciero: 27.8,
        });

        this.cuiFound.set(true);
        this.cuiSearchSuccess.set(
          'Consulta exitosa: Información sincronizada desde SSI MEF y SSP.'
        );
      }

      this.isSearchingCui.set(false);
    }, 1000);
  }

  onCuiBlur(): void {
    if (!this.isEditMode() && !this.cuiFound()) {
      const cuiVal = this.projectForm.get('cui')?.value;
      if (cuiVal && String(cuiVal).trim().length === 7) {
        this.lookupCui();
      }
    }
  }

  // Toggle priorizado2026
  togglePriorizado(): void {
    const current = this.projectForm.get('priorizado2026')?.value;
    this.projectForm.patchValue({ priorizado2026: !current });
    this.projectForm.get('priorizado2026')?.markAsDirty();
  }

  // Hitos master-detail
  agregarHito(): void {
    this.hitosArray.push(this.createHitoGroup());
  }

  confirmarEliminarHito(index: number): void {
    this.deleteConfirmationIndex.set(index);
  }

  cancelarEliminarHito(): void {
    this.deleteConfirmationIndex.set(null);
  }

  eliminarHito(index: number): void {
    this.hitosArray.removeAt(index);
    this.deleteConfirmationIndex.set(null);
  }

  // Navegar a mapa con coordenadas
  verUbicacionEnMapa(): void {
    const x = this.projectForm.get('coordenadaX')?.value;
    const y = this.projectForm.get('coordenadaY')?.value;
    const cui = this.isEditMode()
      ? this.editingCui()
      : this.projectForm.get('cui')?.value;

    if (x !== null && y !== null && x !== '' && y !== '') {
      this.router.navigate(['/visor'], {
        queryParams: { x, y, cui: cui || undefined },
      });
    } else {
      this.router.navigate(['/visor']);
    }
  }

  // Formateadores auxiliares para visualización
  formatSoles(val: number): string {
    return formatearMoneda(val || 0);
  }

  // Guardar proyecto
  onSubmit(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      this.scrollToFirstError();
      return;
    }

    const formValues = this.projectForm.getRawValue();

    // Mapear hitos a formato de modelo con fechas Date
    const hitosFormateados: Hito[] = (formValues.hitos || []).map(
      (h: {
        id: string;
        descripcion: string;
        fechaInicioProgramada: string;
        fechaFinProgramada: string;
        fechaReal: string | null;
        avanceEsperado: number;
        estado: 'Pendiente' | 'En Proceso' | 'Cumplido' | 'Retrasado';
        responsable: string;
      }) => ({
        id: h.id || `H-${Date.now()}`,
        descripcion: h.descripcion,
        fechaInicioProgramada: new Date(h.fechaInicioProgramada),
        fechaFinProgramada: new Date(h.fechaFinProgramada),
        fechaReal: h.fechaReal ? new Date(h.fechaReal) : null,
        avanceEsperado: Number(h.avanceEsperado),
        estado: h.estado,
        responsable: h.responsable,
      })
    );

    const existingProject = this.isEditMode() && this.editingCui()
      ? this.projectService.getProyecto(this.editingCui()!)
      : null;

    const proyectoFinal: Proyecto = {
      cui: String(formValues.cui).trim(),
      nombre: formValues.nombre,
      departamento: formValues.departamento,
      provincia: formValues.provincia,
      distrito: formValues.distrito,
      localidad: formValues.localidad,
      cartera: formValues.cartera,
      priorizado2026: Boolean(formValues.priorizado2026),
      responsablePnsr: formValues.responsablePnsr,
      contratista: formValues.contratista || 'Sin contratista asignado',
      coordenadaX:
        formValues.coordenadaX !== null && formValues.coordenadaX !== ''
          ? Number(formValues.coordenadaX)
          : null,
      coordenadaY:
        formValues.coordenadaY !== null && formValues.coordenadaY !== ''
          ? Number(formValues.coordenadaY)
          : null,
      costoInversion: Number(formValues.costoInversion || 0),
      devengadoAcumulado: Number(formValues.devengadoAcumulado || 0),
      estadoAdministrativo: formValues.estadoAdministrativo || 'En ejecución',
      avanceFisicoReal: Number(formValues.avanceFisicoReal || 0),
      avanceFisicoProgramado: Number(formValues.avanceFisicoProgramado || 0),
      avanceFinanciero: Number(formValues.avanceFinanciero || 0),
      fuenteSSI: true,
      fuenteSSP: true,
      hitos: hitosFormateados,
      riesgos: existingProject?.riesgos || [],
    };

    if (this.isEditMode()) {
      this.projectService.updateProyecto(proyectoFinal);
    } else {
      this.projectService.addProyecto(proyectoFinal);
    }

    this.isSaved.set(true);
    this.router.navigate(['/proyectos/detalle', proyectoFinal.cui]);
  }

  // Cancelar con confirmación si hay cambios sin guardar
  cancelar(): void {
    if (this.projectForm.dirty && !this.isSaved()) {
      const confirma = confirm(
        'Tiene cambios no guardados en el formulario. ¿Está seguro de salir sin guardar?'
      );
      if (!confirma) {
        return;
      }
    }
    this.router.navigate(['/proyectos']);
  }

  private scrollToFirstError(): void {
    const firstInvalid = document.querySelector('.ng-invalid');
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}
