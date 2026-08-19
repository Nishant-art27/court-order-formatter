// CNR lookup: parse the optional court "case status" table export
// (cnr.docx / cnr.odt) into a case-number -> CNR map, and attach CNRs to
// parsed cause-list cases.
//
// The table export lists each case as separate cell paragraphs, e.g.:
//   1
//   L I R/651/2016
//   DLCT130007092015          <- the 16-character CNR
//   UMESH KR.SHARMA ...
// while the cause list spells the same case "L I R ID342/2015 651/16".
// Both spellings normalize to the same key: TYPE|number|year4.

// A CNR is 16 characters: 4-letter court code + 12 digits (DLCT130007092015).
const CNR_RE = /\b([A-Z]{4}\d{12})\b/;
// A paragraph that IS a case-number cell: letters, then number/year, nothing else.
const KEY_PARA_RE = /^[A-Za-z][A-Za-z\s./-]*\d+\s*\/\s*\d{2,4}$/;

// Normalize any case-number spelling to "TYPE|number|year4":
//   "L I R 2365/21"           -> "LIR|2365|2021"
//   "L I R/651/2016"          -> "LIR|651|2016"
//   "L I R ID342/2015 651/16" -> "LIR|651|2016"  (old case no. is skipped —
//                                the LAST number/year token is the live one)
export function caseKey(text) {
  const s = String(text || '').toUpperCase();
  const numRe = /([A-Z]{0,4})(\d+)\s*\/\s*(\d{2,4})/g;
  let first = null;
  let last = null;
  let m;
  while ((m = numRe.exec(s))) {
    if (!first) first = m;
    last = m;
  }
  if (!last) return '';
  const type = s.slice(0, first.index).replace(/[^A-Z]/g, '');
  if (!type) return '';
  const yr = +last[3];
  const year = last[3].length === 4 ? yr : (yr <= 49 ? 2000 + yr : 1900 + yr);
  return `${type}|${+last[2]}|${year}`;
}

// paragraphs: string[] from readDocumentParagraphs on the lookup file.
// Returns { map: Map<key, cnr>, count, warnings }.
export function parseCnrLookup(paragraphs) {
  const map = new Map();
  const warnings = [];
  let lastKey = '';
  for (const raw of paragraphs) {
    const line = String(raw).replace(/\s+/g, ' ').trim();
    if (!line) continue;

    const cnrMatch = line.toUpperCase().match(CNR_RE);
    if (cnrMatch) {
      // Case number and CNR usually sit in adjacent cell paragraphs, but a
      // single merged paragraph ("L I R/651/2016 DLCT...") also works.
      const key = caseKey(line.toUpperCase().replace(CNR_RE, ' ')) || lastKey;
      if (key && !map.has(key)) map.set(key, cnrMatch[1]);
      else if (!key) warnings.push(`CNR ${cnrMatch[1]} had no case number next to it and was skipped.`);
      lastKey = '';
      continue;
    }
    if (KEY_PARA_RE.test(line)) {
      const key = caseKey(line);
      if (key) lastKey = key;
    }
  }
  if (!map.size) {
    warnings.push('No CNR numbers were found in this file. Expected a case-status table with 16-character CNR numbers like DLCT130007092015.');
  }
  return { map, count: map.size, warnings };
}

// Returns { cases: copies with a .cnr field, matched: how many got one }.
export function attachCnrs(cases, map) {
  let matched = 0;
  const out = cases.map((c) => {
    const cnr = (map && map.get(caseKey(c.caseId))) || '';
    if (cnr) matched++;
    return { ...c, cnr };
  });
  return { cases: out, matched };
}
