// Pipeline tests: docread -> causelist -> sheets -> docx/odt generation.
// Run with: node tests/run-tests.mjs

import { unzipSync, strFromU8 } from '../js/vendor/fflate.js';
import { readDocumentParagraphs } from '../js/docread.js';
import { parseCauseList } from '../js/causelist.js';
import { buildSheets, buildStampLines } from '../js/sheets.js';
import { generateDocx, generateDocxXml } from '../js/docxgen.js';
import { generateOdt, generateOdtContentXml } from '../js/odtgen.js';
import { titleCaseName, formatDateDots, parseListDate, decodeXmlEntities } from '../js/format.js';
import { createDefaultOptions } from '../js/config.js';
import { CAUSE_LINES, buildFixtureDocx, buildFixtureOdt } from './fixture.mjs';

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { passed++; } else { failed++; failures.push(`${name}${detail ? ` — ${detail}` : ''}`); }
}
function eq(name, actual, expected) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ---------------------------------------------------------------------------
// format.js

eq('titlecase: simple', titleCaseName('ROSHAN LAL'), 'Roshan Lal');
eq('titlecase: M/S preserved', titleCaseName('M/S SABDA EXPORTS'), 'M/S Sabda Exports');
eq('titlecase: MS preserved', titleCaseName('MS ALL INDIA CONGRESS COMMITTEE'), 'MS All India Congress Committee');
eq('titlecase: initials', titleCaseName('R. S. MAYAL'), 'R. S. Mayal');
eq('titlecase: dotted pair', titleCaseName('SH. K.S. RANA'), 'Sh. K.S. Rana');
eq('titlecase: dot-joined', titleCaseName('UMESH KR.SHARMA'), 'Umesh Kr.Sharma');
eq('titlecase: alias @', titleCaseName('DAULI @ GANGOTRI'), 'Dauli @ Gangotri');
eq('titlecase: mixed case preserved', titleCaseName('Delhi Jal Board'), 'Delhi Jal Board');
eq('titlecase: honorific', titleCaseName('SMT. NAZMA BEGUM'), 'Smt. Nazma Begum');
eq('date dots', formatDateDots('2026-08-13'), '13.08.2026');
eq('date dots passthrough', formatDateDots('bogus'), 'bogus');
eq('parse list date dashes', parseListDate('13-08-2026'), '2026-08-13');
eq('parse list date dots', parseListDate('5.1.2026'), '2026-01-05');
eq('parse list date invalid', parseListDate('45-08-2026'), null);
eq('entities decode', decodeXmlEntities('A &amp; B &lt;x&gt; &#65;'), 'A & B <x> A');

// ---------------------------------------------------------------------------
// docread: docx + odt round trip through real zip files

const docxBytes = buildFixtureDocx();
const readDocx = readDocumentParagraphs(docxBytes);
eq('docread: docx kind', readDocx.kind, 'docx');
eq('docread: docx paragraph count', readDocx.paragraphs.length, CAUSE_LINES.length);
eq('docread: docx text intact', readDocx.paragraphs[7], CAUSE_LINES[7]);

const odtBytes = buildFixtureOdt();
const readOdt = readDocumentParagraphs(odtBytes);
eq('docread: odt kind', readOdt.kind, 'odt');
eq('docread: odt paragraphs match', readOdt.paragraphs, readDocx.paragraphs);

let threw = null;
try { readDocumentParagraphs(new TextEncoder().encode('plain text, not a zip')); } catch (e) { threw = e.message; }
check('docread: non-zip rejected with friendly error', threw && threw.includes('.docx or .odt'));

// ---------------------------------------------------------------------------
// causelist parsing

const parsed = parseCauseList(readDocx.paragraphs);
eq('parse: 39 cases', parsed.cases.length, 39);
eq('parse: declared total', parsed.header.totalDeclared, 39);
check('parse: no count-mismatch warning', !parsed.warnings.some((w) => w.includes('declares')));
check('parse: no serial-gap warnings', !parsed.warnings.some((w) => w.includes('jump')), parsed.warnings.join(' | '));
eq('parse: date extracted', parsed.header.date, '2026-08-13');
eq('parse: judge from header', parsed.header.judge, 'Sh. Neeraj Gaur');
eq('parse: designation line', parsed.header.designation, 'Presiding Officer - Labour Court');
check('parse: court header kept', parsed.header.rawLines.includes('POLC and POIT, Rouse Avenue, New Delhi'));

const c1 = parsed.cases[0];
eq('case 1: serial', c1.serial, 1);
eq('case 1: id', c1.caseId, 'L I R 2365/21');
eq('case 1: title', c1.title, 'Roshan Lal Vs. M/S Sabda Exports');
eq('case 1: stage', c1.stage, 'Misc. cases');

