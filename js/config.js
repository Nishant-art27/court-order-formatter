// Central configuration: defaults, constants, external links.

// Link to the companion PDF splitter tool (shown in the sidebar card).
export const PDF_SPLITTER_URL = 'https://court-pdf-splitter.netlify.app/';

export const DEFAULT_JUDGE_PROFILE = {
  name: 'Neeraj Gaur',
  designation: 'Presiding Officer Labour Court-01',
  court: 'RADC',
};

export const STAMP_LOCATIONS = ['New Delhi', 'Delhi', 'Haryana', 'Punjab'];

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// Number of blank lines left between "Present :" and the judge stamp for the
// order text to be written/typed later.
export const ORDER_SPACE_LINES = 4;
// Blank lines reserved right after "Present :" for the counsel appearance block.
export const APPEARANCE_BLANK_LINES = 2;

// Trailing spaces per stamp line for the "Offset Right (12/4/2/2)" alignment.
export const STAMP_OFFSET_TRAILING = [12, 4, 2, 2];

// Page geometry (A4) — mirrors the "Page Formatting Rules" card.
export const PAGE = {
  widthCm: 21,
  heightCm: 29.7,
  marginLeftCm: 4,
  marginRightCm: 4,
  marginTopCm: 2.5,
  marginBottomCm: 2.5,
  fontFamily: 'Times New Roman',
  fontSizePt: 14,
};

export function createDefaultOptions() {
  return {
    rightAlignCaseDetails: false,
    judgeName: DEFAULT_JUDGE_PROFILE.name,
    judgeDesignation: DEFAULT_JUDGE_PROFILE.designation,
    courtName: DEFAULT_JUDGE_PROFILE.court,
    stampLocation: 'New Delhi',
    boldCaseDetails: false,
    boldDate: true,
    boldStamp: true,
    appearanceSpacing: '1.0',   // 1.0 | 1.5 | 2.0
    bodySpacing: '1.0',         // 1.0 | 1.5 | 2.0
    stampAlignment: 'perfect',  // perfect | offset
    stenoInitials: false,
    stenoInitialsText: '',
    causeListDate: '',          // ISO yyyy-mm-dd (auto-filled from the file)
    includeIndices: false,
  };
}
