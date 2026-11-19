import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  ImpactoLabel,
  NivelRiesgoBase,
  ParametrosSsp,
  ProbabilidadLabel,
  RiesgoSsp,
} from '../../cartera/models/ssp.models';
import {
  IMPACTO_LABELS,
  nivelFromScore,
  PROBABILIDAD_LABELS,
} from '../../riesgos/domain/risk.rules';

export interface MatrixCellEvent {
  p: ProbabilidadLabel;
  i: ImpactoLabel;
}

@Component({
  selector: 'app-risk-matrix',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './risk-matrix.component.html',
  styleUrl: './risk-matrix.component.css',
})
export class RiskMatrixComponent {
  readonly risks = input<readonly RiesgoSsp[]>([]);
  readonly params = input.required<ParametrosSsp>();
  readonly selectedCell = input<MatrixCellEvent | null>(null);
  readonly clickable = input<boolean>(true);
  readonly compact = input<boolean>(false);
  readonly cellSelect = output<MatrixCellEvent>();

  readonly probabilidadLabels = PROBABILIDAD_LABELS;
  readonly impactoLabels = IMPACTO_LABELS;

  readonly matrixRows = computed(() => {
    const pr = this.params();
    const list = this.risks();
    const sel = this.selectedCell();
    return this.probabilidadLabels.map((p) => ({
      p,
      cells: this.impactoLabels.map((i) => {
        const score = +(pr.P[p] * pr.I[i]).toFixed(3);
        const nivel = nivelFromScore(score, pr);
        const count = list.filter((r) => r.p === p && r.i === i).length;
        const selected = !!sel && sel.p === p && sel.i === i;
        return { i, score, nivel, count, selected };
      }),
    }));
  });

  onCellClick(p: ProbabilidadLabel, i: ImpactoLabel): void {
    if (!this.clickable()) return;
    this.cellSelect.emit({ p, i });
  }

  getCellColorClass(nivel: NivelRiesgoBase): string {
    switch (nivel) {
      case 'ALTA':
        return 'bg-risk-high-bg text-risk-high-text border-rojo-nacional/30';
      case 'MODERADA':
        return 'bg-risk-mid-bg text-risk-mid-text border-risk-mid/40';
      case 'BAJA':
        return 'bg-risk-low-bg text-risk-low-text border-verde-eficiencia/35';
    }
  }
}
