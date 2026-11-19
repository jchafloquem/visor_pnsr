import { CORTE_FECHA } from '../config/institutional.constants';
import { formatDateShort } from '../../components/cartera/domain/project-projection.rules';
import { ExportTraceItem } from '../../components/cartera/models/ssp.models';
import { ExcelReportSpec } from '../../components/reportes/domain/ayuda-memoria.builder';
import { saveBlobFile, xmlEscape, zipBlob } from './zip-builder';

export function buildXlsxBlob(
  rep: ExcelReportSpec,
  userName: string,
  userAreaLabel: string,
  trace?: ExportTraceItem
): Blob {
  const head = rep.head;
  const rows = rep.rows;
  const nc = head.length;
  const money = rep.money || [];

  const col = (idx: number): string => {
    let s = '';
    let i = idx + 1;
    while (i) {
      const m = (i - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  };

  const cell = (v: string | number | null | undefined, r: number, c: number, st: number): string => {
    const ref = col(c) + r;
    if (v == null || v === '') return `<c r="${ref}" s="${st}"/>`;
    if (typeof v === 'number' && isFinite(v)) {
      const styleIdx = st === 0 && money.includes(c) ? 5 : st === 0 ? 2 : st;
      return `<c r="${ref}" s="${styleIdx}"><v>${v}</v></c>`;
    }
    return `<c r="${ref}" t="inlineStr" s="${st}"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
  };

  const last = col(nc - 1);
  const n = rows.length + 4;
  const traceStr = trace
    ? `${trace.fecha} a las ${trace.hora} · Código de verificación: ${trace.cod}`
    : new Date().toLocaleDateString('es-PE');

  let sd =
    `<row r="1" ht="22" customHeight="1">${cell(rep.title, 1, 0, 3)}</row>` +
    `<row r="2">${cell(`Corte: ${formatDateShort(CORTE_FECHA)} · Generado por ${userName} (${userAreaLabel}) el ${traceStr} · Documento de uso interno · Datos de ejemplo del prototipo`, 2, 0, 4)}</row>` +
    `<row r="4" ht="30" customHeight="1">${head.map((h, c) => cell(h, 4, c, 1)).join('')}</row>`;

  rows.forEach((r, k) => {
    sd += `<row r="${k + 5}">${r.map((v, c) => cell(v, k + 5, c, 0)).join('')}</row>`;
  });

  const colsXml = head
    .map(
      (h, c) =>
        `<col min="${c + 1}" max="${c + 1}" width="${(rep.widths && rep.widths[c]) || Math.min(45, Math.max(10, String(h).length + 4))}" customWidth="1"/>`
    )
    .join('');

  const ws =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<sheetViews><sheetView workbookViewId="0" zoomScale="90"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${colsXml}</cols>` +
    `<sheetData>${sd}</sheetData>` +
    `<autoFilter ref="A4:${last}${n}"/>` +
    `<mergeCells count="2"><mergeCell ref="A1:${last}1"/><mergeCell ref="A2:${last}2"/></mergeCells>` +
    `<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>` +
    `</worksheet>`;

  const sh = xmlEscape(rep.sheet);
  const wb =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${sh}" sheetId="1" r:id="rId1"/></sheets>` +
    `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${sh}'!$A$4:$${last}$${n}</definedName></definedNames>` +
    `</workbook>`;

  const st =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="4">` +
    `<font><sz val="10"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="14"/><color rgb="FF16365C"/><name val="Calibri"/></font>` +
    `<font><i/><sz val="9"/><color rgb="FF5B6575"/><name val="Calibri"/></font>` +
    `</fonts>` +
    `<fills count="3">` +
    `<fill><patternFill patternType="none"/></fill>` +
    `<fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FF16365C"/><bgColor indexed="64"/></patternFill></fill>` +
    `</fills>` +
    `<borders count="2">` +
    `<border><left/><right/><top/><bottom/><diagonal/></border>` +
    `<border><left style="thin"><color rgb="FFC9D3DF"/></left><right style="thin"><color rgb="FFC9D3DF"/></right><top style="thin"><color rgb="FFC9D3DF"/></top><bottom style="thin"><color rgb="FFC9D3DF"/></bottom><diagonal/></border>` +
    `</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="6">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>` +
    `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/>` +
    `<xf numFmtId="0" fontId="3" fillId="0" borderId="0" applyFont="1"/>` +
    `<xf numFmtId="3" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>` +
    `</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  const ct =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;

  return zipBlob(
    [
      ['[Content_Types].xml', ct],
      [
        '_rels/.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      ],
      ['xl/workbook.xml', wb],
      [
        'xl/_rels/workbook.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      ],
      ['xl/worksheets/sheet1.xml', ws],
      ['xl/styles.xml', st],
    ],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

export function downloadXlsxReport(
  rep: ExcelReportSpec,
  userName: string,
  userAreaLabel: string,
  trace?: ExportTraceItem
): void {
  const blob = buildXlsxBlob(rep, userName, userAreaLabel, trace);
  saveBlobFile(blob, rep.file);
}
