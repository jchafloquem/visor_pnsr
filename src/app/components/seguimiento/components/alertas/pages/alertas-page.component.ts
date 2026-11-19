import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SspAuthService } from '../../../core/auth/auth.service';
import { LayoutStore } from '../../../core/layout/layout.store';
import { SspDomainStore } from '../../cartera/data-access/ssp-domain.store';
import { AlertaSsp, SeveridadAlerta } from '../../cartera/models/ssp.models';

@Component({
  selector: 'app-alertas-page',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[18px] w-full min-w-0' },
  templateUrl: './alertas-page.component.html',
  styleUrl: './alertas-page.component.css',
})
export class AlertasPageComponent {
  readonly store = inject(SspDomainStore);
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);

  readonly severityCards = computed<
    ReadonlyArray<{
      sev: SeveridadAlerta;
      label: string;
      sub: string;
      count: number;
      valueClass: string;
    }>
  >(() => {
    const all = this.store.visibleAlertas();
    return [
      {
        sev: 'Crítica',
        label: 'Críticas',
        sub: 'Atender hoy',
        count: all.filter((a) => a.sev === 'Crítica').length,
        valueClass: 'text-rojo-nacional',
      },
      {
        sev: 'Alta',
        label: 'Altas',
        sub: 'Esta semana',
        count: all.filter((a) => a.sev === 'Alta').length,
        valueClass: 'text-risk-mid',
      },
      {
        sev: 'Media',
        label: 'Medias',
        sub: 'Para seguimiento',
        count: all.filter((a) => a.sev === 'Media').length,
        valueClass: 'text-azul-institucional',
      },
    ];
  });

  readonly filteredAlertas = computed(() => {
    const all = this.store.visibleAlertas();
    const f = this.store.alertSevFilter();
    return f ? all.filter((a) => a.sev === f) : all;
  });

  toggleSevFilter(sev: SeveridadAlerta): void {
    this.store.alertSevFilter.set(this.store.alertSevFilter() === sev ? '' : sev);
  }

  getSevDotClass(sev: SeveridadAlerta): string {
    if (sev === 'Crítica') return 'bg-rojo-nacional';
    if (sev === 'Alta') return 'bg-risk-mid';
    return 'bg-azul-institucional';
  }

  getSevTextClass(sev: SeveridadAlerta): string {
    if (sev === 'Crítica') return 'text-rojo-nacional';
    if (sev === 'Alta') return 'text-risk-mid-text';
    return 'text-azul-institucional';
  }

  openProject(cui: string): void {
    const p = this.store.getProject(cui);
    this.layout.openDrawer({
      kind: 'proj',
      key: cui,
      cui,
      tab: 'res',
      label: `Volver a ${p ? p.corto : cui}`,
    });
  }

  openRisk(id: string): void {
    this.layout.openDrawer({
      kind: 'risk',
      key: id,
      id,
      label: `Volver al riesgo ${id}`,
    });
  }

  openNewRisk(a: AlertaSsp): void {
    this.layout.openDrawer({
      kind: 'risk',
      key: `n-${a.p.cui}-${a.hid || ''}`,
      cui: a.p.cui,
      hitoId: a.hid || '',
      label: 'Volver al nuevo riesgo',
    });
  }
}
