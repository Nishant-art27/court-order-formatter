// Order-sheet builder: parsed cases + options -> one sheet model per case.
// A sheet is a flat list of paragraph specs consumed identically by the
// docx generator, the odt generator, and the HTML preview — so all three
// outputs can never disagree.
//
// Sheet layout (mirrors the real order sheets):
//   L I R 2365/21                       <- case id      (left or right aligned)
//   Roshan Lal Vs. M/S Sabda Exports    <- title
//
//   13.08.2026                          <- cause list date (bold optional)
//
//   Present:                            <- appearance block
//   [blank appearance lines]
//   [blank order-text lines]            <- space where the order is written
//                              (Neeraj Gaur)                 <- classic stamp,
//                              Presiding Officer Labour Court-01   right side
//                              RADC, New Delhi
//                              13.08.2026

import {
  ORDER_SPACE_LINES, APPEARANCE_BLANK_LINES, STAMP_OFFSET_TRAILING,
} from './config.js';
import { formatDateDots } from './format.js';

function para(text, { bold = false, align = 'left', spacing = '1.0', trailing = 0, breakBefore = false } = {}) {
  return { text, bold, align, spacing, trailing, breakBefore };
}

export function buildStampLines(options) {
  const name = options.judgeName.trim();
  const designation = options.judgeDesignation.trim();
  const court = options.courtName.trim();
  const location = options.stampLocation.trim();

  let courtLine = court;
  if (location && !court.toLowerCase().includes(location.toLowerCase())) {
    courtLine = court ? `${court}, ${location}` : location;
  }

  let dateLine = formatDateDots(options.causeListDate);
  if (options.stenoInitials && options.stenoInitialsText.trim()) {
    dateLine += `/${options.stenoInitialsText.trim()}`;
  }

  return [name ? `(${name})` : '', designation, courtLine, dateLine].map((l) => l || '');
}

export function buildSheet(caseEntry, options, isFirst) {
  const paragraphs = [];
  const caseAlign = options.rightAlignCaseDetails ? 'right' : 'left';

  const caseIdText = `${options.includeIndices ? `${caseEntry.serial}. ` : ''}${caseEntry.caseId}`.trim();
  paragraphs.push(para(caseIdText, {
    bold: options.boldCaseDetails, align: caseAlign, breakBefore: !isFirst,
  }));
  paragraphs.push(para(caseEntry.title, { bold: options.boldCaseDetails, align: caseAlign }));
  paragraphs.push(para(''));

  paragraphs.push(para(formatDateDots(options.causeListDate), { bold: options.boldDate }));
  paragraphs.push(para(''));

  paragraphs.push(para('Present:', { spacing: options.appearanceSpacing }));
  for (let i = 0; i < APPEARANCE_BLANK_LINES; i++) {
    paragraphs.push(para('', { spacing: options.appearanceSpacing }));
  }

  for (let i = 0; i < ORDER_SPACE_LINES; i++) {
    paragraphs.push(para('', { spacing: options.bodySpacing }));
  }

  const stampLines = buildStampLines(options);
  const offsets = options.stampAlignment === 'offset' ? STAMP_OFFSET_TRAILING : [0, 0, 0, 0];
  stampLines.forEach((line, i) => {
    paragraphs.push(para(line, {
      bold: options.boldStamp, align: 'right', trailing: offsets[i] || 0,
    }));
  });

  return {
    serial: caseEntry.serial,
    caseId: caseEntry.caseId,
    title: caseEntry.title,
    stage: caseEntry.stage,
    paragraphs,
  };
}

export function buildSheets(cases, options) {
  return cases.map((c, i) => buildSheet(c, options, i === 0));
}
