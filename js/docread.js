// Read .docx / .odt files (both are zip archives of XML) and extract the
// plain-text paragraphs. Regex-based XML extraction so it runs identically
// in the browser and in Node (no DOMParser dependency).

import { unzipSync, strFromU8 } from './vendor/fflate.js';
import { decodeXmlEntities } from './format.js';

function docxParagraphs(xml) {
  const paragraphs = [];
  const pRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let m;
  while ((m = pRe.exec(xml))) {
    let block = m[0];
    block = block.replace(/<w:tab\b[^>]*\/>/g, ' ').replace(/<w:br\b[^>]*\/>/g, ' ');
    const parts = [];
    const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    let t;
    while ((t = tRe.exec(block))) parts.push(decodeXmlEntities(t[1]));
    paragraphs.push(parts.join(''));
  }
  return paragraphs;
}

function odtParagraphs(xml) {
  const paragraphs = [];
  const pRe = /<text:(?:p|h)\b[^>]*>[\s\S]*?<\/text:(?:p|h)>/g;
  let m;
  while ((m = pRe.exec(xml))) {
    let block = m[0];
    block = block
      .replace(/<text:s\b[^>]*text:c="(\d+)"[^>]*\/>/g, (_, n) => ' '.repeat(+n))
      .replace(/<text:s\b[^>]*\/>/g, ' ')
      .replace(/<text:tab\b[^>]*\/>/g, ' ')
      .replace(/<text:line-break\b[^>]*\/>/g, ' ')
      .replace(/<[^>]+>/g, '');
    paragraphs.push(decodeXmlEntities(block));
  }
  return paragraphs;
}

// bytes: Uint8Array of the uploaded file. Returns { kind: 'docx'|'odt',
// paragraphs: string[] }. Throws Error with a user-readable message.
export function readDocumentParagraphs(bytes) {
  let files;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('This file could not be opened. It does not appear to be a valid .docx or .odt document.');
  }

  if (files['word/document.xml']) {
    return { kind: 'docx', paragraphs: docxParagraphs(strFromU8(files['word/document.xml'])) };
  }
  if (files['content.xml']) {
    return { kind: 'odt', paragraphs: odtParagraphs(strFromU8(files['content.xml'])) };
  }
  throw new Error('Unsupported file contents — no Word or OpenDocument text found inside. Please upload a .docx or .odt cause list.');
}
