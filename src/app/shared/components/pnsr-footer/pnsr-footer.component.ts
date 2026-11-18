import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pnsr-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pnsr-footer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PnsrFooterComponent {
  readonly anioActual = new Date().getFullYear();
}
