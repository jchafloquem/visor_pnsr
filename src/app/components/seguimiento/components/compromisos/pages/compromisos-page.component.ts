import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SspAuthService } from '../../../core/auth/auth.service';
import { CORTE_FECHA } from '../../../core/config/institutional.constants';
import { LayoutStore } from '../../../core/layout/layout.store';
import { IconComponent } from '../../shared/icons/icon.component';
import { SspDomainStore } from '../../cartera/data-access/ssp-domain.store';
import {
  diffDays,
  formatDateShort,
} from '../../cartera/domain/project-projection.rules';

@Component({
  selector: 'app-compromisos-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[18px] w-full min-w-0' },
  templateUrl: './compromisos-page.component.html',
  styleUrl: './compromisos-page.component.css',
})
export class CompromisosPageComponent {
  readonly store = inject(SspDomainStore);
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);

  readonly stats = computed(() => {
    const list = this.store.compromisos();
    return {
      pendientes: list.filter((x) => x.est === 'Pendiente').length,
      enCurso: list.filter((x) => x.est === 'En curso').length,
      vencidos: list.filter((x) => x.est !== 'Cumplido' && diffDays(x.f, CORTE_FECHA) < 0).length,
      cumplidos: list.filter((x) => x.est === 'Cumplido').length,
    };
  });

  readonly sortedRows = computed(() => {
    const byCui = this.store.projectByCui();
    return this.store
      .compromisos()
      .slice()
      .sort((a, b) => (a.f > b.f ? 1 : -1))
      .map((c) => {
        const vencido = c.est !== 'Cumplido' && diffDays(c.f, CORTE_FECHA) < 0;
        const badgeClass =
          c.est === 'Cumplido'
            ? 'bg-risk-low-bg text-risk-low-text'
            : vencido
              ? 'bg-risk-high-bg text-risk-high-text'
              : c.est === 'En curso'
                ? 'bg-azul-soft text-azul-institucional-dark'
                : 'bg-risk-mid-bg text-risk-mid-text';
        return {
          c,
          vencido,
          badgeClass,
          projectCorto: byCui[c.cui]?.corto || c.cui,
        };
      });
  });

  formatDate(iso: string | undefined | null): string {
    return formatDateShort(iso);
  }

  openCompromiso(id: string): void {
    this.layout.openDrawer({
      kind: 'comp',
      key: id,
      id,
      label: `Volver al compromiso ${id}`,
    });
  }

  openNewCompromiso(): void {
    this.layout.openDrawer({
      kind: 'comp',
      key: 'n-new',
      label: 'Volver al nuevo compromiso',
    });
  }
}
