// Cause-list parser: plain-text paragraphs -> structured header + case list.
//
// Expected shape (from real Labour Court cause lists):
//   POLC and POIT, Rouse Avenue, New Delhi
//   IN THE COURT OF Sh. Neeraj Gaur
//   Presiding Officer - Labour Court
//   CIVIL CAUSE LIST DATED 13-08-2026 Total Cases:39
//   S.No. Case Type Old Case No. Case No. Title
//   1/1
//   Misc. cases                       <- stage header
//   1 L I R 2365/21 ROSHAN LAL Vs. M/S SABDA EXPORTS
//   7 L I R 17/26 JAWAHAR SINGH ... Vs. M/S      <- wrapped titles are
//   TATA POWER DELHI DISTRIBUTION LTD            <- joined automatically
//
// Nothing is silently dropped: unrecognized lines produce warnings.

import { titleCaseName, parseListDate } from './format.js';

const PAGE_MARKER_RE = /^\d+\s*\/\s*\d+$/;
const COLUMN_HEADER_RE = /^S\.?\s*No\.?\s+Case\s+Type/i;
const LIST_TITLE_RE = /CAUSE\s+LIST\s+DATED/i;
const COURT_OF_RE = /^IN\s+THE\s+COURT\s+OF\s+(.+)$/i;
const CASE_START_RE = /^(\d{1,4})\s+(\S.*)$/;
// A case-number token: optional letter prefix + digits "/" digits  (2365/21, ID342/2015)
const CASE_NO_TOKEN_RE = /^[A-Za-z]{0,4}\d+\/\d+$/;
const VS_SPLIT_RE = /\s+V[sS]\.?\s+/;

function isAllCaps(line) {
  return /[A-Z]/.test(line) && !/[a-z]/.test(line);
}

function finalizeCase(pending, warnings) {
  const full = pending.lines.join(' ').replace(/\s+/g, ' ').trim();
  const vsMatch = full.match(VS_SPLIT_RE);
  if (!vsMatch) {
    warnings.push(`Entry ${pending.serial}: no "Vs." found — kept as-is: "${full}"`);
    return { serial: pending.serial, caseId: '', title: full, stage: pending.stage, raw: `${pending.serial} ${full}` };
  }
  const splitIdx = full.search(VS_SPLIT_RE);
  const left = full.slice(0, splitIdx).trim();
  const right = full.slice(splitIdx + vsMatch[0].length).trim();

  const tokens = left.split(/\s+/);
  const numIdxs = tokens
    .map((t, i) => (CASE_NO_TOKEN_RE.test(t) ? i : -1))
    .filter((i) => i !== -1);

  let caseId = '';
  let partyA = left;
  if (numIdxs.length) {
    const lastNum = numIdxs[numIdxs.length - 1];
    caseId = tokens.slice(0, lastNum + 1).join(' ');
    partyA = tokens.slice(lastNum + 1).join(' ');
  } else {
    warnings.push(`Entry ${pending.serial}: no case number recognized in "${left}" — the whole text was treated as the party name.`);
  }
  if (!partyA.trim()) {
    warnings.push(`Entry ${pending.serial}: no first-party name found before "Vs.".`);
  }

  return {
    serial: pending.serial,
    caseId,
    title: `${titleCaseName(partyA)} Vs. ${titleCaseName(right)}`.trim(),
    stage: pending.stage,
    raw: `${pending.serial} ${full}`,
  };
}

export function parseCauseList(paragraphs) {
  const header = {
    rawLines: [],
    judge: '',
    designation: '',
    listTitleLine: '',
    date: null,
    dateRaw: '',
    totalDeclared: null,
  };
  const cases = [];
  const warnings = [];
  const stages = [];
  let currentStage = '';
  let pending = null;
  let sawListTitle = false;

  const flush = () => {
    if (pending) {
      cases.push(finalizeCase(pending, warnings));
      pending = null;
    }
  };

  for (const raw of paragraphs) {
    const line = String(raw).replace(/\s+/g, ' ').trim();
    if (!line) continue;

    if (PAGE_MARKER_RE.test(line) || COLUMN_HEADER_RE.test(line)) continue;

    if (LIST_TITLE_RE.test(line)) {
      // Repeated on every page of some exports — only record the first.
      if (!sawListTitle) {
        sawListTitle = true;
        header.listTitleLine = line;
        const dateMatch = line.match(/DATED[\s:]*([\d.\-/]+)/i);
        if (dateMatch) {
          header.dateRaw = dateMatch[1];
          header.date = parseListDate(dateMatch[1]);
          if (!header.date) warnings.push(`The list date "${dateMatch[1]}" could not be read — please pick the date manually.`);
        } else {
          warnings.push('No date was found in the cause list heading — please pick the date manually.');
        }
        const totalMatch = line.match(/Total\s*Cases?\s*:?\s*(\d+)/i);
        if (totalMatch) header.totalDeclared = +totalMatch[1];
      }
      continue;
    }

    const courtOf = line.match(COURT_OF_RE);
    if (courtOf) {
      if (!header.judge) header.judge = courtOf[1].trim();
      continue;
    }

    const caseStart = line.match(CASE_START_RE);
    if (caseStart) {
      // A new numbered entry always terminates the previous one.
      flush();
      pending = { serial: +caseStart[1], lines: [caseStart[2]], stage: currentStage };
      continue;
    }

    if (pending && isAllCaps(line)) {
      // Wrapped continuation of the previous entry's title.
      pending.lines.push(line);
      continue;
    }

    if (!sawListTitle && cases.length === 0 && !pending) {
      // Everything above the CAUSE LIST heading is court header info.
      header.rawLines.push(line);
      if (!header.designation && /officer|judge|magistrate|adj|court/i.test(line) && !/court of/i.test(line)) {
        header.designation = line;
      }
      continue;
    }

    // Mixed-case line between entries -> a stage header (e.g. "Final Arguments").
    flush();
    currentStage = line;
    if (!stages.includes(line)) stages.push(line);
  }
  flush();

  // Sanity checks -> warnings, never silent.
  if (header.totalDeclared !== null && header.totalDeclared !== cases.length) {
    warnings.push(`The cause list declares ${header.totalDeclared} cases but ${cases.length} were parsed — please verify the case list below.`);
  }
  for (let i = 1; i < cases.length; i++) {
    if (cases[i].serial !== cases[i - 1].serial + 1) {
      warnings.push(`Serial numbers jump from ${cases[i - 1].serial} to ${cases[i].serial} — a line may be missing or misread.`);
    }
  }

  return { header, cases, stages, warnings };
}
