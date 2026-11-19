import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-seguimiento',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './seguimiento.html',
  styleUrl: './seguimiento.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Seguimiento {}
