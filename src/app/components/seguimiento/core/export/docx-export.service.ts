import {
  AmDocument,
  AmParagraph,
  AmRunOption,
  AmTableBlock,
} from '../../components/reportes/domain/ayuda-memoria.builder';
import { saveBlobFile, xmlEscape, zipBlob } from './zip-builder';

interface BaseRunFormat {
  b?: number | boolean;
  i?: number | boolean;
  c?: string;
  sz?: number;
  f?: string;
}

function sp(t: string, o: AmRunOption = {}): AmParagraph {
  return [[t, o]];
}

function wRun(t: string, o: AmRunOption, base: BaseRunFormat): string {
  const b = o.b != null ? o.b : base.b;
  const i = o.i != null ? o.i : base.i;
  const c = o.c || base.c || '000000';
  const sz = o.sz || base.sz || 18;
  const f = base.f || 'Calibri';
  return (
    `<w:r><w:rPr><w:rFonts w:ascii="${f}" w:eastAsia="${f}" w:hAnsi="${f}" w:cs="${f}"/>` +
    (b ? '<w:b/><w:bCs/>' : '') +
    (i ? '<w:i/><w:iCs/>' : '') +
    `<w:color w:val="${c}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>` +
    `<w:t xml:space="preserve">${xmlEscape(t)}</w:t></w:r>`
  );
}

function wP(
  par: AmParagraph,
  base: BaseRunFormat,
  jc: string = '',
  after: number = 0
): string {
  return (
    `<w:p><w:pPr><w:spacing w:before="0" w:after="${after || 0}" w:line="240" w:lineRule="auto"/>` +
    (jc ? `<w:jc w:val="${jc}"/>` : '') +
    `</w:pPr>` +
    par.map(([t, o]) => wRun(t, o || {}, base)).join('') +
    `</w:p>`
  );
}

function wTbl(bk: AmTableBlock): string {
  const W = bk.w;
  const tot = W.reduce((a, b) => a + b, 0);
  const bd = (v: string): string => `w:val="${v}" w:sz="6" w:space="0" w:color="000000"`;

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${tot}" w:type="dxa"/><w:tblInd w:w="-30" w:type="dxa"/><w:tblLayout w:type="fixed"/>` +
    `<w:tblCellMar><w:top w:w="65" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="65" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid>${W.map((x) => `<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid>` +
    bk.rows
      .map((r) => {
        let ci = 0;
        return (
          `<w:tr><w:trPr><w:cantSplit/></w:trPr>` +
          r
            .map((c) => {
              const s = c.span || 1;
              const w = W.slice(ci, ci + s).reduce((a, b) => a + b, 0);
              ci += s;
              const align = c.jc || (bk.just && !c.fill ? 'both' : '');
              return (
                `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>` +
                (s > 1 ? `<w:gridSpan w:val="${s}"/>` : '') +
                `<w:tcBorders><w:top ${bd('nil')}/><w:left ${bd('nil')}/><w:bottom ${bd('single')}/><w:right ${bd(ci >= W.length ? 'nil' : 'single')}/></w:tcBorders>` +
                (c.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${c.fill}"/>` : '') +
                `<w:vAlign w:val="center"/></w:tcPr>` +
                c.ps
                  .map((p) => wP(p, { b: c.b, i: c.i, c: c.c, sz: c.sz }, align))
                  .join('') +
                `</w:tc>`
              );
            })
            .join('') +
          `</w:tr>`
        );
      })
      .join('') +
    `</w:tbl>`
  );
}

