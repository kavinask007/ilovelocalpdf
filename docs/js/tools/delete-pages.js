import { showToast, fmtSize, readFile, makeDropZone, makeProgress, makeSuccess, makeActionBtn, makeOptions, makeRangeRows, validateRanges, makeFileInfoEl, makePageCountEl, onAgain, makeActionRunner } from '../base.js';

export function buildDeletePages(c, Wasm) {
  let pdfFile = null;
  let pageCount = 0;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to remove pages', icon: '🗑️',
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

  const fileInfo = makeFileInfoEl(c);
  const pageCountEl = makePageCountEl(c);

  const opts = makeOptions(c, 'Pages to Delete');
  const rangeEditor = makeRangeRows(opts, {
    title: 'Delete ranges', addLabel: 'Add Delete Range', startLabel: 'From', endLabel: 'To',
    hint: 'Each row supports single pages too (same from/to).', minRows: 1,
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

  const cleanAction = makeActionRunner({ actionBtn, cb: async () => {
    if (!Wasm.wasmReady || !pdfFile) return;
    const entries = rangeEditor.getRanges();
    const validation = validateRanges(entries, pageCount);
    if (!validation.ok) { showToast(validation.error, 'error'); return; }
    const pages = [];
    entries.forEach(r => { for (let p = r.from; p <= r.to; p++) pages.push(p); });
    if (pages.length >= pageCount) { showToast('Cannot delete all pages from the PDF.', 'error'); return; }
    actionBtn.disabled = true;
    prog.show(50, 'Removing pages…');
    const data = await readFile(pdfFile);
    const result = Wasm.delete_pages(data, JSON.stringify(pages));
    prog.hide();
    const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
    succ.show({ title: 'Pages Removed!', subtitle: `Deleted ${pages.length} page(s)`, downloads: [{ url, name: 'pages_removed.pdf', label: 'result.pdf' }] });
  }});

  const cleanAgain = onAgain(c, () => {
    pdfFile = null; dropArea.style.display = ''; fileInfo.style.display = 'none'; pageCountEl.textContent = ''; succ.hide(); actionBtn.disabled = true;
  });

  return () => {
    dropArea.cleanup();
    rangeEditor.cleanup();
    cleanAction();
    cleanAgain();
    c.innerHTML = '';
  };
}
