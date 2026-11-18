import {
  Component,
  ElementRef,
  ViewChild,
  afterNextRender,
  inject,
  ChangeDetectorRef,
  effect,
  HostListener,
  signal,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
// Servicios y módulos

import { MapService } from '../../../../services/map.service';
import { DrawMeasureService } from '../../../../services/draw.service';
import { AuthService } from '../../../../services/auth.service';
// Componentes relacionados
import { Navbar } from './components/navbar/navbar';
import { Sidebar } from './components/sidebar/sidebar';
import { Funciones } from './components/functions/functions';
import { Spinner } from '../../../../animations/spinner/spinner';
import { Login } from '../../../auth/components/login/login';
import { CoordinateInfo } from './components/coordinate-info/coordinate-info';

import { Leyenda } from './components/sidebar/components/leyenda/leyenda';
/**
 * Componente principal de la interfaz del mapa.
 * Coordina la visualización de la barra de herramientas, barra lateral y los controles
 * interactivos del mapa central.
 */
@Component({
  selector: 'app-map',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    Navbar,
    Sidebar,
    Funciones,
    Spinner,
    CoordinateInfo,
    Leyenda
],
  templateUrl: './map.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './map.css',
})
export class MapComponent {
openLoginModal() {
throw new Error('Method not implemented.');
}
  /** Referencia al contenedor principal donde se inyecta el lienzo de OpenLayers */
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  /** Referencia al componente de funciones para invocar sus métodos. */
  @ViewChild(Funciones) funcionesComponent!: Funciones;

  public readonly mapService = inject(MapService);
  sidebarAbierto = false;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly drawMeasureService = inject(DrawMeasureService);
  /** Rastrea errores de carga de iframe por URL para mostrar mensaje de error. */
  private readonly iframeErrors = signal<Set<string>>(new Set());
  /** Rastrea qué iframes han cargado correctamente para ocultar el spinner. */
  private readonly iframeLoaded = signal<Set<string>>(new Set());
  /** Posición del modal de cruces de accesibilidad */
  cruceModalPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  /** Posición del modal de manzanas de accesibilidad */
  manzanaModalPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  /** Estado de arrastre para los modales */
  private cruceDragState: {
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null = null;
  private manzanaDragState: {
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null = null;

  constructor() {
    // Usamos un 'effect' para reaccionar a los cambios de la signal 'isReady'.
    // El effect debe crearse en el constructor para tener un contexto de inyección.
    effect(() => {
      if (this.mapService.isReady()) {
        setTimeout(() => {
          this.funcionesComponent.goHome();
          // Eliminamos la capa del INEI después de la animación inicial
          this.mapService.removeLayerById('ig_departamento');
        }, 2000); // 5 segundos
      }
    });

    // afterNextRender asegura que el mapa se inicialice solo en el cliente (navegador)
    afterNextRender(() => this.initMap());
  }
  /**
   * Solicita al servicio la creación de la instancia de OpenLayers pasando el
   * contenedor nativo del componente.
   */
  private initMap(): void {
    // Utilizamos el servicio para inicializar el mapa centralizando la lógica
    const map = this.mapService.initMap(this.mapContainer.nativeElement);
    // Una vez que el mapa está inicializado, lo pasamos al servicio de dibujo
    this.drawMeasureService.inicializar(map);

    this.cdr.detectChanges();
  }
  closeLeyenda(): void {
    this.mapService.closeLeyenda();
  }

  /**
   * Caché de URLs ya sanitizadas, indexada por la URL de origen.
   * CRÍTICO: `bypassSecurityTrustResourceUrl` devuelve un objeto nuevo en cada
   * llamada; si el binding [src] del iframe recibiera una instancia distinta en
   * cada ciclo de detección de cambios, Angular reescribiría el atributo `src`
   * y el iframe se recargaría indefinidamente (bucle de peticiones que congela
   * la interfaz y satura la red).
   */
  private readonly safeUrlCache = new Map<string, SafeResourceUrl>();

  /**
   * Sanitiza la URL para que sea segura de usar en un iframe, reutilizando el
   * resultado si la URL ya fue sanitizada (binding estable entre ciclos de CD).
   * @param url La URL a sanitizar.
   * @returns Una URL segura para recursos.
   */
  getSafeUrl(url: string): SafeResourceUrl {
    let safe = this.safeUrlCache.get(url);
    if (!safe) {
      safe = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      this.safeUrlCache.set(url, safe);
    }
    return safe;
  }

  /**
   * Maneja el evento de apertura/cierre del sidebar.
   * El panel es flotante (superpuesto), así que el mapa NO se desplaza:
   * conserva su centro y su navegación. Solo se refleja el estado para que
   * el CSS desplace la barra de escala fuera del área del panel.
   * @param isOpen El estado de apertura del sidebar.
   */
  handleSidebarToggle(isOpen: boolean): void {
    this.sidebarAbierto = isOpen;
  }
}
