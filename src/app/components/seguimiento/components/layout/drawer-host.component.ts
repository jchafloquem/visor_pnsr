import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { LayoutStore } from '../../core/layout/layout.store';
import { CompromisoDrawerComponent } from '../compromisos/components/compromiso-drawer.component';
import { PriorizadoDrawerComponent } from '../priorizados/components/priorizado-drawer.component';
import { ProjectDrawerComponent } from '../cartera/components/project-drawer.component';
import { RiesgoDrawerComponent } from '../riesgos/components/riesgo-drawer.component';
import { SeguimientoDrawerComponent } from '../avance-semanal/components/seguimiento-drawer.component';

@Component({
  selector: 'app-drawer-host',
  standalone: true,
  imports: [
    ProjectDrawerComponent,
    SeguimientoDrawerComponent,
    RiesgoDrawerComponent,
    CompromisoDrawerComponent,
    PriorizadoDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './drawer-host.component.html',
  styleUrl: './drawer-host.component.css',
})
export class DrawerHostComponent {
  readonly layout = inject(LayoutStore);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.layout.isDrawerOpen()) {
      this.layout.closeDrawer();
    }
  }
}
