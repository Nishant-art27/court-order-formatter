// Application controller: upload handling, options UI, judge profiles,
// live preview, and file downloads. All processing logic lives in the
// pipeline modules (docread -> causelist -> sheets -> docxgen/odtgen).

import { readDocumentParagraphs } from './docread.js';
import { parseCauseList } from './causelist.js';
import { parseCnrLookup, attachCnrs } from './cnr.js';
import { buildSheets } from './sheets.js';
import { generateDocx } from './docxgen.js';
import { generateOdt } from './odtgen.js';
import { formatDateDots } from './format.js';
import {
  createDefaultOptions, DEFAULT_JUDGE_PROFILE, STAMP_LOCATIONS,
  MAX_FILE_BYTES, PDF_SPLITTER_URL,
} from './config.js';

const PROFILES_KEY = 'of.judgeProfiles';

const state = {
  fileName: '',
  fileKind: '',
  fileSize: 0,
  parsed: null,          // { header, cases, stages, warnings }
  cnr: null,             // { fileName, fileSize, map, count }
  options: createDefaultOptions(),
  previewTab: 'paper',   // paper | cases
};

const $ = (id) => document.getElementById(id);

// Stage colour: the n-th stage in the list gets the n-th tone (5 tones, cycling).
const toneClass = (index) => `tone-${((index % 5) + 5) % 5}`;

// ---------------------------------------------------------------------------
// Toast + errors

let toastTimer = null;
function showToast(message, kind = 'ok') {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.toggle('toast-error', kind === 'error');
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3400);
}

function showUploadError(message) {
  const el = $('upload-error');
  el.textContent = message || '';
  el.hidden = !message;
}

// ---------------------------------------------------------------------------
// Upload

function acceptFile(file) {
  showUploadError('');
  if (!file) return;
  if (!/\.(docx|odt)$/i.test(file.name)) {
    showUploadError(`"${file.name}" is not supported. Please upload a .docx or .odt cause list file.`);
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    showUploadError(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The maximum supported size is 10 MB.`);
    return;
  }
  file.arrayBuffer().then((buf) => {
    try {
      const { kind, paragraphs } = readDocumentParagraphs(new Uint8Array(buf));
      const parsed = parseCauseList(paragraphs);
      if (!parsed.cases.length) {
        showUploadError(`No case entries were found in "${file.name}". Make sure this is a cause list with numbered entries like "1 L I R 2365/21 A Vs. B".`);
        return;
      }
      state.fileName = file.name;
      state.fileKind = kind;
      state.fileSize = file.size;
      state.parsed = parsed;
      if (parsed.header.date) {
        state.options.causeListDate = parsed.header.date;
        $('opt-date').value = parsed.header.date;
      }
      renderFileSummary();
      renderAll();
      showToast(`Parsed ${parsed.cases.length} cases from ${file.name}`);
    } catch (err) {
      showUploadError(err.message);
    }
  }).catch(() => showUploadError(`The file "${file.name}" could not be read.`));
}

function removeFile() {
  state.fileName = '';
  state.fileKind = '';
  state.fileSize = 0;
  state.parsed = null;
  renderFileSummary();
  $('file-input').value = '';
  showUploadError('');
  renderAll();
  showToast('File removed');
}

function renderFileSummary() {
  const p = state.parsed;
  $('file-summary').hidden = !p;
  $('dropzone').hidden = !!p;
  if (!p) return;
  $('fs-name').textContent = state.fileName;
  $('fs-meta').textContent = `${state.fileKind.toUpperCase()} · ${(state.fileSize / 1024).toFixed(0)} KB · ${p.cases.length} case${p.cases.length === 1 ? '' : 's'}`;

  const warnEl = $('parse-warnings');
  if (p.warnings.length) {
    warnEl.innerHTML = '';
    const strong = document.createElement('strong');
    strong.textContent = `${p.warnings.length} note${p.warnings.length === 1 ? '' : 's'}:`;
    const ul = document.createElement('ul');
    for (const w of p.warnings) {
      const li = document.createElement('li');
      li.textContent = w;
      ul.appendChild(li);
    }
    warnEl.append(strong, ul);
    warnEl.hidden = false;
  } else {
    warnEl.hidden = true;
  }
}

// ---------------------------------------------------------------------------
// CNR lookup upload (optional)

function showCnrError(message) {
  const el = $('cnr-error');
  el.textContent = message || '';
  el.hidden = !message;
}

function acceptCnrFile(file) {
  showCnrError('');
  if (!file) return;
  if (!/\.(docx|odt)$/i.test(file.name)) {
    showCnrError(`"${file.name}" is not supported. Please upload a .docx or .odt CNR lookup file.`);
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    showCnrError(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The maximum supported size is 10 MB.`);
    return;
  }
  file.arrayBuffer().then((buf) => {
    try {
      const { paragraphs } = readDocumentParagraphs(new Uint8Array(buf));
      const { map, count, warnings } = parseCnrLookup(paragraphs);
      if (!count) {
        showCnrError(warnings[0]);
        return;
      }
      state.cnr = { fileName: file.name, fileSize: file.size, map, count };
      renderAll();
      showToast(`CNR lookup loaded: ${count} entries from ${file.name}`);
    } catch (err) {
      showCnrError(err.message);
    }
  }).catch(() => showCnrError(`The file "${file.name}" could not be read.`));
}

