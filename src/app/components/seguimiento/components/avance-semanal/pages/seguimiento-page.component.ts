import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SspAuthService } from '../../../core/auth/auth.service';
import { CORTE_FECHA } from '../../../core/config/institutional.constants';
import { LayoutStore } from '../../../core/layout/layout.store';
import { SspDomainStore } from '../../cartera/data-access/ssp-domain.store';
import {
  formatDateShort,
  isSegOk,
} from '../../cartera/domain/project-projection.rules';

@Component({
  selector: 'app-seguimiento-page',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[18px] w-full min-w-0' },
  templateUrl: './seguimiento-page.component.html',
  styleUrl: './seguimiento-page.component.css',
})
export class SeguimientoPageComponent {
  readonly store = inject(SspDomainStore);
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);

  readonly corte = CORTE_FECHA;

  readonly scopedProjects = computed(() => {
    const me = this.auth.currentUser();
    return this.store
      .proyectos()
      .filter((p) => (me.rol === 'reg' ? this.auth.isAssignedToMe(p.uo, p.asig) : true));
  });

  readonly completedCount = computed(() => {
    const segs = this.store.seguimientos();
    return this.scopedProjects().filter((p) => isSegOk(p, segs)).length;
  });

  readonly progressPct = computed(() => {
    const total = this.scopedProjects().length;
    return total ? (this.completedCount() / total) * 100 : 0;
  });

  readonly displayedRows = computed(() => {
    const segs = this.store.seguimientos();
    return this.scopedProjects()
      .map((p) => ({
        p,
        seg: segs[p.cui] || null,
        ok: isSegOk(p, segs),
      }))
      .sort((a, b) => Number(a.ok) - Number(b.ok))
      .slice(0, 60);
  });

  formatDate(iso: string | undefined | null): string {
    return formatDateShort(iso);
  }

  openSeguimiento(cui: string): void {
    this.layout.openDrawer({
      kind: 'seg',
      key: cui,
      cui,
      label: 'Volver al registro semanal',
    });
  }
}
