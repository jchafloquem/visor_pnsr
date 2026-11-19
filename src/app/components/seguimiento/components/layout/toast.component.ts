import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LayoutStore } from '../../core/layout/layout.store';

@Component({
  selector: 'app-ssp-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css',
})
export class SspToastComponent {
  readonly layout = inject(LayoutStore);
}