const c7 = parsed.cases[6];
eq('case 7: wrapped title joined', c7.title, 'Jawahar Singh Alias Jawahar Singh Rathore Vs. M/S Tata Power Delhi Distribution Ltd');

const c8 = parsed.cases[7];
eq('case 8: wrap after respondent', c8.title, 'Kirpa Shankar Vs. M/S Guru Teg Bahadur Public School');

const c16 = parsed.cases[15];
eq('case 16: old + new case no kept', c16.caseId, 'LC 413/2014 1555/16');
eq('case 16: stage', c16.stage, 'Final Arguments');

const c22 = parsed.cases[21];
check('case 22: source typo preserved', c22.title.includes('Ciommittee'));

const c29 = parsed.cases[28];
eq('case 29: ID-prefixed number', c29.caseId, 'L I R ID342/2015 651/16');
eq('case 29: title', c29.title, 'Umesh Kr.Sharma Vs. Fiit Jee Ltd.');

const c31 = parsed.cases[30];
eq('case 31: mixed-case respondent', c31.title, 'Anil Kumar Vs. Delhi Jal Board');

eq('parse: stages found', parsed.stages, ['Misc. cases', 'Plaintiff/Petitioner Evidence', 'Defendant/Respondent Evidence', 'Final Arguments']);

// Edge cases
const emptyParse = parseCauseList([]);
eq('parse: empty input -> no cases', emptyParse.cases.length, 0);
const declMismatch = parseCauseList(['CIVIL CAUSE LIST DATED 13-08-2026 Total Cases:5', '1 L I R 1/20 A RAM Vs. B CORP']);
check('parse: count mismatch warned', declMismatch.warnings.some((w) => w.includes('declares 5')));
const noVs = parseCauseList(['CAUSE LIST DATED 01-01-2026 Total Cases:1', '1 L I R 5/20 SOME BROKEN LINE']);
check('parse: entry without Vs. kept + warned', noVs.cases.length === 1 && noVs.warnings.some((w) => w.includes('no "Vs."')));
const gap = parseCauseList(['CAUSE LIST DATED 01-01-2026 Total Cases:2', '1 L I R 1/20 A LAL Vs. B CORP', '3 L I R 2/20 C LAL Vs. D CORP']);
check('parse: serial gap warned', gap.warnings.some((w) => w.includes('jump from 1 to 3')));

// ---------------------------------------------------------------------------
// sheets

const opts = createDefaultOptions();
opts.causeListDate = parsed.header.date;
const sheets = buildSheets(parsed.cases, opts);
eq('sheets: one per case', sheets.length, 39);

const s1 = sheets[0];
const texts = s1.paragraphs.map((p) => p.text);
eq('sheet 1: first line is case id', texts[0], 'L I R 2365/21');
eq('sheet 1: second line is title', texts[1], 'Roshan Lal Vs. M/S Sabda Exports');
check('sheet 1: date present', texts.includes('13.08.2026'));
check('sheet 1: Present line has space before colon + tab after', texts.includes('Present :\t'));
const stamp = s1.paragraphs.slice(-4);
eq('stamp: name line', stamp[0].text, '(Neeraj Gaur)');
eq('stamp: designation', stamp[1].text, 'Presiding Officer Labour Court-01');
eq('stamp: court + location', stamp[2].text, 'RADC, New Delhi');
eq('stamp: date line', stamp[3].text, '13.08.2026');
check('stamp: right aligned', stamp.every((p) => p.align === 'right'));
check('stamp: bold by default', stamp.every((p) => p.bold));
check('sheet 1: no page break on first', !s1.paragraphs[0].breakBefore);
check('sheet 2: page break before', sheets[1].paragraphs[0].breakBefore);
check('date line bold by default', s1.paragraphs.find((p) => p.text === '13.08.2026' && p.align === 'left').bold);
check('case details not bold by default', !s1.paragraphs[0].bold);
check('case details left by default', s1.paragraphs[0].align === 'left');

// Option effects
const optsRight = { ...opts, rightAlignCaseDetails: true, boldCaseDetails: true, includeIndices: true };
const sr = buildSheets(parsed.cases, optsRight)[0];
eq('opt: index prefix', sr.paragraphs[0].text, '1. L I R 2365/21');
check('opt: case details right + bold', sr.paragraphs[0].align === 'right' && sr.paragraphs[0].bold && sr.paragraphs[1].align === 'right');

const optsOffset = { ...opts, stampAlignment: 'offset' };
const so = buildSheets(parsed.cases, optsOffset)[0].paragraphs.slice(-4);
eq('opt: offset trailing spaces', so.map((p) => p.trailing), [12, 4, 2, 2]);

const optsSteno = { ...opts, stenoInitials: true, stenoInitialsText: 'NG' };
eq('opt: steno initials appended', buildStampLines(optsSteno)[3], '13.08.2026/NG');
const optsStenoOffButText = { ...opts, stenoInitials: false, stenoInitialsText: 'NG' };
eq('opt: steno off ignores text', buildStampLines(optsStenoOffButText)[3], '13.08.2026');

