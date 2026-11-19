import type { jsPDF as JsPdfInstance } from 'jspdf';
import { ExportTraceItem } from '../../components/cartera/models/ssp.models';
import {
  AmCell,
  AmDocument,
  AmParagraph,
} from '../../components/reportes/domain/ayuda-memoria.builder';

let cachedLogoDataUrl: string | null = null;

async function fetchHeaderLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const res = await fetch('assets/images/logo_mvcs.png');
    if (res.ok) {
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      cachedLogoDataUrl = 'data:image/png;base64,' + btoa(binary);
      return cachedLogoDataUrl;
    }
  } catch {
    // Ignore logo fetch errors and continue without image
  }
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return [0, 0, 0];
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function sanitizeText(t: string): string {
  return String(t)
    .replace(/ → /g, ': ')
    .replace(/→/g, '>')
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    .replace(/•/g, '-')
    .replace(/«|»/g, '"');
}

function paragraphPlainText(par: AmParagraph): string {
  return sanitizeText(par.map(([t]) => t).join(''));
}

function isParagraphBold(par: AmParagraph, cell: AmCell): boolean {
  if (cell.b) return true;
  return par.length > 0 && par.every(([, o]) => !!o?.b);
}

function isParagraphItalic(par: AmParagraph, cell: AmCell): boolean {
  if (cell.i) return true;
  return par.length > 0 && par.every(([, o]) => !!o?.i);
}

function resolveParagraphColor(par: AmParagraph, cell: AmCell): string {
  const firstColor = par.find(([, o]) => !!o?.c)?.[1]?.c;
  return firstColor || cell.c || '000000';
}

function drawPageHeader(pdf: JsPdfInstance, logoDataUrl: string | null, marginX: number): void {
  if (logoDataUrl) {
    try {
      pdf.addImage(logoDataUrl, 'PNG', marginX, 18, 132, 26);
    } catch {
      // Fallback if image decoding fails
    }
  }
}

function drawFooters(
  pdf: JsPdfInstance,
  tr: ExportTraceItem,
  authorName: string,
  authorAreaLabel: string,
  marginX: number,
  pageWidth: number,
  pageHeight: number
): void {
  const totalPages = pdf.getNumberOfPages();
  const footerY = pageHeight - 24;

  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(220, 227, 236);
    pdf.setLineWidth(0.5);
    pdf.line(marginX, footerY - 10, pageWidth - marginX, footerY - 10);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(91, 101, 117);

    const leftText = sanitizeText(
      `Generado por ${authorName} (${authorAreaLabel}) el ${tr.fecha} a las ${tr.hora} · Código: ${tr.cod} · Uso interno PNSR`
    );
    pdf.text(leftText, marginX, footerY);
    pdf.text(`Página ${p} de ${totalPages}`, pageWidth - marginX, footerY, { align: 'right' });
  }
}

