import { ChangeDetectionStrategy, Component } from '@angular/core';
import { INSTITUTIONAL_CONFIG } from '../../core/config/institutional.constants';

@Component({
  selector: 'app-ssp-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class SspFooterComponent {
  readonly config = INSTITUTIONAL_CONFIG;
}