const optsNoBold = { ...opts, boldDate: false, boldStamp: false };
const snb = buildSheets(parsed.cases, optsNoBold)[0];
check('opt: bold toggles off', !snb.paragraphs.find((p) => p.text === '13.08.2026' && p.align === 'left').bold
  && snb.paragraphs.slice(-4).every((p) => !p.bold));

const optsSpacing = { ...opts, appearanceSpacing: '1.5', bodySpacing: '2.0' };
const ss = buildSheets(parsed.cases, optsSpacing)[0];
check('opt: appearance spacing applied', ss.paragraphs.find((p) => p.text === 'Present :\t').spacing === '1.5');
check('opt: body spacing applied to order space', ss.paragraphs.some((p) => p.text === '' && p.spacing === '2.0'));

// Location duplication guard
const optsDupLoc = { ...opts, courtName: 'RADC, New Delhi' };
eq('stamp: location not duplicated', buildStampLines(optsDupLoc)[2], 'RADC, New Delhi');

// ---------------------------------------------------------------------------
// docx generation

const docXml = generateDocxXml(sheets);
check('docx: 38 page breaks for 39 sheets', (docXml.match(/<w:pageBreakBefore\/>/g) || []).length === 38);
check('docx: Times New Roman', docXml.includes('w:ascii="Times New Roman"'));
check('docx: 14pt (28 half-points)', docXml.includes('<w:sz w:val="28"/>'));
check('docx: right alignment used', docXml.includes('<w:jc w:val="right"/>'));
check('docx: A4 + margins', docXml.includes('w:w="11906"') && docXml.includes('w:h="16838"') && docXml.includes('w:left="2268"') && docXml.includes('w:top="1417"'));
check('docx: stamp text present', docXml.includes('(Neeraj Gaur)') && docXml.includes('RADC, New Delhi'));
check('docx: first case text present', docXml.includes('Roshan Lal Vs. M/S Sabda Exports'));
check('docx: last case text present', docXml.includes('Kalawati Koli Vs. M/S Action India'));

const docxOut = generateDocx(sheets);
const docxUnzipped = unzipSync(docxOut);
check('docx: zip has required parts', !!docxUnzipped['[Content_Types].xml'] && !!docxUnzipped['_rels/.rels'] && !!docxUnzipped['word/document.xml']);
check('docx: round-trips through our own reader', readDocumentParagraphs(docxOut).paragraphs.join('\n').includes('Roshan Lal Vs. M/S Sabda Exports'));

// XML escaping safety
const evil = buildSheets([{ serial: 1, caseId: 'L I R 1/20', title: 'A <B> & "C" Vs. D', stage: '' }], opts);
const evilXml = generateDocxXml(evil);
check('docx: xml special chars escaped', evilXml.includes('A &lt;B&gt; &amp; &quot;C&quot; Vs. D') && !evilXml.includes('<B>'));

// odt generation
const odtContent = generateOdtContentXml(sheets);
check('odt: page-break styles for later sheets', odtContent.includes('fo:break-before="page"'));
check('odt: right alignment', odtContent.includes('fo:text-align="end"'));
check('odt: bold styles', odtContent.includes('fo:font-weight="bold"'));
check('odt: font + size', odtContent.includes(`fo:font-size="14pt"`) && odtContent.includes('Times New Roman'));
check('odt: stamp text present', odtContent.includes('(Neeraj Gaur)'));
const odtOffset = generateOdtContentXml(buildSheets(parsed.cases, optsOffset));
check('odt: trailing spaces via text:s', odtOffset.includes('<text:s text:c="12"/>'));

const odtOut = generateOdt(sheets);
const odtUnzipped = unzipSync(odtOut);
check('odt: zip has required parts', !!odtUnzipped['mimetype'] && !!odtUnzipped['content.xml'] && !!odtUnzipped['styles.xml'] && !!odtUnzipped['META-INF/manifest.xml']);
eq('odt: mimetype content', strFromU8(odtUnzipped['mimetype']), 'application/vnd.oasis.opendocument.text');
check('odt: mimetype stored uncompressed', strFromU8(odtOut.slice(0, 200)).includes('mimetypeapplication/vnd.oasis.opendocument.text'));
check('odt: styles.xml has margins', strFromU8(odtUnzipped['styles.xml']).includes('fo:margin-left="4cm"'));
check('odt: round-trips through our own reader', readDocumentParagraphs(odtOut).paragraphs.join('\n').includes('Roshan Lal Vs. M/S Sabda Exports'));

// Determinism
check('repeat: docx deterministic xml', generateDocxXml(sheets) === docXml);
check('repeat: parse deterministic', JSON.stringify(parseCauseList(readDocx.paragraphs)) === JSON.stringify(parsed));

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
