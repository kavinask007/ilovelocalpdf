import { showToast, fmtSize, readFile, makeDropZone, makeProgress, makeSuccess, makeActionBtn, makeFileInfoEl, onAgain, makeActionRunner } from '../base.js';

export function buildCompress(c, Wasm) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to compress', icon: '📦',
    onFiles: async ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = makeFileInfoEl(c);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '📦 Compress PDF');
  actionBtn.disabled = true;

  const cleanAction = makeActionRunner({ actionBtn, cb: async () => {
    if (!Wasm.wasmReady || !pdfFile) return;
    actionBtn.disabled = true;
    prog.show(30, 'Reading PDF…');
    const data = await readFile(pdfFile);
    prog.show(40, 'Analyzing resources…');
    await new Promise(r => setTimeout(r, 0));
    prog.show(55, 'Deduplicating fonts & streams…');
    await new Promise(r => setTimeout(r, 0));
    prog.show(70, 'Recompressing & optimizing…');
    const result = Wasm.compress_pdf(data);
    prog.show(100, 'Done!');
    prog.hide();
    const saved = data.length - result.length;
    const pct = ((saved / data.length) * 100).toFixed(1);
    const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
    succ.show({
      title: saved > 0 ? `Reduced by ${pct}%!` : 'No reduction possible',
      subtitle: saved > 0 ? `${fmtSize(data.length)} → ${fmtSize(result.length)}` : 'This PDF is already optimized.',
      downloads: [{ url, name: 'compressed.pdf', label: 'compressed.pdf' }],
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
