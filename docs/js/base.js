// ── Shared UI components and utilities ─────────────────────────────────

const toastEl = document.getElementById('global-toast');
let toastTimer;

export function showToast(msg, type = 'info', duration = 3500) {
  toastEl.innerHTML = (type === 'error' ? '❌ ' : type === 'success' ? '✅ ' : 'ℹ️ ') + msg;
  toastEl.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

export function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function readFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(new Uint8Array(e.target.result));
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });
}

export function downloadBlob(data, filename, mime = 'application/pdf') {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.addEventListener('click', () => setTimeout(() => URL.revokeObjectURL(url), 1000));
  a.click();
}

// ── Drop zone ──────────────────────────────────────────────────────────
export function makeDropZone(container, opts = {}) {
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
  const uid = Math.random().toString(36).slice(2);
  dz.innerHTML = `
    <span class="drop-icon">${icon}</span>
    <div class="drop-title">${label}</div>
    <div class="drop-subtitle">${sublabel}</div>
    <button class="btn-select" type="button">
      <span>📂</span> Choose File${multiple ? 's' : ''}
    </button>
    <input type="file" accept="${accept}" ${multiple ? 'multiple' : ''} style="display:none" />
  `;
  container.appendChild(dz);

  const input = dz.querySelector('input[type=file]');
  const btn = dz.querySelector('button');

  const clicks = [];
  const cleanups = [];

  const btnClick = () => input.click();
  btn.addEventListener('click', btnClick);
  cleanups.push(() => btn.removeEventListener('click', btnClick));

  const dzClick = e => { if (e.target === dz) input.click(); };
  dz.addEventListener('click', dzClick);
  cleanups.push(() => dz.removeEventListener('click', dzClick));

  const LARGE_FILE_MB = 50;
  const change = () => {
    if (input.files.length) {
      for (const f of input.files) {
        if (f.size > LARGE_FILE_MB * 1024 * 1024) {
          showToast(`⚠️ Large file (${fmtSize(f.size)}). Processing may be slow or cause memory issues.`, 'info', 5000);
        }
      }
      onFiles([...input.files]);
    }
    input.value = '';
  };
  input.addEventListener('change', change);
  cleanups.push(() => input.removeEventListener('change', change));

  const dragover = e => { e.preventDefault(); dz.classList.add('drag-over'); };
  const dragleave = () => dz.classList.remove('drag-over');
  const drop = e => {
    e.preventDefault();
    dz.classList.remove('drag-over');
    const files = [...e.dataTransfer.files].filter(f => {
      if (accept === '.pdf') return f.type === 'application/pdf' || f.name.endsWith('.pdf');
      return true;
    });
    if (files.length) {
      for (const f of files) {
        if (f.size > LARGE_FILE_MB * 1024 * 1024) {
          showToast(`⚠️ Large file (${fmtSize(f.size)}). Processing may be slow or cause memory issues.`, 'info', 5000);
        }
      }
      onFiles(files);
    }
  };
  dz.addEventListener('dragover', dragover);
  dz.addEventListener('dragleave', dragleave);
  dz.addEventListener('drop', drop);
  cleanups.push(() => {
    dz.removeEventListener('dragover', dragover);
    dz.removeEventListener('dragleave', dragleave);
    dz.removeEventListener('drop', drop);
  });

  dz.cleanup = () => cleanups.forEach(fn => fn());
  return dz;
}

