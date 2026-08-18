// Text/date formatting helpers. Pure functions — testable in Node.

// Words kept fully uppercase when title-casing party names.
const KEEP_UPPER = new Set(['M/S', 'MS', 'MS.', 'M/S.', 'FIR', 'PS', 'NCT', 'DTC', 'DDA', 'MCD', 'ESI', 'EPF', 'CBI', 'NIA', 'UT']);

// Convert an ALL-CAPS name to title case while preserving:
// - words that already contain lowercase (assumed intentionally cased),
// - known abbreviations (M/S, MS, …),
// - single-letter initials around ./-/@ separators (K.S. stays K.S.).
export function titleCaseName(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      if (/[a-z]/.test(word)) return word;          // already mixed case
      if (KEEP_UPPER.has(word)) return word;
      return word
        .split(/([./@\-&])/)
        .map((seg) => {
          if (seg.length <= 1) return seg;          // separators + initials
          if (KEEP_UPPER.has(seg)) return seg;
          return seg.charAt(0) + seg.slice(1).toLowerCase();
        })
        .join('');
    })
    .join(' ');
}

// ISO yyyy-mm-dd -> dd.mm.yyyy (the "ODT target format").
export function formatDateDots(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso || '').trim();
  return `${m[3]}.${m[2]}.${m[1]}`;
}

// Parse a date found in a cause list heading ("13-08-2026", "13.08.2026",
// "13/08/2026") into ISO yyyy-mm-dd, or null.
export function parseListDate(raw) {
  const m = String(raw || '').match(/(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
  if (!m) return null;
  const day = +m[1];
  const month = +m[2];
  const year = +m[3];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function decodeXmlEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