function removeCnrFile() {
  state.cnr = null;
  $('cnr-file-input').value = '';
  showCnrError('');
  renderAll();
  showToast('CNR lookup removed');
}

function renderCnrSummary() {
  const c = state.cnr;
  $('cnr-summary').hidden = !c;
  $('cnr-dropzone').hidden = !!c;
  if (!c) return;
  $('cnr-name').textContent = c.fileName;
  $('cnr-meta').textContent = `${(c.fileSize / 1024).toFixed(0)} KB · ${c.count} CNR entries`;
  const info = $('cnr-match-info');
  if (state.parsed) {
    const { matched } = attachCnrs(state.parsed.cases, c.map);
    info.textContent = `${matched} of ${state.parsed.cases.length} cases matched — the CNR No. will be printed on those sheets.`;
  } else {
    info.textContent = 'Upload the cause list above to match CNR numbers against it.';
  }
}

// ---------------------------------------------------------------------------
// Judge profiles (localStorage)

function loadProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
function storeProfiles(list) {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
}

function applyProfile(profile) {
  state.options.judgeName = profile.name;
  state.options.judgeDesignation = profile.designation;
  state.options.courtName = profile.court;
  $('opt-judge-name').value = profile.name;
  $('opt-judge-designation').value = profile.designation;
  $('opt-court-name').value = profile.court;
  renderAll();
  showToast(`Loaded profile: ${profile.name}`);
}

function saveCurrentProfile() {
  const profile = {
    name: state.options.judgeName.trim(),
    designation: state.options.judgeDesignation.trim(),
    court: state.options.courtName.trim(),
  };
  if (!profile.name || !profile.designation || !profile.court) {
    showToast('Fill in judge name, designation, and court name before saving', 'error');
    return;
  }
  const profiles = loadProfiles();
  const existing = profiles.findIndex((p) => p.name.toLowerCase() === profile.name.toLowerCase());
  if (existing !== -1) profiles[existing] = profile;
  else profiles.push(profile);
  storeProfiles(profiles);
  renderProfiles();
  showToast(existing !== -1 ? `Profile "${profile.name}" updated` : `Profile "${profile.name}" saved`);
}

function deleteProfile(index) {
  const profiles = loadProfiles();
  const [removed] = profiles.splice(index, 1);
  storeProfiles(profiles);
  renderProfiles();
  showToast(`Profile "${removed.name}" deleted`);
}

function renderProfiles() {
  const wrap = $('profile-list');
  wrap.innerHTML = '';

  const makeChip = (profile, { isDefault = false, index = -1 } = {}) => {
    const chip = document.createElement('span');
    chip.className = `profile-chip${isDefault ? ' is-default' : ''}`;
    const load = document.createElement('button');
    load.type = 'button';
    load.className = 'chip-load';
    load.innerHTML = `${isDefault ? '<svg class="ic"><use href="#i-star"/></svg>' : ''}<span class="chip-name"></span><em class="chip-role"></em>`;
    load.querySelector('.chip-name').textContent = profile.name;
    load.querySelector('.chip-role').textContent = profile.designation;
    load.title = `Load: ${profile.name}, ${profile.designation}, ${profile.court}`;
    load.addEventListener('click', () => applyProfile(profile));
    chip.appendChild(load);
    if (!isDefault) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'chip-del';
      del.innerHTML = '<svg class="ic"><use href="#i-x"/></svg>';
      del.title = 'Delete this profile';
      del.addEventListener('click', () => deleteProfile(index));
      chip.appendChild(del);
    }
    wrap.appendChild(chip);
  };

  makeChip(DEFAULT_JUDGE_PROFILE, { isDefault: true });
  loadProfiles().forEach((p, i) => makeChip(p, { index: i }));
}

// ---------------------------------------------------------------------------
// Stamp location cards

