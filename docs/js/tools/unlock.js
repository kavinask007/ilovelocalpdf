import { showToast, fmtSize, readFile, makeDropZone, makeProgress, makeSuccess, makeActionBtn, makeOptions, addOptionRow, makeInput, makeFileInfoEl, onAgain, makeActionRunner } from '../base.js';

export function buildUnlock(c, Wasm) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a protected PDF to unlock', icon: '🔓',
    onFiles: ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = makeFileInfoEl(c);

  const opts = makeOptions(c, 'Password');
  const passInput = makeInput('password', 'Enter PDF password…', '');
  passInput.autocomplete = 'current-password';
  addOptionRow(opts, 'Password:', passInput);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '🔓 Unlock PDF');
  actionBtn.disabled = true;

  const cleanAction = makeActionRunner({ actionBtn, cb: async () => {
    if (!pdfFile) return;
    const pw = passInput.value;
    if (!pw) { showToast('Enter the password', 'error'); return; }
    actionBtn.disabled = true;
    prog.show(30, 'Decrypting (AES-256-CBC)…');
    const data = await readFile(pdfFile);
    const result = Wasm.unlock_pdf(data, pw);
    prog.hide();
    const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
    succ.show({ title: 'PDF Unlocked!', subtitle: 'Password removed — standard PDF ready to use.', downloads: [{ url, name: 'unlocked.pdf', label: 'unlocked.pdf' }] });
  }});

  const cleanAgain = onAgain(c, () => {
    pdfFile = null; dropArea.style.display = ''; fileInfo.style.display = 'none'; succ.hide(); actionBtn.disabled = true; passInput.value = '';
  });

  return () => {
    dropArea.cleanup();
    cleanAction();
    cleanAgain();
    c.innerHTML = '';
  };
}
