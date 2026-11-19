import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { LayoutStore } from '../../../../core/layout/layout.store';
import { ProyectoSsp } from '../../../cartera/models/ssp.models';

let nextPickerId = 0;

@Component({
  selector: 'app-project-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-picker.component.html',
  styleUrl: './project-picker.component.css',
})
export class ProjectPickerComponent {
  private readonly layout = inject(LayoutStore);

  readonly projects = input.required<readonly ProyectoSsp[]>();
  readonly selectedCui = input.required<string>();
  readonly disabled = input<boolean>(false);
  readonly cuiChange = output<string>();

  readonly listId = `ssp-proj-pick-${++nextPickerId}`;

  readonly displayValue = computed<string>(() => {
    const cui = this.selectedCui();
    const match = this.projects().find((p) => p.cui === cui);
    return match ? `${match.cui} · ${match.corto}` : cui;
  });

  onValueChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const raw = inputEl.value.trim();
    const cuiMatch = raw.match(/\d{7}/)?.[0];
    const found = cuiMatch ? this.projects().find((p) => p.cui === cuiMatch) : undefined;

    if (!found) {
      this.layout.showToast('Elige un proyecto de la lista: escribe el CUI o el nombre');
      inputEl.value = this.displayValue();
      return;
    }

    inputEl.value = `${found.cui} · ${found.corto}`;
    if (found.cui !== this.selectedCui()) {
      this.cuiChange.emit(found.cui);
    }
  }
}
