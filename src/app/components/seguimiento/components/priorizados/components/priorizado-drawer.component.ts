import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { SspAuthService } from '../../../core/auth/auth.service';
import { LayoutStore } from '../../../core/layout/layout.store';
import { IconComponent } from '../../shared/icons/icon.component';
import { ProjectPickerComponent } from '../../shared/ui/project-picker/project-picker.component';
import { SspDomainStore } from '../../cartera/data-access/ssp-domain.store';
import { PriorizadoTipo } from '../../cartera/models/ssp.models';

@Component({
  selector: 'app-priorizado-drawer',
  standalone: true,
  imports: [IconComponent, ProjectPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col flex-auto min-h-0 overflow-hidden' },
  templateUrl: './priorizado-drawer.component.html',
  styleUrl: './priorizado-drawer.component.css',
})
export class PriorizadoDrawerComponent {
  readonly store = inject(SspDomainStore);
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);

  readonly initialCui = input<string | undefined>(undefined);
  readonly modo = input<'nuevo' | 'edit' | 'out'>('nuevo');

  readonly selectedCui = signal<string>('');
  readonly tipo = signal<PriorizadoTipo>('Compromiso');
  readonly meta = signal<string>('Culminar la obra');
  readonly fm = signal<string>('2026-12-31');
  readonly sust = signal<string>('');
  readonly mot = signal<string>('');
  readonly ev = signal<string>('');

  readonly previousDrawer = this.layout.previousDrawer;
  readonly metasList = [
    'Culminar la obra',
    'Aprobar el expediente técnico',
    'Aprobar la ficha técnica',
    'Convocar el saldo de obra (destrabe)',
    'Iniciar la obra',
  ];

  readonly nonPrioritizedProjects = computed(() =>
    this.store.proyectos().filter((p) => !p.pri)
  );

  readonly title = computed(() => {
    const m = this.modo();
    if (m === 'nuevo') return 'Incluir en la cartera priorizada';
    if (m === 'edit') return 'Cambiar la priorización';
    return 'Retirar de la cartera priorizada';
  });

  readonly projectCorto = computed(() => {
    const p = this.store.getProject(this.selectedCui());
    return p ? p.corto : this.selectedCui();
  });

  constructor() {
    effect(() => {
      const cuiArg = this.initialCui();
      const nonPri = this.nonPrioritizedProjects();
      const targetCui =
        cuiArg || (nonPri.length ? nonPri[0].cui : this.store.proyectos()[0].cui);
      const existing = this.store.priorizados()[targetCui];

      this.selectedCui.set(targetCui);
      this.tipo.set(existing ? existing.tipo : 'Compromiso');
      this.meta.set(existing ? existing.meta : 'Culminar la obra');
      this.fm.set(existing ? existing.fm : '2026-12-31');
      this.sust.set(existing ? existing.sust : '');
      this.mot.set('');
      this.ev.set('');
    });
  }

  onTipoChange(event: Event): void {
    this.tipo.set((event.target as HTMLSelectElement).value as PriorizadoTipo);
  }

  onMetaChange(event: Event): void {
    this.meta.set((event.target as HTMLSelectElement).value);
  }

  onFmChange(event: Event): void {
    this.fm.set((event.target as HTMLInputElement).value);
  }

  onSustInput(event: Event): void {
    this.sust.set((event.target as HTMLInputElement).value);
  }

  onMotInput(event: Event): void {
    this.mot.set((event.target as HTMLTextAreaElement).value);
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.ev.set(file.name);
    }
  }

  savePriorizado(): void {
    const m = this.modo();
    if (m !== 'nuevo' && !this.mot().trim()) {
      this.layout.showToast('Escribe el motivo del cambio');
      return;
    }
    if (m !== 'out' && !this.sust().trim() && !this.ev()) {
      this.layout.showToast('Indica el sustento o adjunta el documento');
      return;
    }

    this.store.savePriorizado({
      modo: m,
      cui: this.selectedCui(),
      tipo: this.tipo(),
      meta: this.meta(),
      fm: this.fm(),
      sust: this.sust().trim() || this.ev(),
      mot: this.mot().trim(),
    });

    this.layout.completeCurrentDrawer();
    this.layout.showToast(
      `Cartera priorizada actualizada por ${this.auth.currentUser().nombre}`
    );
  }

  goBack(): void {
    this.layout.goBackDrawer();
  }

  close(): void {
    this.layout.closeDrawer();
  }
}
