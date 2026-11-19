import { CORTE_FECHA } from '../../../core/config/institutional.constants';
import {
  AlertaSsp,
  ParametrosSsp,
  ProyectoSsp,
  RiesgoSsp,
  SeveridadAlerta,
} from '../../cartera/models/ssp.models';
import {
  computeProyeccion,
  diffDays,
  formatDateShort,
} from '../../cartera/domain/project-projection.rules';
import {
  isActiveRisk,
  isCritRisk,
  nivelFromScore,
  scoreRisk,
} from '../../riesgos/domain/risk.rules';

export function getAnticipacion(
  p: Pick<ProyectoSsp, 'cui' | 'uo'>,
  kind: 'hito' | 'accion',
  params: ParametrosSsp
): number {
  const exc = params.exc[p.cui];
  if (exc && exc[kind] != null) return exc[kind];
  const diasUo = params.dias[p.uo];
  if (diasUo && diasUo[kind] != null) return diasUo[kind];
  return 15;
}

const SEVERITY_ORDER: Record<SeveridadAlerta, number> = {
  Crítica: 0,
  Alta: 1,
  Media: 2,
};

export function computeAlertas(
  projects: readonly ProyectoSsp[],
  allRisks: readonly RiesgoSsp[],
  params: ParametrosSsp,
  revisiones: Record<string, string>,
  corte: string = CORTE_FECHA
): AlertaSsp[] {
  const out: AlertaSsp[] = [];

  for (const p of projects) {
    const pRisks = allRisks.filter((r) => r.cui === p.cui);
    const activeRisks = pRisks.filter((r) => isActiveRisk(r));

    for (const h of p.hitos) {
      if (h.est === 'Cumplido' || h.real) continue;
      const d = diffDays(h.f, corte);
      const rk = activeRisks.find((r) => r.hito === h.id) || null;
      if (d < 0) {
        out.push({
          sev: 'Crítica',
          k: 'A01',
          rn: 'Hito vencido',
          p,
          txt: h.h,
          f: h.f,
          sit: `Vencido hace ${Math.abs(d)} ${Math.abs(d) === 1 ? 'día' : 'días'}`,
          rk,
          hid: h.id,
        });
      } else if (d <= getAnticipacion(p, 'hito', params)) {
        out.push({
          sev: d <= 5 ? 'Alta' : 'Media',
          k: 'A02',
          rn: 'Hito por vencer',
          p,
          txt: h.h,
          f: h.f,
          sit: d === 0 ? 'Vence hoy' : `Vence en ${d} ${d === 1 ? 'día' : 'días'}`,
          rk,
          hid: h.id,
        });
      }
    }

    if ((p.culm === 'No' || p.culm === 'Duda') && !p.fin2027 && !activeRisks.length) {
      out.push({
        sev: 'Crítica',
        k: 'A04',
        rn: 'Podría no culminar y no tiene riesgos',
        p,
        txt: `¿Culmina en 2026? ${p.culm}`,
        f: '',
        sit: 'Sin riesgo registrado',
        rk: null,
      });
    }

    for (const r of activeRisks) {
      if (nivelFromScore(scoreRisk(r, params), params) === 'ALTA' && !r.acc.length) {
        out.push({
          sev: 'Crítica',
          k: 'A05',
          rn: 'Riesgo alto sin plan de acción',
          p,
          txt: `${r.id} · ${r.evento}`,
          f: r.flim,
          sit: 'Sin acciones',
          rk: r,
        });
      }
      if (isCritRisk(r, params)) {
        out.push({
          sev: 'Crítica',
          k: 'A15',
          rn: 'Riesgo crítico (no mitigable)',
          p,
          txt: `${r.id} · ${r.evento}`,
          f: '',
          sit: 'Requiere decisión',
          rk: r,
        });
      }
      for (const a of r.acc) {
        if (a.est === 'Atendida' || !a.f) continue;
        const d = diffDays(a.f, corte);
        if (d < 0) {
          out.push({
            sev: 'Alta',
            k: 'A06',
            rn: 'Acción vencida',
            p,
            txt: a.t,
            f: a.f,
            sit: `Vencida hace ${Math.abs(d)} ${Math.abs(d) === 1 ? 'día' : 'días'}`,
            rk: r,
          });
        } else if (d <= getAnticipacion(p, 'accion', params)) {
          out.push({
            sev: 'Media',
            k: 'A07',
            rn: 'Acción por vencer',
            p,
            txt: a.t,
            f: a.f,
            sit: d === 0 ? 'Vence hoy' : `Vence en ${d} ${d === 1 ? 'día' : 'días'}`,
            rk: r,
          });
        }
      }
    }

    const o = computeProyeccion(p, corte);
    if (p.culm === 'Sí' && o.fisFin != null && !o.llega) {
      out.push({
        sev: 'Alta',
        k: 'A09',
        rn: 'La proyección no llega a la meta',
        p,
        txt: `Respondió «Sí» culmina en 2026, pero al ritmo actual cierra el año en ${o.fisFin.toFixed(0)} %`,
        f: '',
        sit: `Terminaría el ${formatDateShort(o.fecha)}`,
        rk: null,
        hid: '',
      });
    }

    for (const r of pRisks) {
      if (r.estado === 'Propuesto' && diffDays(corte, r.creado) > 3) {
        out.push({
          sev: 'Alta',
          k: 'A16',
          rn: 'Notificación de la UPP sin respuesta',
          p,
          txt: `${r.id} · ${r.evento}`,
          f: '',
          sit: `Hace ${diffDays(corte, r.creado)} días`,
          rk: r,
        });
      }
      if (
        isActiveRisk(r) &&
        r.val === 'Por validar' &&
        diffDays(corte, r.actF || r.creado) > 3
      ) {
        out.push({
          sev: 'Media',
          k: 'A17',
          rn: 'Riesgo por validar',
          p,
          txt: `${r.id} · ${r.evento}`,
          f: '',
          sit: `Desde el ${formatDateShort(r.actF || r.creado)}`,
          rk: r,
        });
      }
    }

    const revDate = revisiones[p.cui];
    if (!revDate || diffDays(corte, revDate) > 7) {
      out.push({
        sev: 'Media',
        k: 'A08',
        rn: 'Sin revisión semanal de riesgos',
        p,
        txt: `Última revisión: ${formatDateShort(revDate)}`,
        f: '',
        sit: 'Revisión pendiente',
        rk: null,
      });
    }
  }

  return out.sort((a, b) => SEVERITY_ORDER[a.sev] - SEVERITY_ORDER[b.sev]);
}
