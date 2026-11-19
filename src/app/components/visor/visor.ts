import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-visor',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './visor.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './visor.css',
})
export default class Visor {}