function renderLocations() {
  const row = $('location-row');
  row.innerHTML = '';
  for (const loc of STAMP_LOCATIONS) {
    const btn = document.createElement('button');
    const selected = state.options.stampLocation === loc;
    btn.type = 'button';
    btn.className = `pill${selected ? ' is-selected' : ''}`;
    btn.setAttribute('aria-pressed', String(selected));
    btn.textContent = loc;
    btn.addEventListener('click', () => {
      state.options.stampLocation = loc;
      renderLocations();
      renderAll();
    });
    row.appendChild(btn);
  }
}

// ---------------------------------------------------------------------------
// Preview + generation status

function currentCases() {
  if (!state.parsed) return [];
  if (!state.cnr) return state.parsed.cases;
  return attachCnrs(state.parsed.cases, state.cnr.map).cases;
}

function currentSheets() {
  if (!state.parsed) return [];
  return buildSheets(currentCases(), state.options);
}

function renderPreview() {
  const has = !!state.parsed;
  $('preview-empty').hidden = has;
  $('preview-paper').hidden = !has || state.previewTab !== 'paper';
  $('preview-cases').hidden = !has || state.previewTab !== 'cases';
  $('tab-paper').classList.toggle('is-active', state.previewTab === 'paper');
  $('tab-cases').classList.toggle('is-active', state.previewTab === 'cases');
  const count = $('tab-cases-count');
  count.hidden = !has;
  if (has) count.textContent = String(state.parsed.cases.length);
  if (!has) return;

  if (state.previewTab === 'paper') {
    const wrap = $('preview-paper');
    wrap.innerHTML = '';
    const sheets = currentSheets();
    const count = document.createElement('p');
    count.className = 'preview-count';
    count.textContent = `${sheets.length} order sheet${sheets.length === 1 ? '' : 's'} — one page per case`;
    wrap.appendChild(count);
    for (const sheet of sheets) {
      const label = document.createElement('p');
      label.className = 'sheet-label';
      label.textContent = `Sheet ${sheet.serial}${sheet.stage ? ` · ${sheet.stage}` : ''}`;
      wrap.appendChild(label);
      const page = document.createElement('div');
      page.className = 'sheet';
      for (const p of sheet.paragraphs) {
        const div = document.createElement('div');
        div.className = 'sheet-para'
          + (p.align === 'right' ? ' align-right' : p.align === 'both' ? ' align-justify' : '')
          + (p.bold ? ' bold' : '')
          + (p.spacing === '1.5' ? ' sp-15' : p.spacing === '2.0' ? ' sp-20' : '');
        div.textContent = (p.text || '') + ' '.repeat(p.trailing || 0);
        page.appendChild(div);
      }
      wrap.appendChild(page);
    }
  } else {
    const list = $('cases-list');
    list.innerHTML = '';
    for (const c of currentCases()) {
      const row = document.createElement('div');
      row.className = 'case-row';

      const no = document.createElement('span');
      no.className = 'case-no';
      no.textContent = c.serial;

      const main = document.createElement('div');
      main.className = 'case-main';
      const line = document.createElement('div');
      line.className = 'case-line';
      const id = document.createElement('strong');
      id.className = 'case-id';
      id.textContent = c.caseId || '—';
      line.appendChild(id);
      if (c.stage) {
        const stage = document.createElement('span');
        stage.className = `case-stage ${toneClass(state.parsed.stages.indexOf(c.stage))}`;
        stage.textContent = c.stage;
        stage.title = c.stage;
        line.appendChild(stage);
      }
      const title = document.createElement('div');
      title.className = 'case-title';
      title.textContent = c.title;
      main.append(line, title);
      if (c.cnr) {
        const cnr = document.createElement('div');
        cnr.className = 'case-cnr';
        cnr.textContent = `CNR ${c.cnr}`;
        main.appendChild(cnr);
      }

      row.append(no, main);
      list.appendChild(row);
    }
  }
}

function renderGenerateStatus() {
  const status = $('generate-status');
  const ready = state.parsed && state.parsed.cases.length > 0 && !!state.options.causeListDate;
  $('btn-dl-docx').disabled = !ready;
  $('btn-dl-odt').disabled = !ready;
  const dot = $('status-dot');
  if (!state.parsed) {
    dot.dataset.state = 'empty';
    status.textContent = 'Upload a cause list to get started.';
  } else if (!state.options.causeListDate) {
    dot.dataset.state = 'warn';
    status.textContent = 'Set the cause list date to enable downloads.';
  } else {
    dot.dataset.state = 'ready';
    const n = state.parsed.cases.length;
    let text = `${n} sheet${n === 1 ? '' : 's'} · dated ${formatDateDots(state.options.causeListDate)} · stamp of ${state.options.judgeName.trim() || '—'}`;
    if (state.cnr) {
      const { matched } = attachCnrs(state.parsed.cases, state.cnr.map);
      text += ` · CNR No. on ${matched} of ${n}`;
    }
    status.textContent = text;
  }
}

