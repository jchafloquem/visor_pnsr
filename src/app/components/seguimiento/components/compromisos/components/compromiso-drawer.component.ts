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
import { CORTE_FECHA } from '../../../core/config/institutional.constants';
import { LayoutStore } from '../../../core/layout/layout.store';
import { IconComponent } from '../../shared/icons/icon.component';
import { ProjectPickerComponent } from '../../shared/ui/project-picker/project-picker.component';
import { SspDomainStore } from '../../cartera/data-access/ssp-domain.store';
import { formatDateShort } from '../../cartera/domain/project-projection.rules';
import { CompromisoSsp, EstadoCompromiso } from '../../cartera/models/ssp.models';

@Component({
  selector: 'app-compromiso-drawer',
  standalone: true,
  imports: [IconComponent, ProjectPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col flex-auto min-h-0 overflow-hidden' },
  templateUrl: './compromiso-drawer.component.html',
  styleUrl: './compromiso-drawer.component.css',
})
export class CompromisoDrawerComponent {
  readonly store = inject(SspDomainStore);
  readonly auth = inject(SspAuthService);
  readonly layout = inject(LayoutStore);

  readonly compId = input<string | undefined>(undefined);
  readonly initialCui = input<string | undefined>(undefined);

  readonly draft = signal<CompromisoSsp | null>(null);
  readonly previousDrawer = this.layout.previousDrawer;
  readonly estadosList: readonly EstadoCompromiso[] = ['Pendiente', 'En curso', 'Cumplido'];

  constructor() {
    effect(() => {
      const id = this.compId();
      const cuiArg = this.initialCui();
      const me = this.auth.currentUser();

      if (id) {
        const found = this.store.compromisos().find((c) => c.id === id);
        if (found) {
          this.draft.set(JSON.parse(JSON.stringify(found)) as CompromisoSsp);
          return;
        }
      }

      const defaultCui = cuiArg || this.store.proyectos()[0].cui;
      this.draft.set({
        id: '',
        cui: defaultCui,
        prob: '',
        dec: '',
        resp: '',
        f: '',
        est: 'Pendiente',
        ev: '',
        por: me.id,
        fr: CORTE_FECHA,
      });
    });
  }

  readonly authorUser = computed(() => {
    const c = this.draft();
    return this.auth.getUserById(c?.por);
  });

  readonly authorInitials = computed(() => {
    return this.auth.getInitials(this.authorUser().nombre);
  });

  readonly readOnly = computed(() => {
    const c = this.draft();
    if (!c) return true;
    const p = this.store.getProject(c.cui);
    if (!p) return true;
    const me = this.auth.currentUser();
    return me.rol === 'reg' && !this.auth.canEditUnit(p.uo);
  });

  formatDate(iso: string | undefined | null): string {
    return formatDateShort(iso);
  }

  updateFieldFromEvent<K extends keyof CompromisoSsp>(key: K, event: Event): void {
    const val = (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
    this.updateField(key, val as CompromisoSsp[K]);
  }

  updateField<K extends keyof CompromisoSsp>(key: K, value: CompromisoSsp[K]): void {
    this.draft.update((curr) => (curr ? { ...curr, [key]: value } : curr));
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.draft.update((curr) =>
      curr ? { ...curr, ev: file.name, est: 'Cumplido' } : curr
    );
    this.layout.showToast('Evidencia adjuntada: compromiso cumplido');
  }

  saveCompromiso(): void {
    const c = this.draft();
    if (!c) return;
    if (!c.prob.trim() || !c.dec.trim() || !c.resp.trim() || !c.f) {
      this.layout.showToast('Completa problema, decisión, responsable y fecha');
      return;
    }
    const saved = this.store.saveCompromiso(c);
    this.layout.completeCurrentDrawer();
    this.layout.showToast(`Compromiso ${saved.id} guardado`);
  }

  openProjectDrawer(cui: string): void {
    const p = this.store.getProject(cui);
    this.layout.openDrawer({
      kind: 'proj',
      key: cui,
      cui,
      tab: 'res',
      label: `Volver a ${p ? p.corto : cui}`,
    });
  }

  goBack(): void {
    this.layout.goBackDrawer();
  }

  close(): void {
    this.layout.closeDrawer();
  }
}
