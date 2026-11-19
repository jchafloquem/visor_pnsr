import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CORTE_FECHA } from '../../../../core/config/institutional.constants';
import { IconComponent } from '../../icons/icon.component';
import {
  CURVA_S_SERIES,
  CurvaSDisplayPoint,
  CurvaSGranularity,
  CurvaSPreset,
  CurvaSSeriesKey,
  CurvaSWeeklyPoint,
  MESES_CORTOS,
  MESES_LARGOS,
} from './curva-s.models';

@Component({
  selector: 'app-curva-s',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './curva-s.component.html',
  styleUrl: './curva-s.component.css',
})
export class CurvaSComponent {
  readonly projectName = input<string>('');
  readonly etapa = input<string>('Ejecución de obra');
  readonly assignedUserName = input<string>('—');
  readonly corteFecha = input<string>(CORTE_FECHA);
  readonly points = input<readonly CurvaSWeeklyPoint[] | null>(null);

  readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svgEl');

  readonly svgW = 760;
  readonly svgH = 310;
  readonly padL = 50;
  readonly padR = 18;
  readonly padT = 16;
  readonly padB = 50;
  readonly innerW = this.svgW - this.padL - this.padR;
  readonly innerH = this.svgH - this.padT - this.padB;

  readonly seriesDefs = CURVA_S_SERIES;
  readonly presets: readonly { key: Exclude<CurvaSPreset, ''>; label: string }[] = [
    { key: 'anio', label: 'Todo 2026' },
    { key: 'tri', label: 'Último trimestre' },
    { key: 'mes', label: 'Último mes' },
    { key: '4s', label: 'Últimas 4 semanas' },
  ];

  readonly yTicks = [0, 20, 40, 60, 80, 100].map((pct) => ({
    pct,
    y: Number((this.padT + this.innerH - (pct / 105) * this.innerH).toFixed(1)),
  }));

  readonly granularity = signal<CurvaSGranularity>('m');
  readonly preset = signal<CurvaSPreset>('anio');
  readonly dateFrom = signal<string>('2026-01-01');
  readonly dateTo = signal<string>(CORTE_FECHA);
  readonly hiddenSeries = signal<Record<CurvaSSeriesKey, boolean>>({
    prog: false,
    fis: false,
    fin: false,
  });
  readonly hoverIndex = signal<number>(-1);
  private lastPointerType = 'mouse';
  private lastTappedIndex = -1;

  readonly displayPoints = computed<CurvaSDisplayPoint[]>(() => {
    const raw = this.points();
    if (!raw || raw.length === 0) return [];

    const d1 = this.dateFrom();
    const d2 = this.dateTo();
    const gran = this.granularity();
    const filtered = raw.filter((x) => x.f >= d1 && x.f <= d2);

    let grouped: (CurvaSWeeklyPoint & { lab: string; tt: string; m?: number })[] = [];
    if (gran === 's') {
      grouped = filtered.map((x) => ({
        ...x,
        lab: `${x.f.slice(8, 10)}/${x.f.slice(5, 7)}`,
        tt: `Semana al ${this.formatDate(x.f)}`,
      }));
    } else {
      const byMonth = new Map<number, CurvaSWeeklyPoint & { lab: string; tt: string; m: number }>();
      for (const x of filtered) {
        const m = Number(x.f.slice(5, 7));
        byMonth.set(m, {
          ...x,
          m,
          lab: MESES_CORTOS[m - 1] ?? '',
          tt: `${MESES_LARGOS[m - 1] ?? ''} 2026 · corte del ${this.formatDate(x.f)}`,
        });
      }
      grouped = Array.from(byMonth.values());
    }

    const n = grouped.length;
    const step = n > 1 ? this.innerW / (n - 1) : 0;
    const yFn = (val: number) =>
      Number((this.padT + this.innerH - (val / 105) * this.innerH).toFixed(1));

    return grouped.map((item, idx) => {
      const rawIdx = raw.findIndex((r) => r.f === item.f);
      const prevFis = rawIdx > 0 ? raw[rawIdx - 1].fis : 0;
      const xCoord = Number(
        (n > 1 ? this.padL + idx * step : this.padL + this.innerW / 2).toFixed(1),
      );
      return {
        ...item,
        xCoord,
        yProg: yFn(item.prog),
        yFis: yFn(item.fis),
        yFin: yFn(item.fin),
        weeklyDeltaFis: item.fis - prevFis,
        deviationFis: item.fis - item.prog,
      };
    });
  });