// ── File list ──────────────────────────────────────────────────────────
export function makeFileList(container, items, onRemove) {
  const list = document.createElement('div');
  list.className = 'file-list';
  const cleanups = [];
  items.forEach((f, i) => {
    const name = f.name || f;
    const size = f.size || 0;
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <span class="file-item-icon">${name.endsWith('.pdf') ? '📄' : '🖼️'}</span>
      <div class="file-item-info">
        <div class="file-item-name" title="${name}">${name}</div>
        <div class="file-item-size">${fmtSize(size)}</div>
      </div>
      <button class="file-item-remove" aria-label="Remove ${name}">✕</button>
    `;
    const remBtn = item.querySelector('.file-item-remove');
    const remClick = () => onRemove(i);
    remBtn.addEventListener('click', remClick);
    cleanups.push(() => remBtn.removeEventListener('click', remClick));
    list.appendChild(item);
  });
  container.appendChild(list);
  list.cleanup = () => cleanups.forEach(fn => fn());
  return list;
}

// ── Range editor ──────────────────────────────────────────────────────
export function makeRangeRows(container, opts = {}) {
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
    const remClick = () => { row.remove(); enforceMinRows(); };
    rem.addEventListener('click', remClick);
    row._remCleanup = () => rem.removeEventListener('click', remClick);
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

  const addClick = () => createRow();
  addBtn.addEventListener('click', addClick);
  enforceMinRows();

  wrap._cleanup = () => {
    addBtn.removeEventListener('click', addClick);
    rowsEl.querySelectorAll('.range-row').forEach(row => {
      if (row._remCleanup) row._remCleanup();
    });
  };

  return { wrap, rowsEl, addRow: createRow, getRanges, cleanup: () => wrap._cleanup() };
}

export function validateRanges(ranges, pageCount) {
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

// ── Progress bar ──────────────────────────────────────────────────────
export function makeProgress(container) {
  const wrap = document.createElement('div');
  wrap.className = 'progress-wrap';
  wrap.innerHTML = `
    <div class="progress-bar-track"><div class="progress-bar-fill"></div></div>
    <div class="progress-text">Processing…</div>
  `;
  container.appendChild(wrap);
  const fill = wrap.querySelector('.progress-bar-fill');
  const text = wrap.querySelector('.progress-text');
  return {
    el: wrap,
    show(pct, msg) {
      wrap.classList.add('visible');
      fill.style.width = pct + '%';
      text.textContent = msg || 'Processing…';
    },
    hide() { wrap.classList.remove('visible'); },
  };
}

// ── Success state ─────────────────────────────────────────────────────
export function makeSuccess(container) {
  const s = document.createElement('div');
  s.className = 'success-state';
  container.appendChild(s);
  const blobUrls = [];
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
            <iframe class="success-preview-frame" src="${firstPdf.url}" title="PDF Preview"></iframe>
          </div>
        ` : ''}
        ${downloads.map(d => `<div><a class="btn-download" href="${d.url}" download="${d.name}">⬇️ Download ${d.label}</a></div>`).join('')}
        <button class="btn-secondary" id="succ-again-btn" style="max-width:240px;margin:12px auto 0">🔄 Process Another</button>
      `;
      downloads.forEach(d => { if (d.url) blobUrls.push(d.url); });
      s.querySelectorAll('.btn-download').forEach(el => {
        el.addEventListener('click', () => {
          const idx = blobUrls.indexOf(el.href);
          if (idx !== -1) blobUrls.splice(idx, 1);
          setTimeout(() => URL.revokeObjectURL(el.href), 1000);
        }, { once: true });
      });
      s.classList.add('visible');
    },
    hide() {
      s.classList.remove('visible');
      s.innerHTML = '';
      blobUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
    },
  };
}

// ── Action button ─────────────────────────────────────────────────────
export function makeActionBtn(container, label) {
  const btn = document.createElement('button');
  btn.className = 'btn-action';
  btn.disabled = true;
  btn.innerHTML = `<span>${label}</span>`;
  container.appendChild(btn);
  return btn;
}

// ── Options panel ────────────────────────────────────────────────────
export function makeOptions(container, title = 'Options') {
  const panel = document.createElement('div');
  panel.className = 'options-panel';
  panel.innerHTML = `<div class="options-title">${title}</div>`;
  container.appendChild(panel);
  return panel;
}

export function addOptionRow(panel, labelText, inputEl) {
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

export function makeSelect(options, defaultVal) {
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

export function makeInput(type = 'text', placeholder = '', value = '') {
  const inp = document.createElement('input');
  inp.type = type;
  inp.className = 'option-input';
  inp.placeholder = placeholder;
  inp.value = value;
  return inp;
}

export function makeRadioGroup(container, name, options, defaultVal) {
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

// ── PDF.js loader (local, not CDN) ───────────────────────────────────
let pdfjsCache = null;
export async function loadPdfJs() {
  if (pdfjsCache) return pdfjsCache;
  const pdfjsLib = await import('./pdfjs/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  pdfjsCache = pdfjsLib;
  return pdfjsLib;
}

export function makeFileInfoEl(container) {
  const el = document.createElement('div');
  el.className = 'file-item';
  el.style.display = 'none';
  container.appendChild(el);
  return el;
}

export function makePageCountEl(container) {
  const el = document.createElement('p');
  el.style.cssText = 'color:var(--text-muted);font-size:.85rem;margin:10px 0';
  container.appendChild(el);
  return el;
}

// ── Common "again" handler ──────────────────────────────────────────
// Attaches a click listener to the container that resets state when
// the "Process Another" button (#succ-again-btn) is clicked.
export function onAgain(container, resetFn) {
  const handler = e => {
    if (e.target?.id === 'succ-again-btn') resetFn();
  };
  container.addEventListener('click', handler);
  return () => container.removeEventListener('click', handler);
}

// ── Action wrapper ──────────────────────────────────────────────────
// Wraps the common try/catch/progress pattern used by all tools.
// The callback manages its own button state and progress; the runner
// only provides the shared catch block for error handling.
export function makeActionRunner({ actionBtn, cb }) {
  const onClick = async () => {
    try {
      await cb();
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  };
  actionBtn.addEventListener('click', onClick);
  return () => actionBtn.removeEventListener('click', onClick);
}
