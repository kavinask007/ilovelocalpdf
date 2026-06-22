import { showToast, fmtSize, readFile, makeDropZone, makeProgress, makeSuccess, makeActionBtn, makeFileInfoEl, onAgain, makeActionRunner } from '../base.js';

export function buildRepair(c, Wasm) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a damaged PDF to repair', icon: '🔧',
    onFiles: ([f]) => {
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
  const actionBtn = makeActionBtn(c, '🔧 Repair PDF');
  actionBtn.disabled = true;

  const cleanAction = makeActionRunner({ actionBtn, cb: async () => {
    if (!Wasm.wasmReady || !pdfFile) return;
    actionBtn.disabled = true;
    prog.show(50, 'Repairing…');
    const data = await readFile(pdfFile);
    const result = Wasm.repair_pdf(data);
    prog.hide();
    const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
    succ.show({ title: 'PDF Repaired!', subtitle: pdfFile.name, downloads: [{ url, name: 'repaired.pdf', label: 'repaired.pdf' }] });
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
