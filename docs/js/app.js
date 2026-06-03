// ─── I❤️localpdf — Main App JS ───────────────────────────────────────────
// All PDF operations run via Rust WASM compiled with wasm-pack/lopdf

import init, * as Wasm from '../pkg/ilovelocalpdf.js';
import { encryptPDF } from 'https://cdn.jsdelivr.net/npm/@pdfsmaller/pdf-encrypt/+esm';
import { decryptPDF } from 'https://cdn.jsdelivr.net/npm/@pdfsmaller/pdf-decrypt/+esm';
import {
  absoluteUrl,
  applyToolPageSeo,
  buildBreadcrumbJsonLd,
  buildHomeFooterSeoHtml,
  buildToolFooterSeoHtml,
  buildToolSeoSectionHtml,
} from './seo.js';

// ── State ─────────────────────────────────────────────────────────────────
let wasmReady = false;
let currentTool = null;

// ── Boot ──────────────────────────────────────────────────────────────────
async function boot() {
  try {
    await init();
    wasmReady = true;
    console.log('✅ Rust WASM module loaded');
    document.querySelectorAll('.wasm-loading').forEach(el => el.remove());
  } catch (e) {
    console.error('WASM init failed:', e);
    showToast('⚠️ WASM failed to load: ' + e.message, 'error');
  }
}
boot();

// ── Tool Config ───────────────────────────────────────────────────────────
const TOOLS = {
  merge:        { icon: '🔗', title: 'Merge PDF',        sub: 'Combine multiple PDFs into one',          color: '#e94057' },
  split:        { icon: '✂️', title: 'Split PDF',        sub: 'Split PDF into multiple files',           color: '#f27121' },
  organize:     { icon: '📋', title: 'Organize Pages',   sub: 'Reorder or delete pages',                 color: '#8338ec' },
  'delete-pages':{ icon:'🗑️', title: 'Remove Pages',    sub: 'Delete specific pages from PDF',          color: '#3a86ff' },
  nup:          { icon: '📖', title: 'Booklet Layout', sub: 'Arrange pages side-by-side or in a grid',    color: '#8338ec' },
  compress:     { icon: '📦', title: 'Compress PDF',     sub: 'Reduce PDF file size',                    color: '#06d6a0' },
  repair:       { icon: '🔧', title: 'Repair PDF',       sub: 'Fix and recover damaged PDFs',            color: '#00b4d8' },
  'img-to-pdf': { icon: '🖼️', title: 'Image to PDF',    sub: 'Convert images to PDF',                   color: '#ff006e' },
  'pdf-to-img': { icon: '📸', title: 'PDF to Image',     sub: 'Export PDF pages as images',              color: '#ffd60a' },
  rotate:       { icon: '🔄', title: 'Rotate PDF',       sub: 'Rotate pages in your PDF',                color: '#e94057' },
  watermark:    { icon: '💧', title: 'Add Watermark',    sub: 'Stamp text watermark on PDF',             color: '#f27121' },
  'page-numbers':{ icon:'🔢', title: 'Add Page Numbers', sub: 'Number pages automatically',              color: '#8338ec' },
  protect:      { icon: '🔒', title: 'Protect PDF',      sub: 'Password-protect your PDF',               color: '#3a86ff' },
  unlock:       { icon: '🔓', title: 'Unlock PDF',       sub: 'Remove password protection',              color: '#06d6a0' },
};

const TOOL_SLUGS = {
  merge: 'merge-pdf',
  split: 'split-pdf',
  organize: 'organize-pages',
  'delete-pages': 'remove-pages',
  nup: 'booklet-layout',
  compress: 'compress-pdf',
  repair: 'repair-pdf',
  'img-to-pdf': 'image-to-pdf',
  'pdf-to-img': 'pdf-to-image',
  rotate: 'rotate-pdf',
  watermark: 'add-watermark',
  'page-numbers': 'add-page-numbers',
  protect: 'protect-pdf',
  unlock: 'unlock-pdf',
};

function getToolSlug(toolId) {
  return TOOL_SLUGS[toolId] || toolId;
}

function getToolPagePath(toolId) {
  return `tool.html?tool=${getToolSlug(toolId)}`;
}