const DOCX_TEMPLATE_PARTS: Record<string, string> = {
  '[Content_Types].xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png" /><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" /><Default Extension="xml" ContentType="application/xml" /><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" /><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml" /><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml" /><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml" /><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml" /><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml" /></Types>',
  '_rels/.rels':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml" /><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml" /><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml" /></Relationships>',
  'word/_rels/document.xml.rels':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml" /><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml" /><Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml" /></Relationships>',
  'word/styles.xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial" /><w:sz w:val="22" /><w:szCs w:val="22" /><w:lang w:val="es-419" w:eastAsia="es-PE" /></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line="276" w:lineRule="auto" /></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal" /><w:qFormat /></w:style><w:style w:type="table" w:default="1" w:styleId="Tablanormal"><w:name w:val="Normal Table" /><w:tblPr><w:tblInd w:w="0" w:type="dxa" /><w:tblCellMar><w:top w:w="0" w:type="dxa" /><w:left w:w="108" w:type="dxa" /><w:bottom w:w="0" w:type="dxa" /><w:right w:w="108" w:type="dxa" /></w:tblCellMar></w:tblPr></w:style></w:styles>',
  'word/settings.xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720" /></w:settings>',
  'word/header1.xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:ind w:left="-141" /></w:pPr><w:r><w:rPr><w:noProof /></w:rPr><w:drawing><wp:inline distT="114300" distB="114300" distL="114300" distR="114300"><wp:extent cx="1878563" cy="295275" /><wp:effectExtent l="0" t="0" r="0" b="0" /><wp:docPr id="1" name="image1.png" /><wp:cNvGraphicFramePr /><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="image1.png" /><pic:cNvPicPr preferRelativeResize="0" /></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1" /><a:srcRect /><a:stretch><a:fillRect /></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0" /><a:ext cx="1878563" cy="295275" /></a:xfrm><a:prstGeom prst="rect"><a:avLst /></a:prstGeom><a:ln /></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p></w:hdr>',
  'word/_rels/header1.xml.rels':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png" /></Relationships>',
  'docProps/app.xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application></Properties>',
  'docProps/core.xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Ayuda memoria</dc:title><dc:creator>SSCPI - PNSR</dc:creator></cp:coreProperties>',
};

let cachedLogoBytes: Uint8Array | null = null;

async function fetchHeaderLogoBytes(): Promise<Uint8Array> {
  if (cachedLogoBytes) return cachedLogoBytes;
  try {
    const res = await fetch('assets/images/logo_mvcs.png');
    if (res.ok) {
      const buf = await res.arrayBuffer();
      cachedLogoBytes = new Uint8Array(buf);
      return cachedLogoBytes;
    }
  } catch {
    // Fallback 1x1 transparent PNG
  }
  return Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    ),
    (c) => c.charCodeAt(0)
  );
}

export async function buildDocxBlob(doc: AmDocument): Promise<Blob> {
  let body = '';
  doc.blocks.forEach((bk) => {
    if (bk.k === 'title') {
      body +=
        wP(sp(bk.t, { b: 1, c: '16365C', sz: 30 }), { f: 'Arial' }, '', 120) +
        `<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="10200"/></w:tabs><w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr>` +
        wRun('CUI ' + bk.cui, { b: 1, c: '16365C', sz: 22 }, { f: 'Arial' }) +
        `<w:r><w:tab/></w:r>` +
        wRun(bk.lab + ' ', { i: 1, c: 'C00000', sz: 20 }, { f: 'Arial' }) +
        wRun(bk.fecha, { b: 1, i: 1, c: 'C00000', sz: 20 }, { f: 'Arial' }) +
        `</w:p>` +
        wP(sp(bk.nombre, { b: 1, sz: 18 }), { f: 'Arial' }, 'both', 160);
    }
    if (bk.k === 'tbl') {
      body += wTbl(bk) + wP(sp('', { sz: 10 }), {}, '', 0);
    }
    if (bk.k === 'note') {
      body += wP(sp(bk.t, { i: 1, c: '333333', sz: 15 }), {}, 'both', 120);
    }
    if (bk.k === 'foot') {
      body += wP(sp(bk.t, { i: 1, c: '333333', sz: 14 }), {}, '', 0);
    }
  });

  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<w:body>${body}` +
    `<w:sectPr><w:headerReference w:type="default" r:id="rId6"/><w:pgSz w:w="12240" w:h="15840"/>` +
    `<w:pgMar w:top="1388" w:right="1009" w:bottom="861" w:left="1009" w:header="708" w:footer="720" w:gutter="0"/><w:cols w:space="720"/></w:sectPr>` +
    `</w:body></w:document>`;

  const imgBytes = await fetchHeaderLogoBytes();
  const files: Array<[string, string | Uint8Array]> = [
    ['[Content_Types].xml', DOCX_TEMPLATE_PARTS['[Content_Types].xml']],
    ...Object.keys(DOCX_TEMPLATE_PARTS)
      .filter((k) => k !== '[Content_Types].xml')
      .map((k): [string, string] => [k, DOCX_TEMPLATE_PARTS[k]]),
    ['word/document.xml', xml],
    ['word/media/image1.png', imgBytes],
  ];

  return zipBlob(
    files,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

export async function downloadDocxDraft(doc: AmDocument): Promise<void> {
  const blob = await buildDocxBlob(doc);
  saveBlobFile(blob, doc.file.replace('.docx', '_BORRADOR.docx'));
}
