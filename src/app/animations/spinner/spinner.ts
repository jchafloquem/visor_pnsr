import { Component, input, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [],
  templateUrl: './spinner.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './spinner.css',
})
export class Spinner {
  /** Tamaño del spinner (clases de Tailwind) */
  size = input<string>('h-10 w-10');
  /** Color del spinner (clases de Tailwind) */
  color = input<string>('text-blue-700');
  /** Imagen central predeterminada del spinner; se puede reemplazar u ocultar. */
  imageUrl = input<string | null>('assets/images/spinner.png');
  /** Muestra wallpaper0 como fondo de pantalla completa durante la carga */
  showBackground = input(false);
}

