import {
  ImpactoLabel,
  NivelRiesgo,
  NivelRiesgoBase,
  ParametrosSsp,
  ProbabilidadLabel,
  ProyectoSsp,
  RiesgoSsp,
  SugerenciaRiesgoSsp,
} from '../../cartera/models/ssp.models';

export const PROBABILIDAD_LABELS: readonly ProbabilidadLabel[] = [
  'Muy Alta',
  'Alta',
  'Moderada',
  'Baja',
  'Muy Baja',
];

export const IMPACTO_LABELS: readonly ImpactoLabel[] = [
  'Muy Bajo',
  'Bajo',
  'Moderado',
  'Alto',
  'Muy Alto',
];

export function scoreRisk(
  r: Pick<RiesgoSsp, 'p' | 'i'>,
  params: ParametrosSsp
): number {
  return +(params.P[r.p] * params.I[r.i]).toFixed(3);
}

export function nivelFromScore(score: number, params: ParametrosSsp): NivelRiesgoBase {
  if (score >= params.cAlta - 1e-9) return 'ALTA';
  if (score > params.cBaja + 1e-9) return 'MODERADA';
  return 'BAJA';
}

export function isCritRisk(
  r: Pick<RiesgoSsp, 'p' | 'i' | 'mitigable'>,
  params: ParametrosSsp
): boolean {
  return nivelFromScore(scoreRisk(r, params), params) === 'ALTA' && r.mitigable === false;
}

export function lvlOfRisk(
  r: Pick<RiesgoSsp, 'p' | 'i' | 'mitigable'>,
  params: ParametrosSsp
): NivelRiesgo {
  return isCritRisk(r, params) ? 'CRÍTICO' : nivelFromScore(scoreRisk(r, params), params);
}

export function isActiveRisk(r: Pick<RiesgoSsp, 'estado'>): boolean {
  return !['Cerrado', 'Propuesto', 'Rechazado'].includes(r.estado);
}

export function projectRiskLevel(
  cui: string,
  allRisks: readonly RiesgoSsp[],
  params: ParametrosSsp
): NivelRiesgo | null {
  const active = allRisks.filter((r) => r.cui === cui && isActiveRisk(r));
  if (!active.length) return null;
  if (active.some((r) => isCritRisk(r, params))) return 'CRÍTICO';
  const maxScore = Math.max(...active.map((r) => scoreRisk(r, params)));
  return nivelFromScore(maxScore, params);
}

export const ZONA_BY_CUI: Record<string, 'Sierra' | 'Selva'> = {
  '9100101': 'Sierra',
  '9100102': 'Sierra',
  '9100103': 'Sierra',
  '9100104': 'Selva',
  '9100105': 'Selva',
  '9100106': 'Sierra',
  '9100107': 'Selva',
  '9100108': 'Selva',
  '9100109': 'Sierra',
  '9100110': 'Sierra',
  '9100111': 'Selva',
  '9100112': 'Selva',
  '9100113': 'Selva',
};

export function getProjectZona(p: Pick<ProyectoSsp, 'cui' | 'zona'>): 'Sierra' | 'Selva' {
  return ZONA_BY_CUI[p.cui] || p.zona || 'Sierra';
}

export function sugForProject(
  p: Pick<ProyectoSsp, 'cui' | 'etapa' | 'zona'>,
  projectRisks: readonly RiesgoSsp[],
  catalog: readonly SugerenciaRiesgoSsp[]
): Array<SugerenciaRiesgoSsp & { k: number }> {
  const z = getProjectZona(p);
  const existingCats = projectRisks
    .filter((r) => r.estado !== 'Rechazado')
    .map((r) => r.cats.join(' '));
  return catalog
    .map((x, k) => ({ ...x, k }))
    .filter(
      (x) =>
        x.e.includes(p.etapa) &&
        (!x.z.length || x.z.includes(z)) &&
        !existingCats.some((c) => x.cats.every((cat) => c.includes(cat)))
    );
}
