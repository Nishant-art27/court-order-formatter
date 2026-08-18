// .docx generator: sheet models -> Word document bytes.
// Hand-built OOXML — Times New Roman 14pt, A4, 4cm/2.5cm margins,
// one order sheet per page (pageBreakBefore on each sheet after the first).

import { zipSync, strToU8 } from './vendor/fflate.js';
import { escapeXml } from './format.js';
import { PAGE } from './config.js';

const cmToTwips = (v) => Math.round((v / 2.54) * 1440);
const LINE_MAP = { '1.0': 240, '1.5': 360, '2.0': 480 };
const HALF_POINTS = PAGE.fontSizePt * 2; // w:sz is in half-points

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function runProps(bold) {
  return `<w:rFonts w:ascii="${PAGE.fontFamily}" w:hAnsi="${PAGE.fontFamily}" w:cs="${PAGE.fontFamily}"/>${bold ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="${HALF_POINTS}"/><w:szCs w:val="${HALF_POINTS}"/>`;
}

function paragraphXml(p) {
  const pPr = [];
  if (p.breakBefore) pPr.push('<w:pageBreakBefore/>');
  if (p.align === 'right') pPr.push('<w:jc w:val="right"/>');
  pPr.push(`<w:spacing w:before="0" w:after="0" w:line="${LINE_MAP[p.spacing] || 240}" w:lineRule="auto"/>`);
  pPr.push(`<w:rPr>${runProps(p.bold)}</w:rPr>`);

  const text = (p.text || '') + ' '.repeat(p.trailing || 0);
  const run = text
    ? `<w:r><w:rPr>${runProps(p.bold)}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
    : '';
  return `<w:p><w:pPr>${pPr.join('')}</w:pPr>${run}</w:p>`;
}

export function generateDocxXml(sheets) {
  const body = sheets.flatMap((s) => s.paragraphs.map(paragraphXml)).join('\n');
  const cm = cmToTwips;
  const sectPr = `<w:sectPr><w:pgSz w:w="${cm(PAGE.widthCm)}" w:h="${cm(PAGE.heightCm)}"/><w:pgMar w:top="${cm(PAGE.marginTopCm)}" w:right="${cm(PAGE.marginRightCm)}" w:bottom="${cm(PAGE.marginBottomCm)}" w:left="${cm(PAGE.marginLeftCm)}" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${body}
${sectPr}
</w:body>
</w:document>`;
}

// Returns Uint8Array of the finished .docx file.
export function generateDocx(sheets) {
  return zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(RELS),
    'word/document.xml': strToU8(generateDocxXml(sheets)),
  }, { level: 6 });
}
