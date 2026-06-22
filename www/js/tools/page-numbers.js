import { showToast, fmtSize, readFile, makeDropZone, makeProgress, makeSuccess, makeActionBtn, makeOptions, addOptionRow, makeInput, makeSelect, makeFileInfoEl } from '../base.js';

export function buildPageNumbers(c, Wasm) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to add page numbers', icon: '🔢',
    onFiles: ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = makeFileInfoEl(c);

  const opts = makeOptions(c, 'Numbering Options');
  const posSelect = makeSelect([
    ['bottom-center', 'Bottom Center'], ['bottom-left', 'Bottom Left'], ['bottom-right', 'Bottom Right'],
    ['top-center', 'Top Center'], ['top-left', 'Top Left'], ['top-right', 'Top Right'],
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

  const actionClick = async () => {
    if (!Wasm.wasmReady || !pdfFile) return;
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
      succ.show({ title: 'Page Numbers Added!', subtitle: `Starting from ${start} at ${pos}`, downloads: [{ url, name: 'numbered.pdf', label: 'numbered.pdf' }] });
    } catch (e) {
      prog.hide();
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  };
  actionBtn.addEventListener('click', actionClick);

  const againHandler = e => {
    if (e.target?.id === 'succ-again-btn') { pdfFile = null; dropArea.style.display = ''; fileInfo.style.display = 'none'; succ.hide(); actionBtn.disabled = true; }
  };
  c.addEventListener('click', againHandler);

  return () => {
    dropArea.cleanup();
    actionBtn.removeEventListener('click', actionClick);
    c.removeEventListener('click', againHandler);
    c.innerHTML = '';
  };
}
