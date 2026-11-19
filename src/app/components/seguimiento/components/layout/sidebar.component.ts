import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SspAuthService } from '../../core/auth/auth.service';
import { LayoutStore, NavMode } from '../../core/layout/layout.store';
import { IconComponent } from '../shared/icons/icon.component';
import { IconName } from '../shared/icons/icon-registry';

export interface NavItemConfig {
  path: string;
  label: string;
  icon: IconName;
  iconColorClass?: string;
  badgeType?: 'seg' | 'alertas';
  uppOnly?: boolean;
}

export interface NavSectionConfig {
  title: string;
  items: readonly NavItemConfig[];
}

@Component({
  selector: 'app-ssp-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SspSidebarComponent {
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);

  readonly pendingSegCount = input<number>(0);
  readonly criticalAlertsCount = input<number>(0);

  readonly isHovered = signal<boolean>(false);

  readonly isExpandedOverlay = computed<boolean>(() => {
    const mode = this.layout.navMode();
    if (mode === 'iconos') return this.isHovered();
    if (mode === 'oculto') return this.layout.navPeek();
    return false;
  });

  readonly isCompactIcons = computed<boolean>(
    () => this.layout.navMode() === 'iconos' && !this.isHovered(),
  );

  readonly navModes: readonly {
    value: NavMode;
    title: string;
    description: string;
    icon: IconName;
  }[] = [
    {
      value: 'fijo',
      title: 'Fijo',
      description: 'Siempre visible con nombres',
      icon: 'sidebar-fixed',
    },
    {
      value: 'iconos',
      title: 'Solo íconos',
      description: 'Se abre al pasar el mouse',
      icon: 'sidebar-icons',
    },
    {
      value: 'oculto',
      title: 'Oculto',
      description: 'Aparece al pasar el mouse por el borde izquierdo o con el botón de menú',
      icon: 'sidebar-hidden',
    },
  ];

  readonly sections: readonly NavSectionConfig[] = [
    {
      title: 'SEGUIMIENTO',
      items: [
        { path: '/seguimiento/dashboard', label: 'Inicio', icon: 'home' },
        { path: '/seguimiento/cartera', label: 'Proyectos', icon: 'drop' },
        {
          path: '/seguimiento/avance-semanal',
          label: 'Registro semanal',
          icon: 'check-square',
          badgeType: 'seg',
        },
        {
          path: '/seguimiento/priorizados',
          label: 'Cartera priorizada',
          icon: 'star',
          iconColorClass: 'text-risk-mid-text',
        },
      ],
    },
    {
      title: 'GESTIÓN',
      items: [
        { path: '/seguimiento/riesgos', label: 'Riesgos', icon: 'alert-triangle' },
        {
          path: '/seguimiento/alertas',
          label: 'Alertas',
          icon: 'bell',
          badgeType: 'alertas',
        },
        {
          path: '/seguimiento/compromisos',
          label: 'Compromisos',
          icon: 'clipboard-check',
        },
      ],
    },
    {
      title: 'INFORMACIÓN',
      items: [
        { path: '/seguimiento/reportes', label: 'Reportes', icon: 'file-text' },
        {
          path: '/seguimiento/parametros',
          label: 'Parámetros',
          icon: 'sliders',
          uppOnly: true,
        },
      ],
    },
  ];

  setMode(mode: NavMode): void {
    this.layout.setNavMode(mode);
    const messages: Record<NavMode, string> = {
      fijo: 'Menú fijo',
      iconos: 'Menú solo con íconos: se abre al pasar el mouse',
      oculto: 'Menú oculto: pasa el mouse por el borde izquierdo o usa el botón de menú',
    };
    this.layout.showToast(messages[mode]);
  }

  onMouseLeave(): void {
    this.isHovered.set(false);
    if (this.layout.navMode() === 'oculto' && this.layout.navPeek()) {
      this.layout.setNavPeek(false);
    }
  }
}