function renderDateHint() {
  $('odt-format-hint').textContent = state.options.causeListDate
    ? formatDateDots(state.options.causeListDate) : '—';
}

// Parsed-file details in the inspector, with parsed/declared and CNR-match bars.
function renderInfo() {
  const p = state.parsed;
  $('file-info').hidden = !p;
  if (!p) return;
  $('fs-court').textContent = p.header.rawLines.join(' — ') || '—';
  $('fs-judge').textContent = [p.header.judge, p.header.designation].filter(Boolean).join(', ') || '—';
  $('fs-date').textContent = p.header.date ? formatDateDots(p.header.date) : (p.header.dateRaw || 'not found');
  const stagesEl = $('fs-stages');
  stagesEl.innerHTML = '';
  if (p.stages.length) {
    p.stages.forEach((stage, i) => {
      const chip = document.createElement('span');
      chip.className = `stage-chip ${toneClass(i)}`;
      chip.textContent = stage;
      stagesEl.appendChild(chip);
    });
  } else {
    stagesEl.textContent = '—';
  }

  const declared = p.header.totalDeclared;
  const short = declared !== null && p.cases.length < declared;
  $('fs-count').textContent = declared !== null ? `${p.cases.length} of ${declared} declared` : `${p.cases.length} parsed`;
  const countBar = $('fs-count-bar');
  countBar.style.width = `${declared ? Math.min(100, Math.round((p.cases.length / declared) * 100)) : 100}%`;
  countBar.classList.toggle('is-short', short);

  $('fs-cnr-row').hidden = !state.cnr;
  if (state.cnr) {
    const { matched } = attachCnrs(p.cases, state.cnr.map);
    $('fs-cnr').textContent = `${matched} of ${p.cases.length} cases`;
    $('fs-cnr-bar').style.width = `${p.cases.length ? Math.round((matched / p.cases.length) * 100) : 0}%`;
  }
}

// Sidebar captions summarise each section's state at a glance.
function renderNav() {
  const source = $('nav-source-caption');
  if (state.parsed) {
    source.textContent = `${state.parsed.cases.length} cases · ${state.fileName}`;
    source.classList.add('is-good');
  } else {
    source.textContent = 'No file yet';
    source.classList.remove('is-good');
  }

  const judge = $('nav-judge-caption');
  const name = state.options.judgeName.trim();
  const date = state.options.causeListDate;
  if (name && date) {
    judge.textContent = `${name} · ${formatDateDots(date)}`;
    judge.classList.add('is-good');
  } else {
    judge.textContent = !name ? 'Judge name missing' : 'Date not set';
    judge.classList.remove('is-good');
  }
}

function renderAll() {
  renderDateHint();
  renderCnrSummary();
  renderInfo();
  renderNav();
  renderPreview();
  renderGenerateStatus();
}

// ---------------------------------------------------------------------------
// Downloads

function download(bytes, mime, fileName) {
  try {
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast(`Downloaded ${fileName}`);
  } catch (err) {
    showToast(`Download failed: ${err.message}`, 'error');
  }
}

function outputFileName(ext) {
  const date = formatDateDots(state.options.causeListDate);
  return `Order Sheets ${date}.${ext}`;
}

function downloadDocx() {
  try {
    download(generateDocx(currentSheets()),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      outputFileName('docx'));
  } catch (err) {
    showToast(`Could not generate the .docx: ${err.message}`, 'error');
  }
}

function downloadOdt() {
  try {
    download(generateOdt(currentSheets()),
      'application/vnd.oasis.opendocument.text',
      outputFileName('odt'));
  } catch (err) {
    showToast(`Could not generate the .odt: ${err.message}`, 'error');
  }
}

// ---------------------------------------------------------------------------
// Wiring

function bindText(id, key) {
  const el = $(id);
  el.value = state.options[key];
  el.addEventListener('input', () => {
    state.options[key] = el.value;
    renderAll();
  });
}

function bindToggle(id, key) {
  const el = $(id);
  el.checked = state.options[key];
  el.addEventListener('change', () => {
    state.options[key] = el.checked;
    if (id === 'opt-steno') $('steno-initials-field').hidden = !el.checked;
    renderAll();
  });
}

