import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import {
  ArcGISRestService,
  PERU_LIMITS_MAPSERVER_URL,
  PeruAdministrativeCatalog,
  PeruAdministrativeOption,
} from '../../../../../../../../services/arcgis-rest.service';
import { MapService } from '../../../../../../../../services/map.service';
import { PERU_ADMINISTRATIVE_LAYER_IDS } from '../../../../../../../../interfaces/controlCapasConfig';

type AtributosLimite = Record<string, unknown>;

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CommonModule, FormsModule],
  selector: 'app-busquedas',
  styleUrl: './busquedas.css',
  templateUrl: './busquedas.html',
})
export class Busquedas implements OnInit {
  private readonly arcgisRestService = inject(ArcGISRestService);
  private readonly mapService = inject(MapService);
  private readonly destroyRef = inject(DestroyRef);

  departamentos: PeruAdministrativeOption[] = [];
  provincias: PeruAdministrativeOption[] = [];
  distritos: PeruAdministrativeOption[] = [];
  departamentoSeleccionado = '';
  provinciaSeleccionada = '';
  distritoSeleccionado = '';
  cargandoDepartamentos = true;
  cargandoProvincias = true;
  cargandoDistritos = true;
  readonly buscando = signal(false);
  readonly tieneBusquedaResaltada = signal(false);
  mensajeError = '';

  private catalogo: PeruAdministrativeCatalog | null = null;
  private solicitudBusqueda = 0;

  ngOnInit(): void {
    this.arcgisRestService.getPeruAdministrativeCatalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: catalogo => {
          this.catalogo = catalogo;
          this.departamentos = catalogo.departments;
          this.cargandoDepartamentos = false;
          this.cargandoProvincias = false;
          this.cargandoDistritos = false;
        },
        error: error => {
          this.cargandoDepartamentos = false;
          this.cargandoProvincias = false;
          this.cargandoDistritos = false;
          this.mensajeError = 'No se pudieron cargar las ubicaciones. Intente nuevamente.';
          console.error('No se pudo cargar el catálogo de límites geográficos del Perú.', error);
        },
      });
  }

  onDepartamentoChange(codigo: string): void {
    this.departamentoSeleccionado = codigo;
    this.provinciaSeleccionada = '';
    this.distritoSeleccionado = '';
    this.provincias = this.catalogo?.provinces.filter(opcion => opcion.parentCode === codigo) ?? [];
    this.distritos = [];
    this.mensajeError = '';
    this.buscando.set(false);
    ++this.solicitudBusqueda;
  }

  onProvinciaChange(codigo: string): void {
    this.provinciaSeleccionada = codigo;
    this.distritoSeleccionado = '';
    this.distritos = this.catalogo?.districts.filter(opcion => opcion.parentCode === codigo) ?? [];
    this.mensajeError = '';
    this.buscando.set(false);
    ++this.solicitudBusqueda;
  }

  onDistritoChange(codigo: string): void {
    this.distritoSeleccionado = codigo;
    this.mensajeError = '';
    this.buscando.set(false);
    ++this.solicitudBusqueda;
  }

  buscar(): void {
    this.mensajeError = '';
    const seleccion = this.obtenerSeleccion();
    if (!seleccion) {
      this.mensajeError = 'Seleccione al menos un departamento para buscar.';
      return;
    }

    const solicitud = ++this.solicitudBusqueda;
    this.buscando.set(true);
    this.arcgisRestService.queryFeatures<AtributosLimite>(
      PERU_LIMITS_MAPSERVER_URL,
      seleccion.capaId,
      {
        where: `${seleccion.campoCodigo} = ${this.valorSql(seleccion.codigo)}`,
        outFields: ['OBJECTID'],
        returnGeometry: true,
        outSR: 3857,
        resultRecordCount: 1,
      }
    ).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (solicitud === this.solicitudBusqueda) {
          this.buscando.set(false);
        }
      })
    ).subscribe({
      next: response => {
        if (solicitud !== this.solicitudBusqueda) return;
        const geometry = response.features?.[0]?.geometry;
        if (!geometry) {
          this.mensajeError = 'No se encontró la geometría del área seleccionada.';
          return;
        }
        if (!this.mapService.fitToEsriGeometry(geometry)) {
          this.mensajeError = 'No se pudo resaltar el área geográfica seleccionada.';
          return;
        }
        this.tieneBusquedaResaltada.set(true);
      },
      error: error => {
        if (solicitud !== this.solicitudBusqueda) return;
        this.mensajeError = 'No se pudo completar la búsqueda. Intente nuevamente.';
        console.error('No se pudo buscar el límite geográfico seleccionado.', error);
      },
    });
  }

  limpiarBusqueda(): void {
    ++this.solicitudBusqueda;
    this.buscando.set(false);
    this.mapService.clearAdministrativeSearchHighlight();
    this.tieneBusquedaResaltada.set(false);
  }

  private obtenerSeleccion():
    | { capaId: number; campoCodigo: string; codigo: string }
    | null {
    if (this.distritoSeleccionado) {
      return {
        capaId: PERU_ADMINISTRATIVE_LAYER_IDS.districts,
        campoCodigo: 'id_dist',
        codigo: this.distritoSeleccionado,
      };
    }
    if (this.provinciaSeleccionada) {
      return {
        capaId: PERU_ADMINISTRATIVE_LAYER_IDS.provinces,
        campoCodigo: 'id_prov',
        codigo: this.provinciaSeleccionada,
      };
    }
    if (this.departamentoSeleccionado) {
      return {
        capaId: PERU_ADMINISTRATIVE_LAYER_IDS.departments,
        campoCodigo: 'id_dpto',
        codigo: this.departamentoSeleccionado,
      };
    }
    return null;
  }

  private valorSql(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }
}
