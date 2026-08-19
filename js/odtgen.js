// .odt generator: sheet models -> OpenDocument text bytes.
// Same layout rules as the docx generator; styles are deduplicated
// automatic paragraph styles.

import { zipSync, strToU8 } from './vendor/fflate.js';
import { escapeXml } from './format.js';
import { PAGE } from './config.js';

const MIME = 'application/vnd.oasis.opendocument.text';
const LINE_MAP = { '1.0': '100%', '1.5': '150%', '2.0': '200%' };

const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
<manifest:file-entry manifest:full-path="/" manifest:media-type="${MIME}"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

const FONT_DECLS = `<office:font-face-decls><style:font-face style:name="${PAGE.fontFamily}" svg:font-family="'${PAGE.fontFamily}'" style:font-family-generic="roman" style:font-pitch="variable"/></office:font-face-decls>`;

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.2">
${FONT_DECLS}
<office:styles>
<style:default-style style:family="paragraph"><style:text-properties style:font-name="${PAGE.fontFamily}" fo:font-family="'${PAGE.fontFamily}'" fo:font-size="${PAGE.fontSizePt}pt"/></style:default-style>
<style:style style:name="Standard" style:family="paragraph" style:class="text"/>
</office:styles>
<office:automatic-styles>
<style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="${PAGE.widthCm}cm" fo:page-height="${PAGE.heightCm}cm" style:print-orientation="portrait" fo:margin-top="${PAGE.marginTopCm}cm" fo:margin-bottom="${PAGE.marginBottomCm}cm" fo:margin-left="${PAGE.marginLeftCm}cm" fo:margin-right="${PAGE.marginRightCm}cm"/></style:page-layout>
</office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles>
</office:document-styles>`;
}

export function generateOdtContentXml(sheets) {
  // Deduplicate paragraph styles by their property tuple.
  const styleKeys = new Map(); // key -> style name
  const styleDefs = [];
  const styleFor = (p) => {
    const key = `${p.align}|${p.bold ? 1 : 0}|${p.spacing}|${p.breakBefore ? 1 : 0}`;
    if (!styleKeys.has(key)) {
      const name = `P${styleKeys.size + 1}`;
      styleKeys.set(key, name);
      const paraProps = [
        'fo:margin-top="0cm" fo:margin-bottom="0cm"',
        `fo:line-height="${LINE_MAP[p.spacing] || '100%'}"`,
        p.align === 'right' ? 'fo:text-align="end" style:justify-single-word="false"' : '',
        p.breakBefore ? 'fo:break-before="page"' : '',
      ].filter(Boolean).join(' ');
      const textProps = `style:font-name="${PAGE.fontFamily}" fo:font-family="'${PAGE.fontFamily}'" fo:font-size="${PAGE.fontSizePt}pt"${p.bold ? ' fo:font-weight="bold"' : ''}`;
      styleDefs.push(`<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties ${paraProps}/><style:text-properties ${textProps}/></style:style>`);
    }
    return styleKeys.get(key);
  };

  const bodyParts = [];
  for (const sheet of sheets) {
    for (const p of sheet.paragraphs) {
      const name = styleFor(p);
      // Tabs must be <text:tab/> elements and runs of spaces need <text:s/>
      // (ODF whitespace rules collapse both). escapeXml leaves tabs/spaces
      // untouched, so replacing after escaping is safe.
      let inner = escapeXml(p.text || '')
        .replace(/\t/g, '<text:tab/>')
        .replace(/ {2,}/g, (m) => ` <text:s text:c="${m.length - 1}"/>`);
      if (p.trailing) inner += `<text:s text:c="${p.trailing}"/>`;
      bodyParts.push(inner ? `<text:p text:style-name="${name}">${inner}</text:p>` : `<text:p text:style-name="${name}"/>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.2">
${FONT_DECLS}
<office:automatic-styles>
${styleDefs.join('\n')}
</office:automatic-styles>
<office:body><office:text>
${bodyParts.join('\n')}
</office:text></office:body>
</office:document-content>`;
}

// Returns Uint8Array of the finished .odt file.
export function generateOdt(sheets) {
  return zipSync({
    // Per the ODF spec the mimetype entry must be stored uncompressed.
    mimetype: [strToU8(MIME), { level: 0 }],
    'META-INF/manifest.xml': strToU8(MANIFEST),
    'content.xml': strToU8(generateOdtContentXml(sheets)),
    'styles.xml': strToU8(stylesXml()),
  }, { level: 6 });
}
