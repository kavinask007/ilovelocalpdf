import { showToast, fmtSize, readFile, makeDropZone, makeProgress, makeSuccess, makeActionBtn, makeOptions, addOptionRow, makeSelect, makeFileInfoEl, onAgain, makeActionRunner } from '../base.js';

export function buildNup(c, Wasm) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to create N-up layout', sublabel: 'Generate 2-up or 4-up A4 landscape sheets', icon: '📖',
    onFiles: ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = makeFileInfoEl(c);

  const opts = makeOptions(c, 'Layout Options');
  const layoutSelect = makeSelect([['2', 'Side-by-Side (2 pages per sheet)'], ['4', 'Grid (4 pages per sheet)']], '2');
  addOptionRow(opts, 'Layout Style:', layoutSelect);
  const sizeSelect = makeSelect([['a4-landscape', 'A4 Landscape (841.89 × 595.28 pt)']], 'a4-landscape');
  sizeSelect.disabled = true;
  addOptionRow(opts, 'Sheet Size:', sizeSelect);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '📖 Generate Booklet PDF');
  actionBtn.disabled = true;

  const cleanAction = makeActionRunner({ actionBtn, cb: async () => {
    if (!Wasm.wasmReady || !pdfFile) return;
    actionBtn.disabled = true;
    prog.show(30, 'Reading PDF…');
    const data = await readFile(pdfFile);
    const nup = parseInt(layoutSelect.value, 10);
    prog.show(70, `Building ${nup}-up layout…`);
    const result = Wasm.nup_pdf(data, nup);
    prog.hide();
    const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
    succ.show({
      title: 'Booklet PDF Generated!', subtitle: 'A4 landscape booklet layout ready',
      downloads: [{ url, name: nup === 2 ? 'booklet_side_by_side.pdf' : 'booklet_grid.pdf', label: nup === 2 ? 'booklet_side_by_side.pdf' : 'booklet_grid.pdf' }],
    });
  }});

  const cleanAgain = onAgain(c, () => {
    pdfFile = null; dropArea.style.display = ''; fileInfo.style.display = 'none'; succ.hide(); actionBtn.disabled = true;
  });

  return () => {
    dropArea.cleanup();
    cleanAction();
    cleanAgain();
    c.innerHTML = '';
  };
}
