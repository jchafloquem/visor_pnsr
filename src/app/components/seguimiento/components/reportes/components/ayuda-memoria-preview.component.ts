import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AmCell, AmDocument, AmTableBlock } from '../domain/ayuda-memoria.builder';

@Component({
  selector: 'app-ayuda-memoria-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ayuda-memoria-preview.component.html',
  styleUrl: './ayuda-memoria-preview.component.css',
})
export class AyudaMemoriaPreviewComponent {
  readonly doc = input.required<AmDocument>();

  getColPercentages(bk: AmTableBlock): string[] {
    const tot = bk.w.reduce((a, b) => a + b, 0) || 1;
    return bk.w.map((x) => ((x / tot) * 100).toFixed(2));
  }

  getCellAlign(cell: AmCell): string {
    if (!cell.jc) return 'left';
    return cell.jc === 'both' ? 'justify' : cell.jc;
  }

  isBold(runB?: number | boolean, cellB?: number | boolean): boolean {
    return runB != null ? !!runB : !!cellB;
  }

  isItalic(runI?: number | boolean, cellI?: number | boolean): boolean {
    return runI != null ? !!runI : !!cellI;
  }

  getCellFillClass(fill?: string): string {
    switch (fill) {
      case '16365C':
        return 'bg-azul-institucional-dark';
      case 'DAE6F2':
        return 'bg-azul-soft';
      case 'F2F2F2':
        return 'bg-surface-bg';
      case 'C00000':
        return 'bg-rojo-nacional';
      case 'ED7D31':
        return 'bg-risk-mid';
      case 'FFC000':
        return 'bg-amarillo-progreso';
      case '70AD47':
        return 'bg-verde-eficiencia';
      default:
        return '';
    }
  }

  getTextColorClass(color?: string): string {
    switch (color) {
      case 'FFFFFF':
        return 'text-white';
      case '16365C':
        return 'text-azul-institucional-dark';
      case 'C00000':
        return 'text-rojo-nacional';
      case 'C55A11':
        return 'text-risk-high-text';
      case '9C6500':
        return 'text-risk-mid-text';
      case '3B6E22':
        return 'text-risk-low-text';
      default:
        return '';
    }
  }
}