function updateToolBreadcrumb(toolId, cfg) {
  const current = document.getElementById('tool-breadcrumb-current');
  if (current) current.textContent = cfg.title;

  let script = document.getElementById('tool-breadcrumb-jsonld');
  if (!script) {
    script = document.createElement('script');
    script.id = 'tool-breadcrumb-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(buildBreadcrumbJsonLd(cfg, toolId, getToolPagePath));
}

function getToolIdFromUrl() {
  const normalize = (value) => {
    if (!value) return '';
    return decodeURIComponent(String(value)).trim().toLowerCase().replace(/\.html$/i, '').replace(/^\/+|\/+$/g, '');
  };
  const slugToTool = Object.fromEntries(Object.entries(TOOL_SLUGS).map(([id, slug]) => [slug, id]));

  const params = new URLSearchParams(window.location.search);
  const byQuery = normalize(params.get('tool'));
  if (byQuery) {
    if (TOOLS[byQuery]) return byQuery;
    if (slugToTool[byQuery]) return slugToTool[byQuery];
  }

  const byPath = normalize(window.location.pathname.split('/').pop() || '');
  if (TOOLS[byPath]) return byPath;
  if (slugToTool[byPath]) return slugToTool[byPath];

  const byHash = normalize(window.location.hash.replace(/^#/, ''));
  if (TOOLS[byHash]) return byHash;
  if (slugToTool[byHash]) return slugToTool[byHash];

  const hrefMatch = window.location.href.match(/[?&#]tool=([^&#]+)/i);
  const byHref = normalize(hrefMatch?.[1] || '');
  if (TOOLS[byHref]) return byHref;
  if (slugToTool[byHref]) return slugToTool[byHref];

  const lastTool = normalize(sessionStorage.getItem('ilp:lastTool'));
  if (TOOLS[lastTool]) return lastTool;
  if (slugToTool[lastTool]) return slugToTool[lastTool];

  return null;
}

// ── Modal helpers ─────────────────────────────────────────────────────────
const overlay = document.getElementById('modal-overlay');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const modalBody = document.getElementById('modal-body');

function openModal(toolId) {
  if (!overlay || !modalBody) return;
  const cfg = TOOLS[toolId];
  if (!cfg) return;
  currentTool = toolId;
  modalIcon.textContent = cfg.icon;
  modalIcon.style.background = cfg.color + '22';
  modalTitle.textContent = cfg.title;
  modalSubtitle.textContent = cfg.sub;
  modalBody.innerHTML = '';
  buildToolUI(toolId, modalBody);
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  if (!overlay) return;
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  currentTool = null;
}

if (overlay) {
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

// ── SEO-friendly tool URLs on homepage cards ───────────────────────────────
document.querySelectorAll('a.tool-card[data-tool]').forEach(card => {
  const id = card.dataset.tool;
  if (id && TOOLS[id]) card.setAttribute('href', getToolPagePath(id));
});

// ── Tool card clicks ──────────────────────────────────────────────────────
document.querySelectorAll('.tool-card').forEach(card => {
  if (card.tagName === 'A') {
    card.addEventListener('click', () => {
      const tool = card.dataset.tool;
      if (tool && TOOLS[tool]) sessionStorage.setItem('ilp:lastTool', tool);
    });
    return;
  }
  const activate = () => openModal(card.dataset.tool);
  card.addEventListener('click', activate);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
});

// ── Dedicated tool page rendering ─────────────────────────────────────────
const toolPageContainer = document.getElementById('tool-page-body');
if (toolPageContainer) {
  const toolId = getToolIdFromUrl() || 'merge';
  const cfg = toolId ? TOOLS[toolId] : null;
  if (cfg) {
    const pageTitle = document.getElementById('tool-page-title');
    const pageSubtitle = document.getElementById('tool-page-subtitle');
    const pageIcon = document.getElementById('tool-page-icon');
    if (pageTitle) pageTitle.textContent = cfg.title;
    if (pageSubtitle) pageSubtitle.textContent = cfg.sub;
    if (pageIcon) {
      pageIcon.textContent = cfg.icon;
      pageIcon.style.background = cfg.color + '22';
    }
    applyToolPageSeo(toolId, cfg, getToolPagePath);
    const toolPath = getToolPagePath(toolId);
    const expectedSlug = getToolSlug(toolId);
    const params = new URLSearchParams(window.location.search);
    if (params.get('tool') !== expectedSlug) {
      window.history.replaceState({}, '', toolPath);
    }
    updateToolBreadcrumb(toolId, cfg);
    sessionStorage.setItem('ilp:lastTool', toolId);
    const seoTitle = document.getElementById('tool-seo-title');
    const seoBody = document.getElementById('tool-seo-body');
    if (seoTitle) seoTitle.textContent = `${cfg.title} — Free & Private`;
    if (seoBody) seoBody.innerHTML = buildToolSeoSectionHtml(toolId, cfg, getToolPagePath);
    const footerSeo = document.getElementById('footer-seo');
    if (footerSeo) footerSeo.innerHTML = buildToolFooterSeoHtml(toolId, cfg, getToolPagePath);
    currentTool = toolId;
    buildToolUI(toolId, toolPageContainer);
  } else {
    document.title = 'Tool Not Found - I❤️localpdf';
    const current = document.getElementById('tool-breadcrumb-current');
    if (current) current.textContent = 'Tool not found';
    toolPageContainer.innerHTML = `
      <p class="text-muted">This PDF tool could not be found. Browse our full list of free local PDF tools.</p>
      <a class="btn-secondary" href="index.html#tools-section">Browse free PDF tools</a>
    `;
  }
}

// ── Homepage SEO footer (small print, crawler-friendly) ───────────────────
if (!toolPageContainer) {
  const footerSeo = document.getElementById('footer-seo');
  if (footerSeo) footerSeo.innerHTML = buildHomeFooterSeoHtml(getToolPagePath);
}

// ── Toast ─────────────────────────────────────────────────────────────────
const toastEl = document.getElementById('global-toast');
let toastTimer;
function showToast(msg, type = 'info', duration = 3500) {
  toastEl.innerHTML = (type === 'error' ? '❌ ' : type === 'success' ? '✅ ' : 'ℹ️ ') + msg;
  toastEl.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

// ── Utilities ─────────────────────────────────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function readFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(new Uint8Array(e.target.result));
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });
}

function downloadBlob(data, filename, mime = 'application/pdf') {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Generic drop zone builder
function makeDropZone(container, opts = {}) {
  const {
    accept = '.pdf',
    multiple = false,
    label = 'Drop PDF here',
    sublabel = 'or click to select',
    icon = '📄',
    onFiles,
  } = opts;

  const dz = document.createElement('div');
  dz.className = 'drop-zone';
  dz.id = 'dz-' + Math.random().toString(36).slice(2);
  dz.innerHTML = `
    <span class="drop-icon">${icon}</span>
    <div class="drop-title">${label}</div>
    <div class="drop-subtitle">${sublabel}</div>
    <button class="btn-select" type="button" id="dz-btn-${dz.id}">
      <span>📂</span> Choose File${multiple ? 's' : ''}
    </button>
    <input type="file" accept="${accept}" ${multiple ? 'multiple' : ''} style="display:none" id="dz-input-${dz.id}" />
  `;
  container.appendChild(dz);

  const input = dz.querySelector('input[type=file]');
  dz.querySelector('button').addEventListener('click', () => input.click());
  dz.addEventListener('click', e => { if (e.target === dz) input.click(); });

  input.addEventListener('change', () => {
    if (input.files.length) onFiles([...input.files]);
    // Let users pick the same file again after "Process Another".
    input.value = '';
  });

  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('drag-over');
    const files = [...e.dataTransfer.files].filter(f => {
      if (accept === '.pdf') return f.type === 'application/pdf' || f.name.endsWith('.pdf');
      return true;
    });
    if (files.length) onFiles(files);
  });

  return dz;
}

// File list widget
function makeFileList(container, files, onRemove) {
  const list = document.createElement('div');
  list.className = 'file-list';
  files.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <span class="file-item-icon">${f.name.endsWith('.pdf') ? '📄' : '🖼️'}</span>
      <div class="file-item-info">
        <div class="file-item-name" title="${f.name}">${f.name}</div>
        <div class="file-item-size">${fmtSize(f.size)}</div>
      </div>
      <button class="file-item-remove" data-idx="${i}" aria-label="Remove ${f.name}">✕</button>
    `;
    list.appendChild(item);
  });
  list.querySelectorAll('.file-item-remove').forEach(btn => {
    btn.addEventListener('click', () => onRemove(+btn.dataset.idx));
  });
  container.appendChild(list);
  return list;
}

function makeRangeRows(container, opts = {}) {
  const {
    title = 'Ranges',
    addLabel = 'Add Range',
    startLabel = 'From',
    endLabel = 'To',
    hint = '',
    minRows = 1,
  } = opts;

  const wrap = document.createElement('div');
  wrap.className = 'range-editor';
  wrap.innerHTML = `
    <div class="range-editor-head">
      <span class="range-editor-title">${title}</span>
      <button type="button" class="btn-secondary range-add-btn">➕ ${addLabel}</button>
    </div>
    ${hint ? `<p class="range-editor-hint">${hint}</p>` : ''}
    <div class="range-rows"></div>
  `;
  container.appendChild(wrap);

  const rowsEl = wrap.querySelector('.range-rows');
  const addBtn = wrap.querySelector('.range-add-btn');

  function createRow(start = '', end = '') {
    const row = document.createElement('div');
    row.className = 'range-row';
    row.innerHTML = `
      <label class="range-input-wrap">
        <span>${startLabel}</span>
        <input type="number" min="1" step="1" class="option-input range-input range-start" value="${start}">
      </label>
      <span class="range-sep">→</span>
      <label class="range-input-wrap">
        <span>${endLabel}</span>
        <input type="number" min="1" step="1" class="option-input range-input range-end" value="${end}">
      </label>
      <button type="button" class="range-remove-btn" aria-label="Remove range">✕</button>
    `;
    rowsEl.appendChild(row);
    bindRow(row);
    enforceMinRows();
  }

  function bindRow(row) {
    const rem = row.querySelector('.range-remove-btn');
    rem.addEventListener('click', () => {
      row.remove();
      enforceMinRows();
    });
  }

  function enforceMinRows() {
    const rows = [...rowsEl.querySelectorAll('.range-row')];
    if (!rows.length && minRows > 0) {
      for (let i = 0; i < minRows; i++) createRow();
      return;
    }
    const disableRemove = rows.length <= minRows;
    rows.forEach(row => {
      const rem = row.querySelector('.range-remove-btn');
      rem.disabled = disableRemove;
    });
  }

  function getRanges() {
    return [...rowsEl.querySelectorAll('.range-row')].map(row => {
      const fromVal = parseInt(row.querySelector('.range-start').value, 10);
      const toVal = parseInt(row.querySelector('.range-end').value, 10);
      return {
        from: Number.isFinite(fromVal) ? fromVal : NaN,
        to: Number.isFinite(toVal) ? toVal : NaN,
      };
    });
  }

  addBtn.addEventListener('click', () => createRow());
  enforceMinRows();

  return { wrap, rowsEl, addRow: createRow, getRanges };
}

function validateRanges(ranges, pageCount) {
  if (!Array.isArray(ranges) || !ranges.length) {
    return { ok: false, error: 'Add at least one range.' };
  }
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (!Number.isInteger(r.from) || !Number.isInteger(r.to)) {
      return { ok: false, error: `Range ${i + 1} must have valid numbers.` };
    }
    if (r.from < 1 || r.to < 1) {
      return { ok: false, error: `Range ${i + 1} must start at page 1 or higher.` };
    }
    if (pageCount && (r.from > pageCount || r.to > pageCount)) {
      return { ok: false, error: `Range ${i + 1} exceeds page count (${pageCount}).` };
    }
    if (r.from > r.to) {
      return { ok: false, error: `Range ${i + 1} has invalid order (from > to).` };
    }
  }

  const sorted = ranges.map((r, idx) => ({ ...r, idx })).sort((a, b) => a.from - b.from);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    if (next.from <= prev.to) {
      return { ok: false, error: `Range ${next.idx + 1} overlaps with range ${prev.idx + 1}.` };
    }
  }
  return { ok: true };
}

// Progress bar
function makeProgress(container) {
  const wrap = document.createElement('div');
  wrap.className = 'progress-wrap';
  wrap.innerHTML = `
    <div class="progress-bar-track"><div class="progress-bar-fill" id="pb-fill"></div></div>
    <div class="progress-text" id="pb-text">Processing…</div>
  `;
  container.appendChild(wrap);
  return {
    wrap,
    show(pct, text) {
      wrap.classList.add('visible');
      wrap.querySelector('#pb-fill').style.width = pct + '%';
      wrap.querySelector('#pb-text').textContent = text || 'Processing…';
    },
    hide() { wrap.classList.remove('visible'); },
  };
}

// Success block
function makeSuccess(container) {
  const s = document.createElement('div');
  s.className = 'success-state';
  container.appendChild(s);
  return {
    el: s,
    show({ title, subtitle, downloads }) {
      const firstPdf = downloads.find(d => {
        const mime = (d.mime || '').toLowerCase();
        return mime === 'application/pdf' || /\.pdf$/i.test(d.name || '');
      });

      s.innerHTML = `
        <span class="success-icon">✅</span>
        <div class="success-title">${title}</div>
        <div class="success-subtitle">${subtitle}</div>
        ${firstPdf ? `
          <div class="success-preview-wrap">
            <div class="success-preview-title">Preview before download</div>
            <iframe class="success-preview-frame" src="${firstPdf.url}" title="Processed PDF preview"></iframe>
          </div>
        ` : ''}
        ${downloads.map(d => `<div><a class="btn-download" href="${d.url}" download="${d.name}">⬇️ Download ${d.label}</a></div>`).join('')}
        <button class="btn-secondary" id="succ-again-btn" style="max-width:240px;margin:12px auto 0">🔄 Process Another</button>
      `;
      s.classList.add('visible');
    },
    hide() { s.classList.remove('visible'); s.innerHTML = ''; },
  };
}

// Action button
function makeActionBtn(container, label) {
  const btn = document.createElement('button');
  btn.className = 'btn-action';
  btn.disabled = true;
  btn.id = 'action-btn';
  btn.innerHTML = `<span>${label}</span>`;
  container.appendChild(btn);
  return btn;
}

// Options panel
function makeOptions(container, title = 'Options') {
  const panel = document.createElement('div');
  panel.className = 'options-panel';
  panel.innerHTML = `<div class="options-title">${title}</div>`;
  container.appendChild(panel);
  return panel;
}

function addOptionRow(panel, labelText, inputEl) {
  const row = document.createElement('div');
  row.className = 'option-row';
  const label = document.createElement('label');
  label.className = 'option-label';
  label.textContent = labelText;
  row.appendChild(label);
  row.appendChild(inputEl);
  panel.appendChild(row);
  return row;
}

function makeSelect(options, defaultVal) {
  const sel = document.createElement('select');
  sel.className = 'option-select';
  options.forEach(([val, text]) => {
    const o = document.createElement('option');
    o.value = val; o.textContent = text;
    if (val === defaultVal) o.selected = true;
    sel.appendChild(o);
  });
  return sel;
}

function makeInput(type = 'text', placeholder = '', value = '') {
  const inp = document.createElement('input');
  inp.type = type;
  inp.className = 'option-input';
  inp.placeholder = placeholder;
  inp.value = value;
  return inp;
}

function makeRadioGroup(container, name, options, defaultVal) {
  const group = document.createElement('div');
  group.className = 'radio-group';
  options.forEach(([val, text]) => {
    const wrap = document.createElement('div');
    wrap.className = 'radio-btn';
    const id = `rb-${name}-${val}`;
    wrap.innerHTML = `<input type="radio" name="${name}" id="${id}" value="${val}" ${val === defaultVal ? 'checked' : ''}>
      <label for="${id}">${text}</label>`;
    group.appendChild(wrap);
  });
  container.appendChild(group);
  return group;
}

// ── Build Tool UIs ────────────────────────────────────────────────────────
function buildToolUI(toolId, container) {
  switch (toolId) {
    case 'merge':        return buildMerge(container);
    case 'split':        return buildSplit(container);
    case 'organize':     return buildOrganize(container);
    case 'delete-pages': return buildDeletePages(container);
    case 'nup':          return buildNup(container);
    case 'compress':     return buildCompress(container);
    case 'repair':       return buildRepair(container);
    case 'img-to-pdf':   return buildImgToPdf(container);
    case 'pdf-to-img':   return buildPdfToImg(container);
    case 'rotate':       return buildRotate(container);
    case 'watermark':    return buildWatermark(container);
    case 'page-numbers': return buildPageNumbers(container);
    case 'protect':      return buildProtect(container);
    case 'unlock':       return buildUnlock(container);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MERGE
// ════════════════════════════════════════════════════════════════════════════
function buildMerge(c) {
  let files = [];
  let dragIdx = null;
  const refresh = () => {
    fileListEl.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'file-list';
    files.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'file-item file-item-draggable';
      item.draggable = true;
      item.dataset.idx = i;
      item.innerHTML = `
        <span class="file-item-icon">📄</span>
        <div class="file-item-info">
          <div class="file-item-name" title="${f.name}">${i + 1}. ${f.name}</div>
          <div class="file-item-size">${fmtSize(f.size)}</div>
        </div>
        <span class="file-drag-handle" aria-hidden="true">↕</span>
        <button class="file-item-remove" data-idx="${i}" aria-label="Remove ${f.name}">✕</button>
      `;
      item.addEventListener('dragstart', () => {
        dragIdx = i;
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      item.addEventListener('dragover', e => {
        e.preventDefault();
        item.classList.add('drag-target');
      });
      item.addEventListener('dragleave', () => item.classList.remove('drag-target'));
      item.addEventListener('drop', e => {
        e.preventDefault();
        item.classList.remove('drag-target');
        const targetIdx = i;
        if (dragIdx === null || dragIdx === targetIdx) return;
        const [moved] = files.splice(dragIdx, 1);
        files.splice(targetIdx, 0, moved);
        dragIdx = null;
        refresh();
      });
      list.appendChild(item);
    });
    list.querySelectorAll('.file-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        files.splice(+btn.dataset.idx, 1);
        refresh();
      });
    });
    fileListEl.appendChild(list);
    actionBtn.disabled = files.length < 2;
    dropArea.style.display = files.length ? 'none' : '';
    addMoreBtn.style.display = files.length ? '' : 'none';
  };

  const dropArea = makeDropZone(c, {
    multiple: true,
    label: 'Drop PDFs here to merge',
    sublabel: 'Select 2 or more PDF files',
    icon: '🔗',
    onFiles: picked => { files.push(...picked); refresh(); },
  });

  const addMoreBtn = document.createElement('button');
  addMoreBtn.className = 'btn-secondary';
  addMoreBtn.style.display = 'none';
  addMoreBtn.innerHTML = '➕ Add More PDFs';
  const addInp = document.createElement('input');
  addInp.type = 'file'; addInp.accept = '.pdf'; addInp.multiple = true; addInp.style.display = 'none';
  addInp.addEventListener('change', () => { files.push(...addInp.files); refresh(); addInp.value = ''; });
  addMoreBtn.addEventListener('click', () => addInp.click());
  c.appendChild(addMoreBtn); c.appendChild(addInp);

  const fileListEl = document.createElement('div');
  c.appendChild(fileListEl);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '🔗 Merge PDFs');

  actionBtn.addEventListener('click', async () => {
    if (!wasmReady) return showToast('WASM not ready yet', 'error');
    actionBtn.disabled = true;
    prog.show(30, 'Reading files…');

    try {
      const arr = new globalThis.Array();
      for (let i = 0; i < files.length; i++) {
        prog.show(30 + Math.round((i / files.length) * 40), `Loading ${files[i].name}…`);
        const u8 = await readFile(files[i]);
        arr.push(u8);
      }
      prog.show(80, 'Merging…');
      const result = Wasm.merge_pdfs(arr);
      prog.show(100, 'Done!');
      prog.hide();

      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({
        title: 'PDFs Merged Successfully!',
        subtitle: `Combined ${files.length} files → ${fmtSize(result.length)}`,
        downloads: [{ url, name: 'merged.pdf', label: 'merged.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('Merge failed: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  });

  c.addEventListener('click', e => {
    if (e.target?.id === 'succ-again-btn') {
      files = []; succ.hide(); refresh();
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SPLIT
// ════════════════════════════════════════════════════════════════════════════
function buildSplit(c) {
  let pdfFile = null;
  let pageCount = 0;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to split',
    icon: '✂️',
    onFiles: async ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      try {
        const data = await readFile(f);
        pageCount = Wasm.get_page_count(data);
        pageCountEl.textContent = `This PDF has ${pageCount} page${pageCount !== 1 ? 's' : ''}.`;
        updateSplitPreview();
      } catch(e) { showToast('Could not read PDF: ' + e, 'error'); }
      actionBtn.disabled = false;
    },
  });

  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-item';
  fileInfo.style.display = 'none';
  fileInfo.innerHTML = '';
  c.appendChild(fileInfo);

  const pageCountEl = document.createElement('p');
  pageCountEl.style.cssText = 'color:var(--text-muted);font-size:.85rem;margin:10px 0';
  c.appendChild(pageCountEl);

  const opts = makeOptions(c, 'Split Options');

  const splitModeGroup = makeRadioGroup(opts, 'split-mode', [
    ['range', '📐 Page Ranges'],
    ['each',  '📑 Extract Each Page'],
    ['half',  '⚡ Split in Half'],
  ], 'range');
  opts.appendChild(splitModeGroup);

  const rangeEditor = makeRangeRows(opts, {
    title: 'Page ranges',
    addLabel: 'Add Range',
    startLabel: 'From',
    endLabel: 'To',
    hint: 'Add one or more non-overlapping ranges.',
    minRows: 1,
  });
  const splitFirstStart = rangeEditor.rowsEl.querySelector('.range-start');
  const splitFirstEnd = rangeEditor.rowsEl.querySelector('.range-end');
  if (splitFirstStart && splitFirstEnd) {
    splitFirstStart.value = 1;
    splitFirstEnd.value = 1;
  }

  const previewEl = document.createElement('div');
  previewEl.style.cssText = 'font-size:.78rem;color:var(--text-muted);margin-top:8px;';
  opts.appendChild(previewEl);

  function updateSplitPreview() {
    const mode = opts.querySelector('input[name=split-mode]:checked')?.value;
    if (!pdfFile) return;
    if (mode === 'each') {
      previewEl.textContent = `Will produce ${pageCount} separate PDF files.`;
      rangeEditor.wrap.style.display = 'none';
    } else if (mode === 'half') {
      const mid = Math.ceil(pageCount / 2);
      previewEl.textContent = `Will produce 2 files: pages 1-${mid} and ${mid+1}-${pageCount}.`;
      rangeEditor.wrap.style.display = 'none';
    } else {
      rangeEditor.wrap.style.display = '';
      previewEl.textContent = 'Choose ranges in ascending order.';
    }
  }

  splitModeGroup.addEventListener('change', updateSplitPreview);
  rangeEditor.rowsEl.addEventListener('input', updateSplitPreview);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '✂️ Split PDF');
  actionBtn.disabled = true;

  actionBtn.addEventListener('click', async () => {
    if (!wasmReady || !pdfFile) return;
    actionBtn.disabled = true;
    prog.show(20, 'Reading PDF…');

    try {
      const data = await readFile(pdfFile);
      const mode = opts.querySelector('input[name=split-mode]:checked')?.value;

      let ranges = [];
      if (mode === 'each') {
        ranges = Array.from({ length: pageCount }, (_, i) => [i + 1, i + 1]);
      } else if (mode === 'half') {
        const mid = Math.ceil(pageCount / 2);
        ranges = [[1, mid], [mid + 1, pageCount]];
      } else {
        const entries = rangeEditor.getRanges();
        const validation = validateRanges(entries, pageCount);
        if (!validation.ok) { showToast(validation.error, 'error'); actionBtn.disabled = false; prog.hide(); return; }
        ranges = entries.map(r => [r.from, r.to]);
      }

      prog.show(60, 'Splitting…');
      const results = Wasm.split_pdf(data, JSON.stringify(ranges));
      prog.show(100, 'Done!');
      prog.hide();

      const downloads = [];
      for (let i = 0; i < results.length; i++) {
        const buf = results[i];
        const url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
        const r = ranges[i];
        downloads.push({ url, name: `split_p${r[0]}-${r[1]}.pdf`, label: `Part ${i + 1} (p.${r[0]}–${r[1]})` });
      }

      succ.show({
        title: `Split into ${downloads.length} files!`,
        subtitle: pdfFile.name,
        downloads,
      });
    } catch (e) {
      prog.hide();
      showToast('Split failed: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  });

  c.addEventListener('click', e => {
    if (e.target?.id === 'succ-again-btn') { pdfFile = null; pageCount = 0; dropArea.style.display = ''; fileInfo.style.display = 'none'; pageCountEl.textContent = ''; succ.hide(); actionBtn.disabled = true; }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// ORGANIZE PAGES (drag-and-drop thumbnails via PDF.js)
// ════════════════════════════════════════════════════════════════════════════
function buildOrganize(c) {
  let pdfFile = null;
  let pageOrder = [];
  let dragPage = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to organize',
    icon: '📋',
    onFiles: async ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      await loadPageThumbs(f);
      actionBtn.disabled = false;
    },
  });

  const thumbGrid = document.createElement('div');
  thumbGrid.className = 'page-grid';
  thumbGrid.style.display = 'none';
  c.appendChild(thumbGrid);

  const hint = document.createElement('p');
  hint.style.cssText = 'font-size:.78rem;color:var(--text-muted);text-align:center;margin:8px 0;';
  hint.textContent = 'Drag pages to reorder. Click ✕ to delete.';
  hint.style.display = 'none';
  c.appendChild(hint);

  async function loadPageThumbs(file) {
    thumbGrid.innerHTML = '';
    thumbGrid.style.display = 'grid';
    hint.style.display = '';

    const data = await readFile(file);
    const pageCount = Wasm.get_page_count(data);
    pageOrder = Array.from({ length: pageCount }, (_, i) => i + 1);

    await renderThumbs(file, pageCount);
  }

  async function renderThumbs(file, n) {
    thumbGrid.innerHTML = '';
    const pdfjsLib = await loadPdfJs();
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;

    for (let i = 1; i <= n; i++) {
      const pageNum = pageOrder[i - 1];
      const thumb = document.createElement('div');
      thumb.className = 'page-thumb';
      thumb.draggable = true;
      thumb.dataset.page = String(pageNum);

      const canvas = document.createElement('canvas');
      thumb.appendChild(canvas);

      const label = document.createElement('div');
      label.className = 'page-thumb-label';
      label.textContent = `Page ${pageNum}`;
      thumb.appendChild(label);

      const delBtn = document.createElement('button');
      delBtn.className = 'page-thumb-delete';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        const page = parseInt(thumb.dataset.page, 10);
        const idx = pageOrder.indexOf(page);
        if (idx !== -1) pageOrder.splice(idx, 1);
        thumb.remove();
        updateThumbLabels();
        actionBtn.disabled = pageOrder.length === 0;
      });
      thumb.appendChild(delBtn);

      thumbGrid.appendChild(thumb);

      // Render page
      const page = await pdf.getPage(pageNum);
      const vp = page.getViewport({ scale: 0.3 });
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

      setupDrag(thumb);
    }
    updateThumbLabels();
  }

  function updateThumbLabels() {
    [...thumbGrid.querySelectorAll('.page-thumb')].forEach((el, idx) => {
      const page = parseInt(el.dataset.page, 10);
      const label = el.querySelector('.page-thumb-label');
      label.textContent = `Page ${page} • #${idx + 1}`;
    });
  }

  function setupDrag(el) {
    el.addEventListener('dragstart', () => {
      dragPage = parseInt(el.dataset.page, 10);
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); });
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-target'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-target'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-target');
      if (!Number.isInteger(dragPage)) return;

      const targetPage = parseInt(el.dataset.page, 10);
      if (dragPage === targetPage) return;

      const dragIdx = pageOrder.indexOf(dragPage);
      const targetIdx = pageOrder.indexOf(targetPage);
      if (dragIdx < 0 || targetIdx < 0) return;

      const [moved] = pageOrder.splice(dragIdx, 1);
      pageOrder.splice(targetIdx, 0, moved);

      const draggedEl = thumbGrid.querySelector(`.page-thumb[data-page="${dragPage}"]`);
      const targetEl = thumbGrid.querySelector(`.page-thumb[data-page="${targetPage}"]`);
      if (draggedEl && targetEl) {
        if (dragIdx < targetIdx) {
          targetEl.insertAdjacentElement('afterend', draggedEl);
        } else {
          targetEl.insertAdjacentElement('beforebegin', draggedEl);
        }
      }
      updateThumbLabels();
      dragPage = null;
    });
  }

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '📋 Apply Order');
  actionBtn.disabled = true;

  actionBtn.addEventListener('click', async () => {
    if (!wasmReady || !pdfFile) return;
    actionBtn.disabled = true;
    prog.show(40, 'Reorganizing pages…');
    try {
      const data = await readFile(pdfFile);
      const result = Wasm.organize_pages(data, JSON.stringify(pageOrder));
      prog.show(100, 'Done!');
      prog.hide();
      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({
        title: 'Pages Reorganized!',
        subtitle: `${pageOrder.length} pages in new order`,
        downloads: [{ url, name: 'organized.pdf', label: 'organized.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  });

  c.addEventListener('click', e => {
    if (e.target?.id === 'succ-again-btn') { pdfFile = null; pageOrder = []; thumbGrid.innerHTML = ''; thumbGrid.style.display = 'none'; hint.style.display = 'none'; dropArea.style.display = ''; succ.hide(); actionBtn.disabled = true; }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// DELETE PAGES
// ════════════════════════════════════════════════════════════════════════════
function buildDeletePages(c) {
  let pdfFile = null;
  let pageCount = 0;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to remove pages',
    icon: '🗑️',
    onFiles: async ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      const data = await readFile(f);
      pageCount = Wasm.get_page_count(data);
      pageCountEl.textContent = `${pageCount} pages total. Add one or more ranges to delete.`;
      actionBtn.disabled = false;
    },
  });

  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-item';
  fileInfo.style.display = 'none';
  c.appendChild(fileInfo);

  const pageCountEl = document.createElement('p');
  pageCountEl.style.cssText = 'font-size:.82rem;color:var(--text-muted);margin:10px 0';
  c.appendChild(pageCountEl);

  const opts = makeOptions(c, 'Pages to Delete');
  const rangeEditor = makeRangeRows(opts, {
    title: 'Delete ranges',
    addLabel: 'Add Delete Range',
    startLabel: 'From',
    endLabel: 'To',
    hint: 'Each row supports single pages too (same from/to).',
    minRows: 1,
  });
  const deleteFirstStart = rangeEditor.rowsEl.querySelector('.range-start');
  const deleteFirstEnd = rangeEditor.rowsEl.querySelector('.range-end');
  if (deleteFirstStart && deleteFirstEnd) {
    deleteFirstStart.value = 1;
    deleteFirstEnd.value = 1;
  }

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '🗑️ Delete Pages');
  actionBtn.disabled = true;

  actionBtn.addEventListener('click', async () => {
    if (!wasmReady || !pdfFile) return;
    const entries = rangeEditor.getRanges();
    const validation = validateRanges(entries, pageCount);
    if (!validation.ok) { showToast(validation.error, 'error'); return; }

    const pages = [];
    entries.forEach(r => {
      for (let p = r.from; p <= r.to; p++) pages.push(p);
    });
    if (pages.length >= pageCount) { showToast('Cannot delete all pages from the PDF.', 'error'); return; }

    actionBtn.disabled = true;
    prog.show(50, 'Removing pages…');
    try {
      const data = await readFile(pdfFile);
      const result = Wasm.delete_pages(data, JSON.stringify(pages));
      prog.show(100, 'Done!');
      prog.hide();
      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({
        title: 'Pages Removed!',
        subtitle: `Deleted ${pages.length} page(s)`,
        downloads: [{ url, name: 'pages_removed.pdf', label: 'result.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  });

  c.addEventListener('click', e => {
    if (e.target?.id === 'succ-again-btn') { pdfFile = null; dropArea.style.display = ''; fileInfo.style.display = 'none'; pageCountEl.textContent = ''; succ.hide(); actionBtn.disabled = true; }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// N-UP PDF
// ════════════════════════════════════════════════════════════════════════════
function buildNup(c) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to create N-up layout',
    sublabel: 'Generate 2-up or 4-up A4 landscape sheets',
    icon: '📖',
    onFiles: ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-item';
  fileInfo.style.display = 'none';
  c.appendChild(fileInfo);

  const opts = makeOptions(c, 'Layout Options');
  const layoutSelect = makeSelect([
    ['2', 'Side-by-Side (2 pages per sheet)'],
    ['4', 'Grid (4 pages per sheet)'],
  ], '2');
  addOptionRow(opts, 'Layout Style:', layoutSelect);

  const sizeSelect = makeSelect([
    ['a4-landscape', 'A4 Landscape (841.89 × 595.28 pt)'],
  ], 'a4-landscape');
  sizeSelect.disabled = true;
  addOptionRow(opts, 'Sheet Size:', sizeSelect);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '📖 Generate Booklet PDF');
  actionBtn.disabled = true;

  actionBtn.addEventListener('click', async () => {
    if (!wasmReady || !pdfFile) return;
    actionBtn.disabled = true;
    prog.show(30, 'Reading PDF…');
    try {
      const data = await readFile(pdfFile);
      const nup = parseInt(layoutSelect.value, 10);
      prog.show(70, `Building ${nup}-up layout…`);
      const result = Wasm.nup_pdf(data, nup);
      prog.show(100, 'Done!');
      prog.hide();

      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({
        title: 'Booklet PDF Generated!',
        subtitle: 'A4 landscape booklet layout ready',
        downloads: [{ url, name: nup === 2 ? 'booklet_side_by_side.pdf' : 'booklet_grid.pdf', label: nup === 2 ? 'booklet_side_by_side.pdf' : 'booklet_grid.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('N-up generation failed: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  });

  c.addEventListener('click', e => {
    if (e.target?.id === 'succ-again-btn') {
      pdfFile = null;
      dropArea.style.display = '';
      fileInfo.style.display = 'none';
      succ.hide();
      actionBtn.disabled = true;
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// COMPRESS
// ════════════════════════════════════════════════════════════════════════════
function buildCompress(c) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to compress',
    icon: '📦',
    onFiles: async ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-item';
  fileInfo.style.display = 'none';
  c.appendChild(fileInfo);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '📦 Compress PDF');
  actionBtn.disabled = true;

  actionBtn.addEventListener('click', async () => {
    if (!wasmReady || !pdfFile) return;
    actionBtn.disabled = true;
    prog.show(30, 'Reading PDF…');
    try {
      const data = await readFile(pdfFile);
      prog.show(70, 'Compressing streams…');
      const result = Wasm.compress_pdf(data);
      prog.show(100, 'Done!');
      prog.hide();
      const saved = data.length - result.length;
      const pct = ((saved / data.length) * 100).toFixed(1);
      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({
        title: saved > 0 ? `Reduced by ${pct}%!` : 'No reduction possible',
        subtitle: saved > 0
          ? `${fmtSize(data.length)} → ${fmtSize(result.length)}`
          : 'This PDF is already optimized; keeping original size.',
        downloads: [{ url, name: 'compressed.pdf', label: 'compressed.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  });

  c.addEventListener('click', e => {
    if (e.target?.id === 'succ-again-btn') { pdfFile = null; dropArea.style.display = ''; fileInfo.style.display = 'none'; succ.hide(); actionBtn.disabled = true; }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// REPAIR
// ════════════════════════════════════════════════════════════════════════════
function buildRepair(c) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a damaged PDF to repair',
    icon: '🔧',
    onFiles: ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-item';
  fileInfo.style.display = 'none';
  c.appendChild(fileInfo);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '🔧 Repair PDF');
  actionBtn.disabled = true;

  actionBtn.addEventListener('click', async () => {
    if (!wasmReady || !pdfFile) return;
    actionBtn.disabled = true;
    prog.show(50, 'Repairing…');
    try {
      const data = await readFile(pdfFile);
      const result = Wasm.repair_pdf(data);
      prog.show(100, 'Done!');
      prog.hide();
      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({
        title: 'PDF Repaired!',
        subtitle: pdfFile.name,
        downloads: [{ url, name: 'repaired.pdf', label: 'repaired.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('Could not repair: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  });

  c.addEventListener('click', e => {
    if (e.target?.id === 'succ-again-btn') { pdfFile = null; dropArea.style.display = ''; fileInfo.style.display = 'none'; succ.hide(); actionBtn.disabled = true; }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// IMAGE → PDF
// ════════════════════════════════════════════════════════════════════════════
function buildImgToPdf(c) {
  let files = [];

  const dropArea = makeDropZone(c, {
    accept: '.jpg,.jpeg,.png,.webp,.bmp,.gif',
    multiple: true,
    label: 'Drop images here',
    sublabel: 'JPG, PNG, WebP, BMP supported',
    icon: '🖼️',
    onFiles: picked => { files.push(...picked); refresh(); },
  });

  const fileListEl = document.createElement('div');
  c.appendChild(fileListEl);

  const addMoreBtn = document.createElement('button');
  addMoreBtn.className = 'btn-secondary';
  addMoreBtn.style.display = 'none';
  addMoreBtn.innerHTML = '➕ Add More Images';
  const addInp = document.createElement('input');
  addInp.type = 'file'; addInp.accept = '.jpg,.jpeg,.png,.webp,.bmp,.gif'; addInp.multiple = true; addInp.style.display = 'none';
  addInp.addEventListener('change', () => { files.push(...addInp.files); refresh(); addInp.value = ''; });
  addMoreBtn.addEventListener('click', () => addInp.click());
  c.appendChild(addMoreBtn); c.appendChild(addInp);

  function refresh() {
    fileListEl.innerHTML = '';
    makeFileList(fileListEl, files, idx => { files.splice(idx, 1); refresh(); });
    actionBtn.disabled = files.length === 0;
    dropArea.style.display = files.length ? 'none' : '';
    addMoreBtn.style.display = files.length ? '' : 'none';
  }

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '🖼️ Convert to PDF');
  actionBtn.disabled = true;

  actionBtn.addEventListener('click', async () => {
    if (!wasmReady || !files.length) return;
    actionBtn.disabled = true;
    prog.show(20, 'Reading images…');
    try {
      const arr = new globalThis.Array();
      for (let i = 0; i < files.length; i++) {
        prog.show(20 + Math.round((i / files.length) * 60), `Processing ${files[i].name}…`);
        arr.push(await readFile(files[i]));
      }
      prog.show(90, 'Building PDF…');
      const result = Wasm.images_to_pdf(arr);
      prog.show(100, 'Done!');
      prog.hide();
      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({
        title: `Created PDF from ${files.length} image${files.length > 1 ? 's' : ''}!`,
        subtitle: fmtSize(result.length),
        downloads: [{ url, name: 'images.pdf', label: 'images.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  });

  c.addEventListener('click', e => {
    if (e.target?.id === 'succ-again-btn') { files = []; succ.hide(); refresh(); }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PDF → IMAGE  (uses PDF.js for rendering)
// ════════════════════════════════════════════════════════════════════════════
function buildPdfToImg(c) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to convert to images',
    icon: '📸',
    onFiles: ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-item';
  fileInfo.style.display = 'none';
  c.appendChild(fileInfo);

  const opts = makeOptions(c, 'Export Options');
  const scaleSelect = makeSelect([['1','72 DPI (Low)'],['2','144 DPI (Medium)'],['3','216 DPI (High)'],['4','288 DPI (Very High)']], '2');
  addOptionRow(opts, 'Resolution:', scaleSelect);
  const fmtSelect = makeSelect([['png','PNG (lossless)'],['jpeg','JPEG (smaller)']], 'png');
  addOptionRow(opts, 'Format:', fmtSelect);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '📸 Convert to Images');
  actionBtn.disabled = true;

  actionBtn.addEventListener('click', async () => {
    if (!pdfFile) return;
    actionBtn.disabled = true;
    prog.show(10, 'Loading PDF renderer…');
    try {
      const pdfjsLib = await loadPdfJs();
      const ab = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
      const n = pdf.numPages;
      const scale = parseFloat(scaleSelect.value);
      const fmt = fmtSelect.value;
      const mime = fmt === 'jpeg' ? 'image/jpeg' : 'image/png';
      const ext = fmt === 'jpeg' ? 'jpg' : 'png';

      const downloads = [];
      for (let i = 1; i <= n; i++) {
        prog.show(10 + Math.round((i / n) * 85), `Rendering page ${i}/${n}…`);
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        const url = canvas.toDataURL(mime, 0.92);
        downloads.push({ url, name: `page_${i}.${ext}`, label: `Page ${i}` });
      }

      prog.show(100, 'Done!');
      prog.hide();
      succ.show({
        title: `Exported ${n} image${n > 1 ? 's' : ''}!`,
        subtitle: `${scale * 72} DPI, ${fmt.toUpperCase()} format`,
        downloads,
      });
    } catch (e) {
      prog.hide();
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  });

  c.addEventListener('click', e => {
    if (e.target?.id === 'succ-again-btn') { pdfFile = null; dropArea.style.display = ''; fileInfo.style.display = 'none'; succ.hide(); actionBtn.disabled = true; }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// ROTATE
// ════════════════════════════════════════════════════════════════════════════
function buildRotate(c) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to rotate',
    icon: '🔄',
    onFiles: ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-item';
  fileInfo.style.display = 'none';
  c.appendChild(fileInfo);

  const opts = makeOptions(c, 'Rotation Options');

  const angleGroup = makeRadioGroup(opts, 'rot-angle', [
    ['90',  '↻ 90°'],
    ['180', '↺ 180°'],
    ['270', '↻ 270°'],
  ], '90');
  opts.appendChild(angleGroup);

  const pagesInput = makeInput('text', 'all', 'all');
  addOptionRow(opts, 'Pages (e.g. 1,3 or "all"):', pagesInput);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '🔄 Rotate PDF');
  actionBtn.disabled = true;

  actionBtn.addEventListener('click', async () => {
    if (!wasmReady || !pdfFile) return;
    actionBtn.disabled = true;
    prog.show(40, 'Rotating…');
    try {
      const data = await readFile(pdfFile);
      const angle = parseInt(opts.querySelector('input[name=rot-angle]:checked')?.value || '90');
      const pagesVal = pagesInput.value.trim() || 'all';
      let finalResult;
      if (pagesVal === 'all') {
        finalResult = Wasm.rotate_pdf(data, angle, 'all');
      } else {
        const pages = pagesVal.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        finalResult = Wasm.rotate_pdf(data, angle, JSON.stringify(pages));
      }

      prog.show(100, 'Done!');
      prog.hide();
      const url = URL.createObjectURL(new Blob([finalResult], { type: 'application/pdf' }));
      succ.show({
        title: `Rotated ${angle}°!`,
        subtitle: pdfFile.name,
        downloads: [{ url, name: 'rotated.pdf', label: 'rotated.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  });

  c.addEventListener('click', e => {
    if (e.target?.id === 'succ-again-btn') { pdfFile = null; dropArea.style.display = ''; fileInfo.style.display = 'none'; succ.hide(); actionBtn.disabled = true; }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// WATERMARK
// ════════════════════════════════════════════════════════════════════════════
function buildWatermark(c) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to watermark',
    icon: '💧',
    onFiles: ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-item';
  fileInfo.style.display = 'none';
  c.appendChild(fileInfo);

  const opts = makeOptions(c, 'Watermark Options');

  const textInput = makeInput('text', 'CONFIDENTIAL', 'CONFIDENTIAL');
  addOptionRow(opts, 'Watermark text:', textInput);

  const posSelect = makeSelect([
    ['diagonal','Diagonal (default)'],
    ['center','Center'],
    ['top','Top'],
    ['bottom','Bottom'],
  ], 'diagonal');
  addOptionRow(opts, 'Position:', posSelect);

  const opacityWrap = document.createElement('div');
  opacityWrap.className = 'slider-wrap';
  const opacityRange = document.createElement('input');
  opacityRange.type = 'range'; opacityRange.min = '5'; opacityRange.max = '100'; opacityRange.value = '30';
  opacityRange.className = 'option-range';
  const opacityVal = document.createElement('span');
  opacityVal.className = 'slider-val';
  opacityVal.textContent = '30%';
  opacityRange.addEventListener('input', () => opacityVal.textContent = opacityRange.value + '%');
  opacityWrap.appendChild(opacityRange);
  opacityWrap.appendChild(opacityVal);
  addOptionRow(opts, 'Opacity:', opacityWrap);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '💧 Add Watermark');
  actionBtn.disabled = true;

  actionBtn.addEventListener('click', async () => {
    if (!wasmReady || !pdfFile) return;
    const text = textInput.value.trim() || 'WATERMARK';
    const opacity = parseInt(opacityRange.value) / 100;
    const pos = posSelect.value;
    actionBtn.disabled = true;
    prog.show(50, 'Adding watermark…');
    try {
      const data = await readFile(pdfFile);
      const result = Wasm.add_watermark(data, text, opacity, pos);
      prog.show(100, 'Done!');
      prog.hide();
      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({
        title: 'Watermark Added!',
        subtitle: `"${text}" at ${opacity * 100}% opacity`,
        downloads: [{ url, name: 'watermarked.pdf', label: 'watermarked.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  });

  c.addEventListener('click', e => {
    if (e.target?.id === 'succ-again-btn') { pdfFile = null; dropArea.style.display = ''; fileInfo.style.display = 'none'; succ.hide(); actionBtn.disabled = true; }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE NUMBERS
// ════════════════════════════════════════════════════════════════════════════
function buildPageNumbers(c) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to add page numbers',
    icon: '🔢',
    onFiles: ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-item';
  fileInfo.style.display = 'none';
  c.appendChild(fileInfo);

  const opts = makeOptions(c, 'Numbering Options');

  const posSelect = makeSelect([
    ['bottom-center', 'Bottom Center'],
    ['bottom-left',   'Bottom Left'],
    ['bottom-right',  'Bottom Right'],
    ['top-center',    'Top Center'],
    ['top-left',      'Top Left'],
    ['top-right',     'Top Right'],
  ], 'bottom-center');
  addOptionRow(opts, 'Position:', posSelect);

  const startInput = makeInput('number', '1', '1');
  startInput.min = '1';
  addOptionRow(opts, 'Start number:', startInput);

  const sizeInput = makeInput('number', '11', '11');
  sizeInput.min = '6'; sizeInput.max = '24';
  addOptionRow(opts, 'Font size:', sizeInput);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '🔢 Add Page Numbers');
  actionBtn.disabled = true;

  actionBtn.addEventListener('click', async () => {
    if (!wasmReady || !pdfFile) return;
    actionBtn.disabled = true;
    prog.show(50, 'Adding page numbers…');
    try {
      const data = await readFile(pdfFile);
      const pos = posSelect.value;
      const start = parseInt(startInput.value) || 1;
      const size = parseFloat(sizeInput.value) || 11;
      const result = Wasm.add_page_numbers(data, pos, start, size);
      prog.show(100, 'Done!');
      prog.hide();
      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({
        title: 'Page Numbers Added!',
        subtitle: `Starting from ${start} at ${pos}`,
        downloads: [{ url, name: 'numbered.pdf', label: 'numbered.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  });

  c.addEventListener('click', e => {
    if (e.target?.id === 'succ-again-btn') { pdfFile = null; dropArea.style.display = ''; fileInfo.style.display = 'none'; succ.hide(); actionBtn.disabled = true; }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PROTECT
// ════════════════════════════════════════════════════════════════════════════
function buildProtect(c) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to protect',
    icon: '🔒',
    onFiles: ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-item';
  fileInfo.style.display = 'none';
  c.appendChild(fileInfo);

  const opts = makeOptions(c, 'Password');
  const passInput = makeInput('password', 'Enter password…', '');
  passInput.autocomplete = 'new-password';
  addOptionRow(opts, 'Password:', passInput);
  const pass2Input = makeInput('password', 'Confirm password…', '');
  pass2Input.autocomplete = 'new-password';
  addOptionRow(opts, 'Confirm:', pass2Input);

  const warn = document.createElement('p');
  warn.style.cssText = 'font-size:.78rem;color:var(--text-muted);margin-top:10px;padding:10px;background:rgba(233,64,87,.06);border-radius:8px;border-left:3px solid var(--accent)';
  warn.textContent = '⚠️ This uses a local protection mechanism. For industry-standard AES encryption, use a native PDF editor.';
  opts.appendChild(warn);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '🔒 Protect PDF');
  actionBtn.disabled = true;

  actionBtn.addEventListener('click', async () => {
    if (!pdfFile) return;
    const pw = passInput.value;
    if (!pw) { showToast('Enter a password', 'error'); return; }
    if (pw !== pass2Input.value) { showToast('Passwords do not match', 'error'); return; }
    actionBtn.disabled = true;
    prog.show(50, 'Applying protection…');
    try {
      const data = await readFile(pdfFile);
      const result = await encryptPDF(data, pw);
      prog.show(100, 'Done!');
      prog.hide();
      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({
        title: 'PDF Protected!',
        subtitle: pdfFile.name,
        downloads: [{ url, name: 'protected.pdf', label: 'protected.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  });

  c.addEventListener('click', e => {
    if (e.target?.id === 'succ-again-btn') { pdfFile = null; dropArea.style.display = ''; fileInfo.style.display = 'none'; succ.hide(); actionBtn.disabled = true; passInput.value = ''; pass2Input.value = ''; }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// UNLOCK
// ════════════════════════════════════════════════════════════════════════════
function buildUnlock(c) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a protected PDF to unlock',
    icon: '🔓',
    onFiles: ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-item';
  fileInfo.style.display = 'none';
  c.appendChild(fileInfo);

  const opts = makeOptions(c, 'Password');
  const passInput = makeInput('password', 'Enter PDF password…', '');
  passInput.autocomplete = 'current-password';
  addOptionRow(opts, 'Password:', passInput);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '🔓 Unlock PDF');
  actionBtn.disabled = true;

  actionBtn.addEventListener('click', async () => {
    if (!pdfFile) return;
    actionBtn.disabled = true;
    prog.show(50, 'Unlocking…');
    try {
      const data = await readFile(pdfFile);
      const result = await decryptPDF(data, passInput.value);
      prog.show(100, 'Done!');
      prog.hide();
      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({
        title: 'PDF Unlocked!',
        subtitle: pdfFile.name,
        downloads: [{ url, name: 'unlocked.pdf', label: 'unlocked.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  });

  c.addEventListener('click', e => {
    if (e.target?.id === 'succ-again-btn') { pdfFile = null; dropArea.style.display = ''; fileInfo.style.display = 'none'; succ.hide(); actionBtn.disabled = true; passInput.value = ''; }
  });
}

// ── PDF.js lazy loader ────────────────────────────────────────────────────
let pdfjsCache = null;
async function loadPdfJs() {
  if (pdfjsCache) return pdfjsCache;
  const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
  pdfjsCache = pdfjsLib;
  return pdfjsLib;
}