  readonly reversedWeeklyPoints = computed<CurvaSDisplayPoint[]>(() =>
    [...this.displayPoints()].reverse(),
  );

  readonly labelStep = computed<number>(() =>
    Math.max(1, Math.ceil(this.displayPoints().length / 12)),
  );

  readonly lastPoint = computed<CurvaSDisplayPoint | null>(() => {
    const pts = this.displayPoints();
    return pts.length > 0 ? pts[pts.length - 1] : null;
  });

  readonly cpiValue = computed<number>(() => {
    const last = this.lastPoint();
    if (!last) return 1;
    return last.fin ? last.fis / last.fin : 1;
  });

  readonly spiValue = computed<number>(() => {
    const last = this.lastPoint();
    if (!last) return 1;
    return last.prog ? last.fis / last.prog : 1;
  });

  readonly spiPct = computed<number>(() => Math.round(this.spiValue() * 100));

  readonly cpiStatus = computed<'ok' | 'mid' | 'bad'>(() => {
    const v = this.cpiValue();
    return v >= 1 ? 'ok' : v >= 0.9 ? 'mid' : 'bad';
  });

  readonly spiStatus = computed<'ok' | 'mid' | 'bad'>(() => {
    const v = this.spiValue();
    return v >= 1 ? 'ok' : v >= 0.9 ? 'mid' : 'bad';
  });

  readonly linePathProg = computed<string>(() =>
    this.buildLinePath(this.displayPoints(), 'yProg'),
  );

  readonly linePathFis = computed<string>(() =>
    this.buildLinePath(this.displayPoints(), 'yFis'),
  );

  readonly linePathFin = computed<string>(() =>
    this.buildLinePath(this.displayPoints(), 'yFin'),
  );

  readonly areaPathFis = computed<string>(() => {
    const pts = this.displayPoints();
    if (pts.length === 0) return '';
    const line = this.buildLinePath(pts, 'yFis');
    const yZero = (this.padT + this.innerH).toFixed(1);
    const firstX = pts[0].xCoord.toFixed(1);
    const lastX = pts[pts.length - 1].xCoord.toFixed(1);
    return `${line}L${lastX},${yZero}L${firstX},${yZero}Z`;
  });

  readonly hoveredPoint = computed<CurvaSDisplayPoint | null>(() => {
    const idx = this.hoverIndex();
    const pts = this.displayPoints();
    return idx >= 0 && idx < pts.length ? pts[idx] : null;
  });

  readonly tooltipLeftPct = computed<number>(() => {
    const pt = this.hoveredPoint();
    return pt ? (pt.xCoord / this.svgW) * 100 : 0;
  });

  readonly tooltipTopPct = computed<number>(() => {
    const pt = this.hoveredPoint();
    if (!pt) return 10;
    const minY = Math.min(pt.yProg, pt.yFis);
    return Math.max(8, (minY / this.svgH) * 100 - 6);
  });

  readonly periodSummary = computed(() => {
    const pts = this.displayPoints();
    const raw = this.points();
    if (!raw || pts.length === 0) return null;

    const first = pts[0];
    const last = pts[pts.length - 1];
    const prevList = raw.filter((x) => x.f < first.f);
    const prev = prevList.length > 0 ? prevList[prevList.length - 1] : { fis: 0, prog: 0, fin: 0 };
    const dv = last.fis - last.prog;

    return {
      fromLabel: this.formatDate(this.granularity() === 'm' ? this.dateFrom() : first.f),
      toLabel: this.formatDate(last.f),
      deltaFis: this.formatOneDec(last.fis - prev.fis),
      deltaProg: this.formatOneDec(last.prog - prev.prog),
      deltaFin: this.formatOneDec(last.fin - prev.fin),
      deviation: this.formatOneDec(dv),
      deviationNum: dv,
    };
  });

