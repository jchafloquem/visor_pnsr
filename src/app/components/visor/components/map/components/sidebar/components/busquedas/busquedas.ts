import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [],
  selector: 'app-busquedas',
  styleUrl: './busquedas.css',
  templateUrl: './busquedas.html',
})
export class Busquedas {}
