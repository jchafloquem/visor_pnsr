import { describe, expect, it } from 'vitest';
import { CORTE_FECHA } from '../../../core/config/institutional.constants';
import { SEED_PARAMS_DEF } from '../../../data/seed-params.data';
import { buildSeedPortfolio } from '../../../data/seed-projects.data';
import { SEED_RISKS } from '../../../data/seed-risks.data';
import { computeAlertas } from './alert.rules';

describe('alert.rules', () => {
  it('generates sorted alerts including critical expired milestones, high risks without plan, and critical unmitigable risks', () => {
    const portfolio = buildSeedPortfolio();
    const first13 = portfolio.projects.slice(0, 13);
    const alerts = computeAlertas(
      first13,
      SEED_RISKS,
      SEED_PARAMS_DEF,
      portfolio.rev0,
      CORTE_FECHA
    );

    expect(alerts.length).toBeGreaterThan(0);

    // Verify sorting: Crítica -> Alta -> Media
    const order = { Crítica: 0, Alta: 1, Media: 2 } as const;
    for (let i = 1; i < alerts.length; i++) {
      expect(order[alerts[i].sev]).toBeGreaterThanOrEqual(order[alerts[i - 1].sev]);
    }

    // R-26-0002 is Alta without action plan (A05)
    expect(alerts.some((a) => a.k === 'A05' && a.rk?.id === 'R-26-0002')).toBe(true);

    // R-26-0004 is Crítico unmitigable (A15)
    expect(alerts.some((a) => a.k === 'A15' && a.rk?.id === 'R-26-0004')).toBe(true);

    // 9100101 has expired milestone h1 (2026-11-05 < 2026-11-17) => A01
    expect(alerts.some((a) => a.k === 'A01' && a.p.cui === '9100101')).toBe(true);
  });
});
