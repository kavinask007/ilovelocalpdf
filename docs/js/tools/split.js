import { showToast, fmtSize, readFile, makeDropZone, makeProgress, makeSuccess, makeActionBtn, makeOptions, makeRadioGroup, makeRangeRows, validateRanges, makeFileInfoEl, makePageCountEl } from '../base.js';

export function buildSplit(c, Wasm) {
  let pdfFile = null;
  let pageCount = 0;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to split', icon: '✂️',
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

  const fileInfo = makeFileInfoEl(c);
  const pageCountEl = makePageCountEl(c);

  const opts = makeOptions(c, 'Split Options');
  const splitModeGroup = makeRadioGroup(opts, 'split-mode', [
    ['range', '📐 Page Ranges'], ['each', '📑 Extract Each Page'], ['half', '⚡ Split in Half'],
  ], 'range');
  opts.appendChild(splitModeGroup);

  const rangeEditor = makeRangeRows(opts, {
    title: 'Page ranges', addLabel: 'Add Range', startLabel: 'From', endLabel: 'To',
    hint: 'Add one or more non-overlapping ranges.', minRows: 1,
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

  const modeChange = () => updateSplitPreview();
  splitModeGroup.addEventListener('change', modeChange);
  const inputUpdate = () => updateSplitPreview();
  rangeEditor.rowsEl.addEventListener('input', inputUpdate);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '✂️ Split PDF');
  actionBtn.disabled = true;

  const actionClick = async () => {
    if (!Wasm.wasmReady || !pdfFile) return;
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
      const BATCH = 20;
      const downloads = [];
      for (let i = 0; i < ranges.length; i += BATCH) {
        const batch = ranges.slice(i, i + BATCH);
        const pct = Math.round(40 + (i / ranges.length) * 55);
        prog.show(pct, `Splitting… batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(ranges.length / BATCH)}`);
        await new Promise(r => setTimeout(r, 0));
        const results = Wasm.split_pdf(data, JSON.stringify(batch));
        for (let j = 0; j < results.length; j++) {
          const buf = results[j];
          const url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
          const r = batch[j];
          downloads.push({ url, name: `split_p${r[0]}-${r[1]}.pdf`, label: `Part ${downloads.length + 1} (p.${r[0]}–${r[1]})` });
        }
      }
      prog.show(100, 'Done!');
      prog.hide();
      succ.show({ title: `Split into ${downloads.length} files!`, subtitle: pdfFile.name, downloads });
    } catch (e) {
      prog.hide();
      showToast('Split failed: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  };
  actionBtn.addEventListener('click', actionClick);

  const againHandler = e => {
    if (e.target?.id === 'succ-again-btn') {
      pdfFile = null; pageCount = 0; dropArea.style.display = ''; fileInfo.style.display = 'none'; pageCountEl.textContent = ''; succ.hide(); actionBtn.disabled = true;
    }
  };
  c.addEventListener('click', againHandler);

  return () => {
    dropArea.cleanup();
    splitModeGroup.removeEventListener('change', modeChange);
    rangeEditor.rowsEl.removeEventListener('input', inputUpdate);
    rangeEditor.cleanup();
    actionBtn.removeEventListener('click', actionClick);
    c.removeEventListener('click', againHandler);
    c.innerHTML = '';
  };
}