  private buildLinePath(
    pts: readonly CurvaSDisplayPoint[],
    yKey: 'yProg' | 'yFis' | 'yFin',
  ): string {
    return pts
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.xCoord.toFixed(1)},${pt[yKey].toFixed(1)}`)
      .join('');
  }

  setGranularity(g: CurvaSGranularity): void {
    this.granularity.set(g);
    this.hoverIndex.set(-1);
  }

  applyPreset(key: Exclude<CurvaSPreset, ''>): void {
    const corte = this.corteFecha();
    const map: Record<Exclude<CurvaSPreset, ''>, [string, CurvaSGranularity]> = {
      anio: ['2026-01-01', 'm'],
      tri: [this.addDays(corte, -91), 'm'],
      mes: [this.addDays(corte, -30), 's'],
      '4s': [this.addDays(corte, -27), 's'],
    };
    const [d1, g] = map[key];
    this.dateFrom.set(d1);
    this.dateTo.set(corte);
    this.granularity.set(g);
    this.preset.set(key);
    this.hoverIndex.set(-1);
  }

  onDateChange(field: 'd1' | 'd2', event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const val = inputEl.value || (field === 'd1' ? '2026-01-01' : this.corteFecha());
    this.preset.set('');
    if (field === 'd1') {
      this.dateFrom.set(val);
      if (val > this.dateTo()) {
        this.dateTo.set(val);
      }
    } else {
      this.dateTo.set(val);
      if (this.dateFrom() > val) {
        this.dateFrom.set(val);
      }
    }
    this.hoverIndex.set(-1);
  }

  toggleSeries(key: CurvaSSeriesKey): void {
    const next = { ...this.hiddenSeries(), [key]: !this.hiddenSeries()[key] };
    if (next.prog && next.fis && next.fin) {
      this.hiddenSeries.set({ prog: false, fis: false, fin: false });
    } else {
      this.hiddenSeries.set(next);
    }
  }

  drillIntoMonth(month: number): void {
    const mm = String(month).padStart(2, '0');
    const nextMonthStart =
      month === 12
        ? '2027-01-01'
        : `2026-${String(month + 1).padStart(2, '0')}-01`;
    const end = this.addDays(nextMonthStart, -1);
    const corte = this.corteFecha();
    this.granularity.set('s');
    this.dateFrom.set(`2026-${mm}-01`);
    this.dateTo.set(end > corte ? corte : end);
    this.preset.set('');
    this.hoverIndex.set(-1);
  }

  onPointerMove(event: PointerEvent): void {
    this.lastPointerType = event.pointerType;
    this.updateHoveredIndexFromEvent(event);
  }

  onPointerDown(event: PointerEvent): void {
    this.lastPointerType = event.pointerType;
    this.updateHoveredIndexFromEvent(event);
    this.lastTappedIndex = this.hoverIndex();
  }

  onPointerLeave(): void {
    this.hoverIndex.set(-1);
  }

  onChartClick(): void {
    if (this.granularity() !== 'm') return;
    const idx = this.hoverIndex();
    if (idx < 0) return;
    if (this.lastPointerType === 'touch' && this.lastTappedIndex !== idx) return;
    const pt = this.displayPoints()[idx];
    if (pt?.m) {
      this.drillIntoMonth(pt.m);
    }
  }

  private updateHoveredIndexFromEvent(event: PointerEvent): void {
    const svg = this.svgRef()?.nativeElement;
    const pts = this.displayPoints();
    if (!svg || pts.length === 0) return;

    const rect = svg.getBoundingClientRect();
    const sx = ((event.clientX - rect.left) / rect.width) * this.svgW;
    const step = pts.length > 1 ? this.innerW / (pts.length - 1) : 0;
    let idx = pts.length > 1 ? Math.round((sx - this.padL) / step) : 0;
    idx = Math.max(0, Math.min(pts.length - 1, idx));
    this.hoverIndex.set(idx);
  }

  formatOneDec(val: number): string {
    return (Math.round(val * 10) / 10).toFixed(1);
  }

  formatComma(val: number, decimals: number): string {
    return Number(val).toFixed(decimals).replace('.', ',');
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  getMonthLongName(month: number): string {
    return MESES_LARGOS[month - 1] ?? '';
  }

  private addDays(isoDate: string, days: number): string {
    const dt = new Date(`${isoDate}T12:00:00`);
    dt.setDate(dt.getDate() + days);
    return dt.toISOString().slice(0, 10);
  }
}
