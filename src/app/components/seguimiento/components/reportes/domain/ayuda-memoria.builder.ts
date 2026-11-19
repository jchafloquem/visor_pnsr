import { CORTE_FECHA } from '../../../core/config/institutional.constants';
import { SEED_USERS } from '../../../data/seed-users.data';
import { computeAlertas } from '../../alertas/domain/alert.rules';
import {
  computeProyeccion,
  diffDays,
  formatDateShort,
} from '../../cartera/domain/project-projection.rules';
import {
  AccionRiesgoSsp,
  CompromisoSsp,
  NivelRiesgo,
  ParametrosSsp,
  ProyectoSsp,
  RiesgoSsp,
  SeguimientoSemanal,
  UnidadOperativa,
} from '../../cartera/models/ssp.models';
import {
  IMPACTO_LABELS,
  isActiveRisk,
  isCritRisk,
  lvlOfRisk,
  nivelFromScore,
  PROBABILIDAD_LABELS,
  projectRiskLevel,
  scoreRisk,
} from '../../riesgos/domain/risk.rules';

export interface AmRunOption {
  b?: number | boolean;
  i?: number | boolean;
  c?: string;
  sz?: number;
}

export type AmRun = [string, AmRunOption];
export type AmParagraph = AmRun[];

export interface AmCell {
  ps: AmParagraph[];
  fill?: string;
  c?: string;
  b?: number | boolean;
  i?: number | boolean;
  jc?: 'left' | 'center' | 'right' | 'both';
  span?: number;
  sz?: number;
}

export interface AmTitleBlock {
  k: 'title';
  t: string;
  cui: string;
  lab: string;
  fecha: string;
  nombre: string;
}

export interface AmNoteBlock {
  k: 'note' | 'foot';
  t: string;
}

export interface AmTableBlock {
  k: 'tbl';
  w: number[];
  rows: AmCell[][];
  just?: number | boolean;
}

export type AmBlock = AmTitleBlock | AmNoteBlock | AmTableBlock;

export interface AmDocument {
  file: string;
  blocks: AmBlock[];
}

export interface ExcelReportSpec {
  sheet: string;
  title: string;
  file: string;
  money?: number[];
  widths?: number[];
  head: string[];
  rows: Array<Array<string | number | null>>;
}

function sp(t: string | number | null | undefined, o: AmRunOption = {}): AmParagraph {
  return [[String(t == null ? '' : t), o]];
}

function PS(t: string | number | null | undefined, o: AmRunOption = {}): AmParagraph[] {
  return String(t == null ? '' : t)
    .split('\n')
    .map((l) => [[l, o]]);
}

function C(x: string | number | AmParagraph[], o: Partial<Omit<AmCell, 'ps'>> = {}): AmCell {
  return {
    ps: Array.isArray(x) ? x : PS(x),
    ...o,
  };
}

function L(t: string): AmCell {
  return C(t, { fill: 'DAE6F2', c: '16365C', b: 1 });
}

function HD(t: string, span: number = 1): AmCell {
  return C(t, { fill: '16365C', c: 'FFFFFF', b: 1, span });
}

function SUB(t: string, span: number = 1): AmCell {
  return C(t, { fill: 'F2F2F2', c: '16365C', b: 1, span });
}

function CH(t: string): AmCell {
  return C(t, { fill: 'DAE6F2', c: '16365C', b: 1, jc: 'center' });
}

const NIVM: Record<NivelRiesgo, string> = {
  CRÍTICO: 'Crítico',
  ALTA: 'Alto',
  MODERADA: 'Moderado',
  BAJA: 'Bajo',
};

const NIVF: Record<NivelRiesgo, [string, string]> = {
  CRÍTICO: ['C00000', 'FFFFFF'],
  ALTA: ['ED7D31', 'FFFFFF'],
  MODERADA: ['FFC000', '000000'],
  BAJA: ['70AD47', 'FFFFFF'],
};

const NIVT: Record<NivelRiesgo, string> = {
  CRÍTICO: 'C00000',
  ALTA: 'C55A11',
  MODERADA: '9C6500',
  BAJA: '3B6E22',
};

function NC(lv: NivelRiesgo, t: string, o: Partial<Omit<AmCell, 'ps'>> = {}): AmCell {
  return C(t, {
    fill: NIVF[lv][0],
    c: NIVF[lv][1],
    b: 1,
    jc: 'center',
    ...o,
  });
}

function dc(n: number, d: number): string {
  return Number(n).toFixed(d).replace('.', ',');
}

