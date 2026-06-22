import { showToast, makeDropZone, makeProgress, makeSuccess, makeActionBtn, makeOptions, addOptionRow, makeSelect, makeFileInfoEl, loadPdfJs, onAgain, makeActionRunner } from '../base.js';

export function buildPdfToImg(c, Wasm) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to convert to images', icon: '📸',
    onFiles: ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = makeFileInfoEl(c);

  const opts = makeOptions(c, 'Export Options');
  const scaleSelect = makeSelect([['1','72 DPI (Low)'],['2','144 DPI (Medium)'],['3','216 DPI (High)'],['4','288 DPI (Very High)']], '2');
  addOptionRow(opts, 'Resolution:', scaleSelect);
  const fmtSelect = makeSelect([['png','PNG (lossless)'],['jpeg','JPEG (smaller)']], 'png');
  addOptionRow(opts, 'Format:', fmtSelect);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '📸 Convert to Images');
  actionBtn.disabled = true;

  const cleanAction = makeActionRunner({ actionBtn, cb: async () => {
    if (!pdfFile) return;
    actionBtn.disabled = true;
    prog.show(10, 'Loading PDF renderer…');
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
    prog.hide();
    succ.show({ title: `Exported ${n} image${n > 1 ? 's' : ''}!`, subtitle: `${scale * 72} DPI, ${fmt.toUpperCase()} format`, downloads });
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
