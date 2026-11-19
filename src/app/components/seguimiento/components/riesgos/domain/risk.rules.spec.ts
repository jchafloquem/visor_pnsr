import { describe, expect, it } from 'vitest';
import { SEED_PARAMS_DEF } from '../../../data/seed-params.data';
import { SEED_RISKS, SEED_SUGGESTIONS } from '../../../data/seed-risks.data';
import {
  isActiveRisk,
  isCritRisk,
  lvlOfRisk,
  nivelFromScore,
  projectRiskLevel,
  scoreRisk,
  sugForProject,
} from './risk.rules';

describe('risk.rules', () => {
  it('computes OECE risk score and level accurately', () => {
    const score = scoreRisk({ p: 'Muy Alta', i: 'Alto' }, SEED_PARAMS_DEF);
    expect(score).toBe(0.36);
    expect(nivelFromScore(score, SEED_PARAMS_DEF)).toBe('ALTA');

    const lowScore = scoreRisk({ p: 'Baja', i: 'Bajo' }, SEED_PARAMS_DEF);
    expect(lowScore).toBe(0.03);
    expect(nivelFromScore(lowScore, SEED_PARAMS_DEF)).toBe('BAJA');

    const modScore = scoreRisk({ p: 'Moderada', i: 'Moderado' }, SEED_PARAMS_DEF);
    expect(modScore).toBe(0.1);
    expect(nivelFromScore(modScore, SEED_PARAMS_DEF)).toBe('MODERADA');
  });

  it('identifies CRÍTICO when ALTA and not mitigable', () => {
    const critRisk = { p: 'Alta' as const, i: 'Muy Alto' as const, mitigable: false };
    expect(isCritRisk(critRisk, SEED_PARAMS_DEF)).toBe(true);
    expect(lvlOfRisk(critRisk, SEED_PARAMS_DEF)).toBe('CRÍTICO');

    const mitigableHigh = { p: 'Alta' as const, i: 'Muy Alto' as const, mitigable: true };
    expect(isCritRisk(mitigableHigh, SEED_PARAMS_DEF)).toBe(false);
    expect(lvlOfRisk(mitigableHigh, SEED_PARAMS_DEF)).toBe('ALTA');
  });

  it('determines active status and highest project risk level', () => {
    expect(isActiveRisk({ estado: 'En tratamiento' })).toBe(true);
    expect(isActiveRisk({ estado: 'Propuesto' })).toBe(false);
    expect(isActiveRisk({ estado: 'Cerrado' })).toBe(false);
    expect(isActiveRisk({ estado: 'Rechazado' })).toBe(false);

    // 9100106 has R-26-0004 which is Alta + Muy Alto + mitigable: false => CRÍTICO
    expect(projectRiskLevel('9100106', SEED_RISKS, SEED_PARAMS_DEF)).toBe('CRÍTICO');
    // 9100103 has R-26-0001 / R-26-0002 => ALTA
    expect(projectRiskLevel('9100103', SEED_RISKS, SEED_PARAMS_DEF)).toBe('ALTA');
    // Non-existent project => null
    expect(projectRiskLevel('9999999', SEED_RISKS, SEED_PARAMS_DEF)).toBeNull();
  });

  it('filters frequent suggestions by stage and zone excluding already-registered categories', () => {
    const sugs = sugForProject(
      { cui: '9100101', etapa: 'Ejecución de obra', zona: 'Sierra' },
      SEED_RISKS.filter((r) => r.cui === '9100101'),
      SEED_SUGGESTIONS
    );
    expect(sugs.length).toBeGreaterThan(0);
    expect(sugs.every((s) => s.e.includes('Ejecución de obra'))).toBe(true);
    expect(sugs.every((s) => !s.z.length || s.z.includes('Sierra'))).toBe(true);
  });
});