function bindSegmented(containerId) {
  const container = $(containerId);
  const key = container.dataset.opt;
  container.querySelectorAll('button').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.value === state.options[key]);
    btn.addEventListener('click', () => {
      state.options[key] = btn.dataset.value;
      container.querySelectorAll('button').forEach((b) => b.classList.toggle('is-selected', b === btn));
      renderAll();
    });
  });
}

function initNav() {
  const items = [...document.querySelectorAll('.nav-item[data-section]')];
  const sections = items.map((a) => $(a.dataset.section));
  const setActive = (index) => items.forEach((a, i) => a.classList.toggle('is-active', i === index));

  let holdUntil = 0;
  items.forEach((a, i) => a.addEventListener('click', (e) => {
    e.preventDefault();
    setActive(i);
    holdUntil = Date.now() + 900; // keep the clicked item lit while the smooth scroll runs
    sections[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  const ws = $('workspace');
  const spy = () => {
    if (Date.now() < holdUntil) return;
    // The workspace column scrolls on wide layouts; the page scrolls when stacked.
    const columnScroll = ws.scrollHeight > ws.clientHeight + 1;
    const sc = columnScroll ? ws : document.scrollingElement;
    const atBottom = sc.scrollTop > 0 && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
    const threshold = Math.max(ws.getBoundingClientRect().top, 0) + 140;
    let active = 0;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= threshold) active = i; });
    setActive(atBottom ? sections.length - 1 : active);
  };
  ws.addEventListener('scroll', spy, { passive: true });
  window.addEventListener('scroll', spy, { passive: true });
  window.addEventListener('resize', spy);
  spy();
}

function init() {
  // Dropzone
  const dz = $('dropzone');
  const fileInput = $('file-input');
  dz.addEventListener('click', () => fileInput.click());
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('is-dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('is-dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('is-dragover');
    acceptFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    acceptFile(fileInput.files[0]);
    fileInput.value = '';
  });
  $('btn-remove-file').addEventListener('click', removeFile);
  $('btn-replace-file').addEventListener('click', () => fileInput.click());

  // CNR lookup dropzone
  const cnrDz = $('cnr-dropzone');
  const cnrInput = $('cnr-file-input');
  cnrDz.addEventListener('click', () => cnrInput.click());
  cnrDz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cnrInput.click(); } });
  cnrDz.addEventListener('dragover', (e) => { e.preventDefault(); cnrDz.classList.add('is-dragover'); });
  cnrDz.addEventListener('dragleave', () => cnrDz.classList.remove('is-dragover'));
  cnrDz.addEventListener('drop', (e) => {
    e.preventDefault();
    cnrDz.classList.remove('is-dragover');
    acceptCnrFile(e.dataTransfer.files[0]);
  });
  cnrInput.addEventListener('change', () => {
    acceptCnrFile(cnrInput.files[0]);
    cnrInput.value = '';
  });
  $('btn-remove-cnr').addEventListener('click', removeCnrFile);

  // Details
  bindToggle('opt-right-align', 'rightAlignCaseDetails');
  bindText('opt-judge-name', 'judgeName');
  bindText('opt-judge-designation', 'judgeDesignation');
  bindText('opt-court-name', 'courtName');
  $('btn-save-profile').addEventListener('click', saveCurrentProfile);
  renderProfiles();
  renderLocations();

  bindToggle('opt-bold-case', 'boldCaseDetails');
  bindToggle('opt-bold-date', 'boldDate');
  bindToggle('opt-bold-stamp', 'boldStamp');
  bindSegmented('seg-appearance');
  bindSegmented('seg-body');
  bindSegmented('seg-stamp-align');
  bindToggle('opt-steno', 'stenoInitials');
  bindText('opt-steno-text', 'stenoInitialsText');
  $('steno-initials-field').hidden = !state.options.stenoInitials;

  const dateEl = $('opt-date');
  dateEl.value = state.options.causeListDate;
  dateEl.addEventListener('change', () => {
    state.options.causeListDate = dateEl.value;
    renderAll();
  });
  bindToggle('opt-indices', 'includeIndices');

  // Export bar + inspector
  $('btn-dl-docx').addEventListener('click', downloadDocx);
  $('btn-dl-odt').addEventListener('click', downloadOdt);
  $('tab-paper').addEventListener('click', () => { state.previewTab = 'paper'; renderPreview(); });
  $('tab-cases').addEventListener('click', () => { state.previewTab = 'cases'; renderPreview(); });
  $('pdf-splitter-link').href = PDF_SPLITTER_URL;

  initNav();
  renderAll();
}

init();
