import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface SparklinePoint {
  fis: number;
  prog: number;
}

@Component({
  selector: 'app-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sparkline.component.html',
  styleUrl: './sparkline.component.css',
})
export class SparklineComponent {
  readonly points = input.required<readonly SparklinePoint[]>();
  readonly currentFis = input<number | null>(null);

  readonly W = 300;
  readonly Hh = 90;

  readonly plannedPath = computed(() => {
    const pts = this.points();
    const n = pts.length;
    if (n < 2) return '';
    return pts
      .map((h, i) => {
        const x = ((i / (n - 1)) * this.W).toFixed(1);
        const y = (this.Hh - (h.prog / 100) * this.Hh).toFixed(1);
        return `${i ? 'L' : 'M'}${x},${y}`;
      })
      .join('');
  });

  readonly actualPath = computed(() => {
    const pts = this.points();
    const n = pts.length;
    if (n < 2) return '';
    return pts
      .map((h, i) => {
        const x = ((i / (n - 1)) * this.W).toFixed(1);
        const y = (this.Hh - (h.fis / 100) * this.Hh).toFixed(1);
        return `${i ? 'L' : 'M'}${x},${y}`;
      })
      .join('');
  });

  readonly actualAreaPath = computed(() => {
    const line = this.actualPath();
    if (!line) return '';
    return `${line}L${this.W},${this.Hh}L0,${this.Hh}Z`;
  });

  readonly endCy = computed(() => {
    const pts = this.points();
    const fis = this.currentFis() ?? (pts.length ? pts[pts.length - 1].fis : 0);
    return (this.Hh - (fis / 100) * this.Hh).toFixed(1);
  });
}
