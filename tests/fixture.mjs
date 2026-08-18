// Test fixture: the cause list from the reference screenshot, reproduced
// line-for-line (including the source's own quirks, e.g. "CIOMMITTEE" in
// entry 22), plus builders that wrap it into real .docx / .odt files.

import { zipSync, strToU8 } from '../js/vendor/fflate.js';

export const CAUSE_LINES = [
  'POLC and POIT, Rouse Avenue, New Delhi',
  'IN THE COURT OF Sh. Neeraj Gaur',
  'Presiding Officer - Labour Court',
  'CIVIL CAUSE LIST DATED 13-08-2026 Total Cases:39',
  'S.No. Case Type Old Case No. Case No. Title',
  '1/1',
  'Misc. cases',
  '1 L I R 2365/21 ROSHAN LAL Vs. M/S SABDA EXPORTS',
  '2 L I R 2366/21 BRIJESH KUMAR Vs. M/S SABDA EXPORTS',
  '3 L I R 2367/21 SURENDER KUMAR Vs. M/S SABDA EXPORTS',
  '4 L I R 2368/21 PARSHU RAM YADAV Vs. M/S SABDA EXPORTS',
  '5 L I R 1017/25 BABU RAM Vs. M/S SUPERWEAR',
  '6 L I R 1018/25 RAMAN KUMAR JHA Vs. M/S SUPERWEAR',
  '7 L I R 17/26 JAWAHAR SINGH ALIAS JAWAHAR SINGH RATHORE Vs. M/S',
  'TATA POWER DELHI DISTRIBUTION LTD',
  '8 L I R 25/26 KIRPA SHANKAR Vs. M/S GURU TEG BAHADUR PUBLIC',
  'SCHOOL',
  'Plaintiff/Petitioner Evidence',
  '9 LC 123/17 ASHISH Vs. M/S DIOCESE OF DELHI THE CHURCH OF NORTH',
  'INDIA',
  '10 L I R 1793/18 VIRENDER SHUKLA Vs. M/S ANNAPOORNA INDUSTRIAL',
  'CORPORATION',
  '11 L I R 1936/18 MOHD RIYAZ Vs. M/S P AND G ENTERPRISES PVT LTD',
  'Defendant/Respondent Evidence',
  '12 L I R 1094/23 SONI Vs. M/S BRILLIANT LED PVT LTD',
  '13 L I R 1097/23 USHA Vs. M/S BRILLIANT LED PVT LTD',
  '14 L I R 1099/23 DURGA WATI DEVI Vs. M/S BRILLIANT LED PVT LTD',
  '15 L I R 1101/23 DAULI @ GANGOTRI Vs. M/S BRILLIANT LED PVT LTD',
  'Final Arguments',
  '16 LC 413/2014 1555/16 WAHED AHMED Vs. MS ALL INDIA CONGRESS COMMITTEE',
  '17 LC 414/2014 1556/16 SUNDER LAL DEVERADA Vs. MS ALL INDIA CONGRESS',
  'COMMITTEE',
  '18 LC 416/2014 1888/16 TILAK RAJ Vs. MS ALL INDIA CONGRESS COMMITTEE',
  '19 LC 417/2014 2006/16 SUNIL KUMAR Vs. MS ALL INDIA CONGRESS COMMITTEE',
  '20 LC 418/2014 2007/16 PURUSHOTTAM Vs. MS ALL INDIA CONGRESS COMMITTEE',
  '21 LC 419/2014 2008/16 VIRENDER PODDAR Vs. MS ALL INDIA CONGRESS',
  'COMMITTEE',
  '22 LC 420/2014 2009/16 R. S. MAYAL Vs. MS ALL INDIA CONGRESS CIOMMITTEE',
  '23 LC 421/2014 2010/16 SH. KAUSHELENDER SINGH Vs. MS ALL INDIA CONGRESS',
  'COMMITTEE',
  '24 LC 424/2014 2013/16 RAM AVATAR Vs. MS ALL INDIA CONGRESS COMMITTEE',
  '25 LC 425/2014 2014/16 HARENDRA KUMAR SHARMA Vs. MS ALL INDIA CONGRESS',
  'COMMITTEE',
  '26 LC 44/2015 2178/16 SMT. NAZMA BEGUM Vs. MS ALL INDIA CONGRESS',
  'COMMITTEE',
  '27 LC 45/2015 2179/16 SH. PREM KUMAR Vs. MS ALL INDIA CONGRESS COMMITTEE',
  '28 LC 46/2015 2180/16 SH. K.S. RANA Vs. MS ALL INDIA CONGRESS COMMITTEE',
  '29 L I R ID342/2015 651/16 UMESH KR.SHARMA Vs. FIIT JEE LTD.',
  '30 L I R 7542/16 SHAMSHEER ALAM Vs. DIRECTORATE OF GURUDWARA',
  'ELECTION',
  '31 L I R 9402/16 ANIL KUMAR Vs. Delhi Jal Board',
  '32 L I R 9403/16 PARSA RAM Vs. Delhi Jal Board',
  '33 L I R 9405/16 SMT. MANJEET KAUR Vs. Delhi Jal Board',
  '34 L I R 9406/16 VED PRAKASH Vs. Delhi Jal Board',
  '35 L I R 9408/16 MOHAN Vs. Delhi Jal Board',
  '36 L I R 9409/16 BALDEV Vs. Delhi Jal Board',
  '37 L I R 9410/16 JEET RAM Vs. Delhi Jal Board',
  '38 L I R 9609/16 SANJAY PRASAD SINGH Vs. M/S LOTUS HERBALS PVT. LTD.',
  '39 L I R 316/20 KALAWATI KOLI Vs. M/S ACTION INDIA',
];

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildFixtureDocx(lines = CAUSE_LINES) {
  const paras = lines.map((l) => `<w:p><w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`).join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}</w:body></w:document>`;
  return zipSync({
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    'word/document.xml': strToU8(doc),
  });
}

export function buildFixtureOdt(lines = CAUSE_LINES) {
  const paras = lines.map((l) => `<text:p>${esc(l)}</text:p>`).join('');
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text>${paras}</office:text></office:body></office:document-content>`;
  return zipSync({
    mimetype: [strToU8('application/vnd.oasis.opendocument.text'), { level: 0 }],
    'content.xml': strToU8(content),
  });
}
