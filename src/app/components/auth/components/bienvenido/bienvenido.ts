import { ChangeDetectorRef, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NavigationCancel, NavigationEnd, NavigationError, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { Spinner } from '../../../../animations/spinner/spinner';
import { WelcomeTourService } from '../../../../services/welcome-tour.service';


@Component({
  imports: [
    CommonModule,
    RouterModule,
    Spinner
  ],
  selector: 'app-bienvenido',
  standalone: true,
  templateUrl: './bienvenido.html',
  styleUrls: ['./bienvenido.css']
})
export class Bienvenido implements OnInit, OnDestroy {
  public readonly navegando = signal(true);

  public botones = [
    { link: '/visor', icono: 'assets/images/logos/geoico1.png', alt: 'Ícono de acceso al visor GIS', label: 'Ingresar al Geovisor', texto: 'VISOR' },
    { link: '/seguimiento/dashboard', icono: 'assets/images/logos/geoico3.png', alt: 'Ícono de acceso al dashboard', label: 'Ingresar al Dashboard', texto: 'DASHBOARD' },
    { link: '/seguimiento/reportes', icono: 'assets/images/logos/geoico5.png', alt: 'Ícono de acceso a reportes', label: 'Ingresar a Reportes', texto: 'REPORTES' },
    { link: '/geovisor/repositorio', icono: 'assets/images/logos/geoico2.png', alt: 'Ícono de acceso a documentación', label: 'Ingresar a Documentacion', texto: 'REPOSITORIO' },
    { link: '/geovisor/metadata', icono: 'assets/images/logos/geoico4.png', alt: 'Ícono de acceso a metadatos', label: 'Ingresar a Metadatos', texto: 'METADATA' }
  ];

  private readonly wallpaperDirectory = '/assets/images/wallpapers';
  private readonly backgroundImages = [`${this.wallpaperDirectory}/wallpaper1.png`];

  public backgrounds = [
    { url: '', fade: false },
    { url: '', fade: false }
  ];

  private intervalId: any;
  private initialLoadingTimeout?: ReturnType<typeof setTimeout>;
  private navigationTimeout?: ReturnType<typeof setTimeout>;
  private imageIndex = 0;
  private activeBgIndex = 0;
  private destroyed = false;
  private navigationSubscription?: Subscription;

  constructor(
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly router: Router,
    private readonly welcomeTourService: WelcomeTourService,
  ) { }

  ngOnInit(): void {
    this.startImageCarousel();
    void this.discoverBackgroundImages(2);
    this.initialLoadingTimeout = setTimeout(() => {
      this.initialLoadingTimeout = undefined;
      this.navegando.set(false);
    }, 5000);
    this.navigationSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd
        || event instanceof NavigationCancel
        || event instanceof NavigationError) {
        this.navegando.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.navigationSubscription?.unsubscribe();
    if (this.initialLoadingTimeout) {
      clearTimeout(this.initialLoadingTimeout);
    }
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  navegar(event: Event, disabled: boolean, destino: string): void {
    event.preventDefault();
    if (disabled || this.navegando()) {
      return;
    }

    this.navegando.set(true);
    this.navigationTimeout = setTimeout(() => {
      this.navigationTimeout = undefined;
      void this.router.navigateByUrl(destino).then(navegacionExitosa => {
        if (!navegacionExitosa) {
          this.navegando.set(false);
        }
      }).catch(error => {
        this.navegando.set(false);
        console.error(`No se pudo navegar a ${destino}`, error);
      });
    }, 100);
  }

  private async discoverBackgroundImages(index: number): Promise<void> {
    const imagePath = `${this.wallpaperDirectory}/wallpaper${index}.png`;
    let response: Response;

    try {
      response = await fetch(imagePath, { method: 'HEAD' });
    } catch (error) {
      if (!this.destroyed) {
        console.error(`Unable to check wallpaper image ${imagePath}`, error);
      }
      return;
    }

    if (this.destroyed || response.status === 404) {
      return;
    }

    if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('image/png')) {
      console.error(`Wallpaper image ${imagePath} is not a valid PNG (HTTP ${response.status})`);
      return;
    }

    this.backgroundImages.push(imagePath);
    await this.discoverBackgroundImages(index + 1);
  }

  private startImageCarousel(): void {
    // Configuración inicial: la primera imagen en el primer div, el segundo div está oculto.
    this.backgrounds[0].url = `url('${this.backgroundImages[this.imageIndex]}')`;
    this.backgrounds[1].url = '';
    this.backgrounds[0].fade = false; // Visible
    this.backgrounds[1].fade = true;  // Oculto
    this.activeBgIndex = 0;

    // Duración basada en la animación original de 35s con 4 pasos (0, 25, 50, 75)
    const intervalDuration = 35000 / 4; // 8750ms por imagen

    this.intervalId = setInterval(() => {
      // Avanza a la siguiente imagen
      this.imageIndex = (this.imageIndex + 1) % this.backgroundImages.length;
      // Elige el div que está actualmente oculto para poner la nueva imagen
      const nextBgIndex = (this.activeBgIndex + 1) % 2;

      this.backgrounds[nextBgIndex].url = `url('${this.backgroundImages[this.imageIndex]}')`;

      // Inicia la transición: oculta el div activo y muestra el siguiente
      this.backgrounds[this.activeBgIndex].fade = true;
      this.backgrounds[nextBgIndex].fade = false;

      // El div que acabamos de mostrar es ahora el activo
      this.activeBgIndex = nextBgIndex;
      this.changeDetectorRef.markForCheck();
    }, intervalDuration);
  }

  startTourWelcome() {
    this.welcomeTourService.startWelcomeTour();
  }

}