function n2(n: number): string {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function S2(n: number): string {
  return 'S/ ' + n2(n);
}

function p1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function slug(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const MODL: Record<string, string> = {
  Contrata: 'Administración Indirecta - por Contrata',
  'Núcleo ejecutor': 'Administración Indirecta - por Núcleo Ejecutor',
};

const VALID_BY_UO: Record<UnidadOperativa, string> = {
  UTP: 'Luis Quispe (Coordinador UTP)',
  PIASAR: 'Jorge Salas (Coordinador PIASAR)',
  'AMAZONÍA RURAL': 'Rosa Vílchez (Coordinadora Amazonía Rural)',
};

const W2 = [2955, 7320];

function areaLab(a: string): string {
  if (a === 'AMAZONÍA RURAL') return 'Amazonía Rural';
  if (a === 'DE') return 'Dirección Ejecutiva';
  return a;
}

function uById(id: string): { nombre: string; cargo: string; area: string; sub: string } {
  return (
    SEED_USERS.find((u) => u.id === id) || {
      nombre: '—',
      cargo: '',
      area: '',
      sub: '',
    }
  );
}

export function buildAmEjecutiva(
  p: ProyectoSsp,
  allRisks: readonly RiesgoSsp[],
  allCommitments: readonly CompromisoSsp[],
  seguimientos: Record<string, SeguimientoSemanal>,
  params: ParametrosSsp,
  corte: string = CORTE_FECHA
): AmDocument {
  const c = p.contrato;
  const devAc = p.dev + p.prev;
  const saldo = p.inv - devAc;
  const seg = seguimientos[p.cui];
  const obra = p.fis != null;
  const rs = allRisks
    .filter((r) => r.cui === p.cui && isActiveRisk(r))
    .slice()
    .sort((a, b) => scoreRisk(b, params) - scoreRisk(a, params));

  const ant: string[] = [];
  if (p.priX) {
    ant.push(
      `- Proyecto priorizado como ${p.priX.tipo.toLowerCase()} 2026 desde el ${formatDateShort(p.priX.desde)} (meta: ${p.priX.meta.toLowerCase()} al ${formatDateShort(p.priX.fm)}). Sustento: ${p.priX.sust}.`
    );
  }
  allCommitments
    .filter((x) => x.cui === p.cui)
    .slice()
    .sort((a, b) => (a.fr < b.fr ? -1 : 1))
    .forEach((x) => {
      ant.push(
        `- El ${formatDateShort(x.fr)} la Dirección Ejecutiva acordó: ${x.dec} (responsable: ${x.resp}; plazo: ${formatDateShort(x.f)}; estado: ${x.est.toLowerCase()}).`
      );
    });
  if (c.adic) {
    ant.push(`- La obra tiene ${c.adic} adicional(es) de obra en trámite o aprobado(s).`);
  }
  if (!ant.length) {
    ant.push('- Sin antecedentes registrados en el sistema.');
  }

  const ejec = p.estado === 'En ejecución';
  const prob: string[] = [
    obra
      ? `La obra está en ejecución: ${ejec ? 'SÍ' : 'NO'} (${p.estado.toLowerCase()}).`
      : `Etapa actual: ${p.etapa.toLowerCase()} (${p.estado.toLowerCase()}).`,
    `Asignación presupuestal 2026: SÍ (ejecución financiera del ${p1((p.dev / p.pim) * 100)} % del PIM 2026).`,
    `Cuenta con presupuesto para culminar: ${p.deficit ? 'NO' : 'SÍ'}.`,
  ];
  if (p.deficit) {
    prob.push(
      `Se reporta un déficit presupuestal para culminar la obra por ${S2(p.deficit)}.`
    );
  }
  if (rs.length) {
    const topLv = lvlOfRisk(rs[0], params);
    prob.push(
      `Riesgo principal (${rs[0].id}, ${NIVM[topLv].toLowerCase()}): debido a ${rs[0].causa}, podría ocurrir ${rs[0].evento}.`
    );
  }

  const est: AmParagraph[] = [
    [
      ['Estado SSI: ', {}],
      ['Activo', { b: 1 }],
    ],
    [
      ['Estado SSP: ', {}],
      [p.estado, { b: 1 }],
    ],
    sp(
      `El proyecto se encuentra ${p.estado.toLowerCase()}${obra ? `, con un avance físico acumulado de ${p.fis} % (SSP) frente a ${p.prog} % programado` : ''}${p.finObra ? `, con fecha estimada de culminación el ${formatDateShort(p.finObra)}` : ''}, según el corte del ${formatDateShort(corte)}.`
    ),
  ];
  if (seg && seg.det) {
    est.push([
      [`Registro semanal (${uById(seg.u).nombre}, ${formatDateShort(seg.f)}): `, { b: 1 }],
      [seg.det, {}],
    ]);
  }

  const pend = p.hitos
    .filter((h) => h.est !== 'Cumplido' && !h.real)
    .slice()
    .sort((a, b) => (a.f < b.f ? -1 : 1));
  const pasos = pend.map(
    (h, k) =>
      `Hito ${k + 1}: ${h.h} (${diffDays(h.f, corte) < 0 ? 'vencido el ' : 'programado al '}${formatDateShort(h.f)}).`
  );
  rs.filter((r) => {
    const lv = lvlOfRisk(r, params);
    return lv === 'CRÍTICO' || lv === 'ALTA';
  }).forEach((r) => {
    const a = r.acc.find((x) => x.est !== 'Atendida');
    if (a) {
      pasos.push(`Acción (${r.id}): ${a.t} – ${a.r}, al ${formatDateShort(a.f)}.`);
    }
  });
  if (!pasos.length) {
    pasos.push('Sin hitos pendientes registrados.');
  }

  const rows: AmCell[][] = [
    [HD('DATOS GENERALES', 2)],
    [L('Programa'), C('Programa Nacional de Saneamiento Rural (PNSR)')],
    [
      L('Ubicación'),
      C(
        `Localidad de ${p.corto}, distrito de ${p.dist}, provincia de ${p.prov}, departamento de ${p.dep}.`
      ),
    ],
    [
      L('Responsable del Proyecto'),
      C(
        `Unidad Ejecutora de Inversiones: PNSR – ${areaLab(p.uo)}\nUnidad Formuladora: PNSR\nMonitoreado por: PNSR`
      ),
    ],
    [L('Modalidad de Ejecución'), C(MODL[p.mod] || p.mod)],
    [L('Población beneficiaria'), C(`${p.benef.toLocaleString('en-US')} habitantes.`)],
    [
      L('Conexiones nuevas'),
      C(
        `${p.conex} conexiones nuevas de agua potable y ${p.conex} conexiones nuevas de saneamiento (UBS).`
      ),
    ],
    [L('Monto de inversión actualizado'), C([sp(S2(p.inv), { b: 1 })])],
    [L('Presupuesto vigente (PIM)'), C(`PIM 2026: ${S2(p.pim)}`)],
    [
      L('Devengado acumulado y del año'),
      C(
        `Devengado acumulado: ${S2(devAc)} (${p1((devAc / p.inv) * 100)} % del monto de inversión).\nDevengado 2026: ${S2(p.dev)} (${p1((p.dev / p.pim) * 100)} % del PIM 2026).\nSaldo de inversión: ${S2(saldo)}.`
      ),
    ],
    [
      L('Avance físico'),
      C([
        sp(
          obra
            ? `${p.fis} % (SSP)`
            : `No aplica en ${p.etapa.toLowerCase()}: se sigue por entregables`,
          { b: 1 }
        ),
      ]),
    ],
    [
      L('Avance financiero'),
      C([sp(`${p1((devAc / p.inv) * 100)} % (respecto al monto de inversión)`, { b: 1 })]),
    ],
    [
      L('Avance programado'),
      C(
        obra && p.prog != null && p.fis != null
          ? `Programado ${p.prog} % (SSP) · Brecha del avance programado frente al físico: ${p1(p.prog - p.fis)} puntos.`
          : '—'
      ),
    ],
    [
      L('Cronograma de ejecución'),
      C(
        `Fecha de término estimada: ${p.finObra ? formatDateShort(p.finObra) : '[por registrar]'}${p.deficit ? ' (sujeta a la transferencia de recursos).' : '.'}`
      ),
    ],
    [HD('ANTECEDENTES Y SITUACIÓN ACTUAL', 2)],
    [L('Antecedentes relevantes'), C(ant.join('\n'))],
    [L('Problemática / restricción'), C(prob.join('\n'))],
    [L('Estado situacional'), C(est)],
    [L('Próximos pasos / acciones'), C(pasos.join('\n'))],
  ];

  return {
    file: `AM_EJECUTIVA_${p.cui}_${slug(p.corto).toUpperCase()}.docx`,
    blocks: [
      {
        k: 'title',
        t: 'AYUDA MEMORIA EJECUTIVA',
        cui: p.cui,
        lab: 'Actualización al',
        fecha: formatDateShort(corte),
        nombre: `${p.nombre}, distrito de ${p.dist}, provincia de ${p.prov} - ${p.dep}`,
      },
      { k: 'tbl', w: W2, rows, just: 1 },
      {
        k: 'foot',
        t: `Generado por el SSCPI – módulo de seguimiento · Corte: ${formatDateShort(corte)} · Registro semanal: ${seg ? `${uById(seg.u).nombre} (${formatDateShort(seg.f)})` : 'sin registro esta semana'} · Datos de ejemplo del prototipo.`,
      },
    ],
  };
}

export function buildAmRiesgos(
  p: ProyectoSsp,
  allRisks: readonly RiesgoSsp[],
  revisiones: Record<string, string>,
  params: ParametrosSsp,
  corte: string = CORTE_FECHA
): AmDocument {
  const all = allRisks.filter((r) => r.cui === p.cui);
  const ab = all
    .filter((r) => isActiveRisk(r))
    .slice()
    .sort((a, b) => scoreRisk(b, params) - scoreRisk(a, params));
  const lv = projectRiskLevel(p.cui, allRisks, params);
  const o = computeProyeccion(p, corte);
  const prev = (() => {
    const d = new Date(corte + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();

  const venc: Array<[RiesgoSsp, AccionRiesgoSsp]> = [];
  ab.forEach((r) =>
    r.acc.forEach((a) => {
      if (a.est !== 'Atendida' && diffDays(a.f, corte) < 0) {
        venc.push([r, a]);
      }
    })
  );

  const mat = ab.filter((r) => r.estado === 'Materializado');
  const cnt = (k: NivelRiesgo): number => ab.filter((r) => lvlOfRisk(r, params) === k).length;
  const kri: string[] = [];
  if (p.fis != null && p.prog != null && p.prog - p.fis > 5) {
    kri.push(
      `desviación del avance físico de ${dc(p.prog - p.fis, 1)} puntos (programado ${dc(p.prog, 1)} % frente a real ${dc(p.fis, 1)} %)`
    );
  }
  if (o.devPct < 80) {
    kri.push(`devengado proyectado al 31/12 de ${dc(o.devPct, 0)} % del PIM (meta 90 %)`);
  }

  const regs = [...new Set(all.map((r) => r.por))].map((id) => {
    const u = uById(id);
    return `${u.nombre} – ${u.cargo} (${areaLab(u.area)})`;
  });

  const B: AmBlock[] = [
    {
      k: 'title',
      t: 'AYUDA MEMORIA DE RIESGOS',
      cui: p.cui,
      lab: 'Corte al',
      fecha: formatDateShort(corte),
      nombre: `${p.nombre}, distrito de ${p.dist}, provincia de ${p.prov} - ${p.dep}`,
    },
  ];

  B.push({
    k: 'tbl',
    w: W2,
    rows: [
      [HD('DATOS GENERALES', 2)],
      [L('Unidad Ejecutora'), C(`PNSR – ${areaLab(p.uo)}`)],
      [L('Modalidad de ejecución'), C(MODL[p.mod] || p.mod)],
      [L('Etapa actual'), C(`${p.etapa} (${p.estado.toLowerCase()})`)],
      [L('Tipo de riesgo'), C('Propio (la inversión la ejecuta el PNSR)')],
      [
        L('Fecha de término vigente'),
        C(
          p.finObra
            ? `${formatDateShort(p.finObra)}${p.deficit ? ' (estimada, sujeta a la transferencia de recursos)' : ' (estimada)'}`
            : '[por registrar]'
        ),
      ],
      [L('Registrador'), C(regs.join('\n') || '[Sin riesgos registrados]')],
    ],
  });

  const W5 = [2055, 2055, 2055, 2055, 2055];
  B.push({
    k: 'tbl',
    w: W5,
    rows: [
      [HD('RESUMEN DE RIESGOS', 5)],
      ['Nivel del CUI', 'Riesgos abiertos', 'Materializados', 'Acciones vencidas', 'KRI en alerta'].map(
        CH
      ),
      [
        lv ? NC(lv, NIVM[lv].toUpperCase()) : C('SIN RIESGOS', { b: 1, jc: 'center' }),
        C(String(ab.length), { b: 1, jc: 'center', sz: 22 }),
        C(String(mat.length), { b: 1, jc: 'center', sz: 22, c: mat.length ? 'C00000' : '' }),
        C(String(venc.length), { b: 1, jc: 'center', sz: 22, c: venc.length ? 'C00000' : '' }),
        C(String(kri.length), { b: 1, jc: 'center', sz: 22 }),
      ],
      [
        NC('CRÍTICO', `Crítico: ${cnt('CRÍTICO')}`),
        NC('ALTA', `Alto: ${cnt('ALTA')}`),
        NC('MODERADA', `Moderado: ${cnt('MODERADA')}`),
        NC('BAJA', `Bajo: ${cnt('BAJA')}`),
        C(`Total abiertos: ${ab.length}`, { b: 1, jc: 'center' }),
      ],
    ],
  });

  B.push({
    k: 'note',
    t: `El nivel del CUI es el del riesgo abierto más alto.${kri.length ? ` KRI en alerta: ${kri.join('; ')}.` : ' Sin KRI en alerta.'}`,
  });

  const top = ab.filter((r) => {
    const l = lvlOfRisk(r, params);
    return l === 'CRÍTICO' || l === 'ALTA' || r.estado === 'Materializado';
  });

  B.push({
    k: 'tbl',
    w: W2,
    rows: [[HD('RIESGOS CRÍTICO Y ALTO, Y RIESGOS MATERIALIZADOS', 2)]].concat(
      top.length
        ? []
        : [
            [
              C('No hay riesgos críticos, altos ni materializados abiertos en este corte.', {
                span: 2,
                i: 1,
              }),
            ],
          ]
    ),
  });

  top.forEach((r) => {
    const l = lvlOfRisk(r, params);
    const h = r.hist || [];
    let tend = '= sin cambio frente al corte anterior';
    if (h.length >= 2) {
      const a = h[h.length - 2];
      const b = h[h.length - 1];
      const s0 = params.P[a.p] * params.I[a.i];
      const s1 = params.P[b.p] * params.I[b.i];
      const dir = s1 > s0 ? 'sube' : s1 < s0 ? 'baja' : '= sin cambio';
      tend = `${dir} frente al registro del ${formatDateShort(a.f)} (era ${NIVM[nivelFromScore(s0, params)].toLowerCase()}, ${dc(s0, 3)})`;
    } else if (diffDays(r.creado, prev) >= 0) {
      tend = `nuevo, registrado el ${formatDateShort(r.creado)}`;
    }

    B.push({
      k: 'tbl',
      w: W2,
      rows: [
        [
          C(r.id, { fill: '16365C', c: 'FFFFFF', b: 1 }),
          NC(l, NIVM[l].toUpperCase(), { jc: 'left' }),
        ],
        [L('Categoría'), C(r.cats.join(' / '))],
        [
          L('Descripción'),
          C(`Debido a ${r.causa}, puede ocurrir ${r.evento}, lo que afectaría ${r.consec}.`),
        ],
        [
          L('Calificación'),
          C([
            [
              [
                `P ${dc(params.P[r.p], 2)} × I ${dc(params.I[r.i], 2)} = ${dc(scoreRisk(r, params), 3)} → `,
                { b: 1 },
              ],
              [NIVM[l], { b: 1, c: NIVT[l] }],
              [l === 'CRÍTICO' ? '  (alto y no mitigable)' : '', {}],
            ],
          ]),
        ],
        [
          L('Estado / tendencia'),
          C([
            [
              [r.estado, { b: 1, c: r.estado === 'Materializado' ? 'C00000' : '' }],
              [` · ${tend}`, {}],
              [
                r.val === 'Validado' && r.valBy
                  ? ` · validado por ${uById(r.valBy).nombre}`
                  : r.val
                    ? ` · ${r.val.toLowerCase()} (aún no oficial)`
                    : '',
                { i: 1, c: r.val && r.val !== 'Validado' ? 'C00000' : '' },
              ],
            ],
          ]),
        ],
        [
          L('Origen'),
          C(`${r.origen} · registrado por ${uById(r.por).nombre} (${areaLab(uById(r.por).area)})`),
        ],
        [L('Estrategia'), C(r.estrategia || '[Por definir]')],
        [L('Dueño / validador'), C(`${r.resp} / ${VALID_BY_UO[p.uo] || 'Jefatura de línea'}`)],
      ],
      just: 1,
    });

    const WA = [3600, 1900, 1525, 1250, 2000];
    B.push({
      k: 'tbl',
      w: WA,
      rows: [
        [
          SUB(
            r.estado === 'Materializado'
              ? 'Plan de acción (riesgo materializado)'
              : 'Acciones de respuesta',
            5
          ),
        ],
        ['Acción', 'Responsable', 'Fecha límite', 'Avance', 'Estado'].map(CH),
      ].concat(
        r.acc.length
          ? r.acc.map((a) => {
              const v = a.est !== 'Atendida' && diffDays(a.f, corte) < 0;
              return [
                C(a.t),
                C(a.r, { jc: 'center' }),
                C(formatDateShort(a.f), { jc: 'center' }),
                C(`${a.av} %`, { jc: 'center' }),
                C(v ? `Vencida (${Math.abs(diffDays(a.f, corte))} días)` : a.est, {
                  jc: 'center',
                  b: v ? 1 : 0,
                  c: v ? 'C00000' : '',
                }),
              ];
            })
          : [[C('Sin plan de acción registrado.', { span: 5, c: 'C00000', b: 1 })]]
      ),
    });
  });

  const dec: AmCell[][] = [];
  ab.filter((r) => lvlOfRisk(r, params) === 'CRÍTICO' || r.estado === 'Materializado').forEach(
    (r) => {
      const a = r.acc.find((x) => x.est !== 'Atendida');
      const lv = lvlOfRisk(r, params);
      dec.push([
        L(`${r.id} – ${NIVM[lv]}`),
        C(
          `Apoyo para: ${a ? a.t.charAt(0).toLowerCase() + a.t.slice(1) : 'definir el plan de acción'}. Sin esta gestión se compromete ${r.consec}.`
        ),
      ]);
    }
  );

  venc
    .filter(([, a]) => diffDays(corte, a.f) > 5)
    .forEach(([r, a]) => {
      dec.push([
        L(`${r.id} – Escalamiento`),
        C(
          `La acción «${a.t}» venció el ${formatDateShort(a.f)} y sigue sin evidencia ${diffDays(corte, a.f)} días después: se escala a la Dirección Ejecutiva.`
        ),
      ]);
    });

  B.push({
    k: 'tbl',
    w: W2,
    rows: [[HD('DECISIONES O APOYO QUE SE PIDEN A LA DIRECCIÓN EJECUTIVA', 2)]].concat(
      dec.length
        ? dec
        : [
            [
              C('No se requieren decisiones de la Dirección Ejecutiva en este corte.', {
                span: 2,
                i: 1,
              }),
            ],
          ]
    ),
    just: 1,
  });

  const lo = ab.filter((r) => !top.includes(r));
  const rv = revisiones[p.cui] || corte;
  const nx = (n: number): string => {
    const d = new Date(rv + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return formatDateShort(d.toISOString().slice(0, 10));
  };

  B.push({
    k: 'tbl',
    w: [1500, 1600, 4125, 1500, 1550],
    rows: [
      [HD('RIESGOS MODERADOS Y BAJOS', 5)],
      ['Código', 'Categoría', 'Descripción', 'Nivel', 'Próxima revisión'].map(CH),
    ].concat(
      lo.length
        ? lo.map((r) => {
            const l = lvlOfRisk(r, params);
            return [
              C(r.id, { jc: 'center' }),
              C(r.cats.join(' / '), { jc: 'center' }),
              C(`Debido a ${r.causa}, podría ocurrir ${r.evento}.`),
              NC(l, `${NIVM[l]} ${dc(scoreRisk(r, params), 3)}`),
              C(nx(l === 'BAJA' ? 30 : 14), { jc: 'center' }),
            ];
          })
        : [[C('No hay riesgos moderados ni bajos abiertos.', { span: 5, i: 1 })]]
    ),
  });

  B.push({
    k: 'note',
    t: 'Frecuencia de revisión: crítico y alto, semanal; moderado, quincenal; bajo, mensual.',
  });

  const nuevos = all.filter((r) => diffDays(r.creado, prev) >= 0);
  const cerr = all.filter((r) => r.estado === 'Cerrado' && diffDays(r.actF, prev) >= 0);
  const cambios = all.filter((r) => {
    const h = r.hist || [];
    if (h.length < 2) return false;
    const x = h[h.length - 2];
    const y = h[h.length - 1];
    return diffDays(y.f, prev) >= 0 && params.P[x.p] * params.I[x.i] !== params.P[y.p] * params.I[y.i];
  });
  const upp = all.filter((r) => /UPP/i.test(r.origen || ''));
  const li = <T>(arr: readonly T[], f: (item: T) => string): string =>
    arr.length ? arr.map(f).join('\n') : 'Ninguno.';

  B.push({
    k: 'tbl',
    w: W2,
    rows: [
      [HD(`MOVIMIENTOS DESDE EL CORTE ANTERIOR (${formatDateShort(prev)})`, 2)],
      [
        L('Riesgos nuevos'),
        C(
          li(
            nuevos,
            (r) =>
              `${r.id} (${NIVM[lvlOfRisk(r, params)].toLowerCase()}) registrado el ${formatDateShort(r.creado)}.`
          )
        ),
      ],
      [
        L('Cambios de calificación'),
        C(
          li(cambios, (r) => {
            const h = r.hist;
            const b = h[h.length - 1];
            const a = h[h.length - 2];
            const s0 = params.P[a.p] * params.I[a.i];
            const s1 = params.P[b.p] * params.I[b.i];
            const n0 = NIVM[nivelFromScore(s0, params)].toLowerCase();
            const n1 = NIVM[nivelFromScore(s1, params)].toLowerCase();
            const msg =
              n0 === n1
                ? `: ${s1 > s0 ? 'subió' : 'bajó'} de ${dc(s0, 3)} a ${dc(s1, 3)} (sigue ${n1})`
                : `: pasó de ${n0} a ${n1}`;
            return `${r.id}${msg} el ${formatDateShort(b.f)} (${b.n.charAt(0).toLowerCase() + b.n.slice(1)}).`;
          })
        ),
      ],
      [L('Riesgos materializados'), C(li(mat, (r) => `${r.id}.`))],
      [L('Riesgos cerrados'), C(li(cerr, (r) => `${r.id} el ${formatDateShort(r.actF)}.`))],
      [
        L('Notificaciones de la UPP'),
        C(
          upp.length
            ? upp
                .map(
                  (r) =>
                    `${r.id}: ${
                      r.estado === 'Propuesto'
                        ? 'pendiente de respuesta de la unidad'
                        : r.estado === 'Rechazado'
                          ? `rechazada (${r.rech ? r.rech.mot : ''})`
                          : 'aceptada por la unidad'
                    }.`
                )
                .join('\n')
            : 'Ninguna.'
        ),
      ],
    ],
  });

  const WM = [1275, 1800, 1800, 1800, 1800, 1800];
  const mrows: AmCell[][] = [
    [HD('MATRIZ DE CALOR DEL CUI (probabilidad × impacto)', 6)],
    [CH('P \\ I')].concat(IMPACTO_LABELS.map((i) => CH(dc(params.I[i], 2)))),
  ];

  PROBABILIDAD_LABELS.forEach((pl) => {
    mrows.push(
      [CH(dc(params.P[pl], 2))].concat(
        IMPACTO_LABELS.map((il) => {
          const s = params.P[pl] * params.I[il];
          const here = ab.filter((r) => r.p === pl && r.i === il);
          const l: NivelRiesgo = here.some((r) => isCritRisk(r, params))
            ? 'CRÍTICO'
            : nivelFromScore(s, params);
          return here.length
            ? NC(l, here.map((r) => r.id.replace('R-26-', 'R')).join(' · '))
            : C(dc(s, 3), { fill: NIVF[l][0], c: NIVF[l][1], jc: 'center', sz: 15 });
        })
      )
    );
  });

  B.push({ k: 'tbl', w: WM, rows: mrows });
  B.push({
    k: 'note',
    t: `Cortes vigentes: bajo hasta ${dc(params.cBaja, 3)} · moderado entre ambos · alto desde ${dc(params.cAlta, 3)} · crítico = alto y no mitigable (matriz OECE con decimales). [Por alinear con el lineamiento v0.3, que usa cortes por puntaje.]`,
  });
  B.push({
    k: 'foot',
    t: `Generado por el SSCPI – módulo de riesgos · Registrador(es): ${[...new Set(all.map((r) => uById(r.por).nombre))].join(', ') || '—'} · Última revisión: ${formatDateShort(revisiones[p.cui])} · Datos de ejemplo del prototipo.`,
  });

  return {
    file: `AM_RIESGOS_${p.cui}_${slug(p.corto).toUpperCase()}.docx`,
    blocks: B,
  };
}

export function buildAmPlainText(doc: AmDocument): string {
  const out: string[] = [];
  const tx = (c: AmCell): string =>
    c.ps.map((p) => p.map((s) => s[0]).join('')).join('\n');

  doc.blocks.forEach((bk) => {
    if (bk.k === 'title') {
      out.push(bk.t, `CUI ${bk.cui} · ${bk.lab} ${bk.fecha}`, bk.nombre, '');
    }
    if (bk.k === 'note' || bk.k === 'foot') {
      out.push(bk.t, '');
    }
    if (bk.k === 'tbl') {
      bk.rows.forEach((r) => {
        if (r.length === 1) {
          out.push(
            (r[0].span ?? 1) > 1 && r[0].fill === '16365C'
              ? '\n' + tx(r[0]).toUpperCase()
              : tx(r[0])
          );
        } else if (r.length === 2) {
          out.push(`${tx(r[0])}: ${tx(r[1]).replace(/\n/g, '\n   ')}`);
        } else {
          out.push(r.map(tx).join(' | '));
        }
      });
    }
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function buildExcelReportSpec(
  kind: 'cart' | 'risk' | 'mira',
  roleScopedProjects: readonly ProyectoSsp[],
  roleScopedRisks: readonly RiesgoSsp[],
  allRisks: readonly RiesgoSsp[],
  projectByCui: Record<string, ProyectoSsp>,
  params: ParametrosSsp,
  revisiones: Record<string, string>,
  roleSuffix: string,
  corte: string = CORTE_FECHA
): ExcelReportSpec {
  if (kind === 'cart') {
    return {
      sheet: 'Cartera',
      title: `Reporte semanal de la cartera – PNSR${roleSuffix}`,
      file: `Reporte_semanal_cartera_${corte}.xlsx`,
      money: [9, 10],
      widths: [11, 24, 13, 15, 18, 15, 14, 11, 12, 13, 14, 8, 14, 10, 12],
      head: [
        'CUI',
        'Proyecto',
        'Priorización',
        'Unidad',
        'Etapa',
        'Modalidad',
        'Estado',
        'Avance físico %',
        'Programado %',
        'PIM (S/)',
        'Devengado (S/)',
        'Ejec. %',
        'Nivel de riesgo',
        'Alertas críticas',
        '¿Culmina 2026?',
      ],
      rows: roleScopedProjects.map((p) => {
        const critAlerts = computeAlertas([p], allRisks, params, revisiones, corte).filter(
          (a) => a.sev === 'Crítica'
        ).length;
        return [
          p.cui,
          p.corto,
          p.pri || '—',
          areaLab(p.uo),
          p.etapa,
          p.mod,
          p.estado,
          p.fis,
          p.prog,
          p.pim,
          p.dev,
          +((p.dev / p.pim) * 100).toFixed(1),
          projectRiskLevel(p.cui, allRisks, params) || 'Sin riesgos',
          critAlerts,
          p.culm,
        ];
      }),
    };
  }

  if (kind === 'risk') {
    return {
      sheet: 'Matriz de riesgos',
      title: `Matriz de riesgos y planes de acción – PNSR${roleSuffix} [formato del Ministerio por confirmar]`,
      file: `Matriz_riesgos_PNSR_${corte}.xlsx`,
      widths: [11, 10, 18, 20, 30, 30, 26, 14, 12, 9, 10, 11, 45, 22, 11, 13, 22, 26],
      head: [
        'Código',
        'CUI',
        'Proyecto',
        'Categorías',
        'Causa',
        'Evento',
        'Consecuencia',
        'Probabilidad',
        'Impacto',
        'Resultado',
        'Nivel',
        'Estrategia',
        'Acciones',
        'Responsable',
        'Fecha límite',
        'Estado',
        'Validación',
        'Registrado por',
      ],
      rows: roleScopedRisks
        .filter((r) => r.estado !== 'Rechazado')
        .map((r) => [
          r.id,
          r.cui,
          projectByCui[r.cui]?.corto || r.cui,
          r.cats.join(' / '),
          r.causa,
          r.evento,
          r.consec,
          `${r.p} (${params.P[r.p]})`,
          `${r.i} (${params.I[r.i]})`,
          scoreRisk(r, params),
          lvlOfRisk(r, params),
          r.estrategia,
          r.acc.map((a) => `${a.t} – ${a.r} – ${formatDateShort(a.f)} – ${a.est}`).join('; '),
          r.resp,
          formatDateShort(r.flim),
          r.estado,
          r.estado === 'Propuesto'
            ? 'Notificado por la UPP'
            : r.val === 'Validado' && r.valBy
              ? `Validado por ${uById(r.valBy).nombre}`
              : r.val || '—',
          `${uById(r.por).nombre} (${areaLab(uById(r.por).area)})`,
        ]),
    };
  }

  return {
    sheet: 'MIRA',
    title: 'Cifras para el MIRA – obras en ejecución y paralizadas',
    file: `Cifras_MIRA_${corte}.xlsx`,
    money: [4, 5],
    widths: [11, 26, 14, 14, 15, 15, 12],
    head: ['CUI', 'Proyecto', 'Estado', 'Avance físico %', 'PIM (S/)', 'Devengado (S/)', 'Corte'],
    rows: roleScopedProjects
      .filter((p) => p.etapa === 'Ejecución de obra' || p.estado === 'Paralizada')
      .map((p) => [p.cui, p.corto, p.estado, p.fis, p.pim, p.dev, formatDateShort(corte)]),
  };
}
