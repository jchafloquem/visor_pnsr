import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ICON_REGISTRY, IconDefinition, IconName } from './icon-registry';

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex items-center justify-center shrink-0',
  },
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.css',
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input<number>(20);
  readonly ariaLabel = input<string>('');

  readonly definition = computed<IconDefinition>(
    () => ICON_REGISTRY[this.name()] ?? ICON_REGISTRY.home,
  );
}
