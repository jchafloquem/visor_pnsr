import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

@Component({
  selector: 'app-count-up',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './count-up.component.html',
  styleUrl: './count-up.component.css',
})
export class CountUpComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly value = input.required<number>();
  readonly decimals = input<number>(0);
  readonly suffix = input<string>('');
  readonly duration = input<number>(750);

  private readonly current = signal<number>(0);
  private rafId: number | null = null;
  private lastTarget = 0;

  readonly formatted = computed<string>(() => {
    const num = this.current();
    const dec = this.decimals();
    return `${num.toFixed(dec)}${this.suffix()}`;
  });

  constructor() {
    effect(() => {
      const target = Number(this.value()) || 0;
      const dur = this.duration();
      const startVal = untracked(() => this.lastTarget);
      this.animateTo(startVal, target, dur);
      this.lastTarget = target;
    });

    this.destroyRef.onDestroy(() => {
      this.cancelAnimation();
    });
  }

  private cancelAnimation(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private animateTo(from: number, to: number, durationMs: number): void {
    this.cancelAnimation();

    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (
      typeof window === 'undefined' ||
      typeof requestAnimationFrame !== 'function' ||
      reducedMotion ||
      durationMs <= 0 ||
      from === to
    ) {
      this.current.set(to);
      return;
    }

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Ease-out cubic: starts briskly and settles smoothly on the final number
      const eased = 1 - Math.pow(1 - progress, 3);
      this.current.set(from + (to - from) * eased);

      if (progress < 1) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.current.set(to);
        this.rafId = null;
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }
}