export async function downloadOfficialPdf(
  doc: AmDocument,
  tr: ExportTraceItem,
  authorName: string,
  authorAreaLabel: string
): Promise<void> {
  const [{ jsPDF }, logoDataUrl] = await Promise.all([
    import('jspdf'),
    fetchHeaderLogoDataUrl(),
  ]);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 46;
  const contentWidth = pageWidth - marginX * 2;
  const topStartY = 58;
  const bottomLimitY = pageHeight - 46;

  pdf.setProperties({
    title: doc.file.replace('.docx', ''),
    author: `${authorName} (${authorAreaLabel})`,
    subject: `Código de verificación ${tr.cod}`,
    creator: 'SSCPI - PNSR',
  });

  drawPageHeader(pdf, logoDataUrl, marginX);
  let y = topStartY;

  const ensureSpace = (neededHeight: number): void => {
    if (y + neededHeight > bottomLimitY) {
      pdf.addPage();
      drawPageHeader(pdf, logoDataUrl, marginX);
      y = topStartY;
    }
  };

  for (const bk of doc.blocks) {
    if (bk.k === 'title') {
      ensureSpace(58);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(22, 54, 92);
      pdf.text(sanitizeText(bk.t), marginX, y);
      y += 16;

      pdf.setFontSize(10);
      pdf.text(`CUI ${sanitizeText(bk.cui)}`, marginX, y);

      pdf.setFont('helvetica', 'bolditalic');
      pdf.setTextColor(192, 0, 0);
      pdf.text(`${sanitizeText(bk.lab)} ${sanitizeText(bk.fecha)}`, pageWidth - marginX, y, {
        align: 'right',
      });
      y += 14;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(43, 51, 65);
      const nameLines = pdf.splitTextToSize(sanitizeText(bk.nombre), contentWidth) as string[];
      pdf.text(nameLines, marginX, y);
      y += nameLines.length * 11 + 8;
      continue;
    }

    if (bk.k === 'note' || bk.k === 'foot') {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(bk.k === 'note' ? 7.5 : 7);
      pdf.setTextColor(80, 88, 102);
      const lines = pdf.splitTextToSize(sanitizeText(bk.t), contentWidth) as string[];
      const blockH = lines.length * 9.5 + 6;
      ensureSpace(blockH);
      pdf.text(lines, marginX, y);
      y += blockH;
      continue;
    }

    if (bk.k === 'tbl') {
      const totalWeight = bk.w.reduce((acc, n) => acc + n, 0) || 1;
      const colWidths = bk.w.map((w) => (w / totalWeight) * contentWidth);
      const padX = 4;
      const padY = 4;

      for (const row of bk.rows) {
        // Pre-measure every cell in the row to determine uniform row height
        const measured: Array<{
          cell: AmCell;
          x: number;
          width: number;
          fontSize: number;
          paragraphs: Array<{
            lines: string[];
            bold: boolean;
            italic: boolean;
            color: string;
          }>;
          height: number;
        }> = [];

        let colIdx = 0;
        let rowHeight = 16;

        for (const cell of row) {
          const span = Math.max(1, cell.span || 1);
          const x =
            marginX + colWidths.slice(0, colIdx).reduce((acc, w) => acc + w, 0);
          const width = colWidths
            .slice(colIdx, colIdx + span)
            .reduce((acc, w) => acc + w, 0);
          colIdx += span;

          const fontSize = cell.sz ? Math.max(7, cell.sz / 2 - 0.5) : 8;
          const lineH = fontSize * 1.25;
          const innerW = Math.max(12, width - padX * 2);

          let cellTextH = 0;
          const paragraphs = cell.ps.map((par) => {
            const bold = isParagraphBold(par, cell);
            const italic = isParagraphItalic(par, cell);
            const style = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
            pdf.setFont('helvetica', style);
            pdf.setFontSize(fontSize);
            const lines = pdf.splitTextToSize(paragraphPlainText(par), innerW) as string[];
            cellTextH += Math.max(1, lines.length) * lineH;
            return {
              lines,
              bold,
              italic,
              color: resolveParagraphColor(par, cell),
            };
          });

          const totalH = cellTextH + padY * 2;
          if (totalH > rowHeight) rowHeight = totalH;

          measured.push({
            cell,
            x,
            width,
            fontSize,
            paragraphs,
            height: totalH,
          });
        }

        ensureSpace(rowHeight + 2);

        // Render row cells
        for (const m of measured) {
          if (m.cell.fill) {
            const [r, g, b] = hexToRgb(m.cell.fill);
            pdf.setFillColor(r, g, b);
            pdf.rect(m.x, y, m.width, rowHeight, 'F');
          }

          pdf.setDrawColor(180, 190, 204);
          pdf.setLineWidth(0.45);
          pdf.rect(m.x, y, m.width, rowHeight, 'S');

          const lineH = m.fontSize * 1.25;
          let textY = y + padY + m.fontSize * 0.85;

          for (const par of m.paragraphs) {
            const style =
              par.bold && par.italic
                ? 'bolditalic'
                : par.bold
                  ? 'bold'
                  : par.italic
                    ? 'italic'
                    : 'normal';
            pdf.setFont('helvetica', style);
            pdf.setFontSize(m.fontSize);
            const [r, g, b] = hexToRgb(par.color);
            pdf.setTextColor(r, g, b);

            const align = m.cell.jc === 'center' ? 'center' : 'left';
            const textX = align === 'center' ? m.x + m.width / 2 : m.x + padX;

            for (const line of par.lines) {
              pdf.text(line, textX, textY, { align });
              textY += lineH;
            }
          }
        }

        y += rowHeight;
      }

      y += 8;
    }
  }

  drawFooters(pdf, tr, authorName, authorAreaLabel, marginX, pageWidth, pageHeight);
  pdf.save(doc.file.replace('.docx', '.pdf'));
}
