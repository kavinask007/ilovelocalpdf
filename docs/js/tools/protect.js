import { showToast, fmtSize, readFile, makeDropZone, makeProgress, makeSuccess, makeActionBtn, makeOptions, addOptionRow, makeInput, makeFileInfoEl } from '../base.js';

export function buildProtect(c, Wasm) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to protect', icon: '🔒',
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
  const passInput = makeInput('password', 'Enter password…', '');
  passInput.autocomplete = 'new-password';
  addOptionRow(opts, 'Password:', passInput);
  const pass2Input = makeInput('password', 'Confirm password…', '');
  pass2Input.autocomplete = 'new-password';
  addOptionRow(opts, 'Confirm:', pass2Input);

  const warn = document.createElement('p');
  warn.style.cssText = 'font-size:.78rem;color:var(--text-muted);margin-top:10px;padding:10px;background:rgba(233,64,87,.06);border-radius:8px;border-left:3px solid var(--accent)';
  warn.textContent = '🔐 AES-256-CBC encryption (PDF 2.0 standard). Opens with any PDF viewer using the correct password.';
  opts.appendChild(warn);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '🔒 Protect PDF');
  actionBtn.disabled = true;

  const actionClick = async () => {
    if (!pdfFile) return;
    const pw = passInput.value;
    if (!pw) { showToast('Enter a password', 'error'); return; }
    if (pw.length < 4) { showToast('Password must be at least 4 characters', 'error'); return; }
    if (pw !== pass2Input.value) { showToast('Passwords do not match', 'error'); return; }
    actionBtn.disabled = true;
      prog.show(50, 'Encrypting (AES-256-CBC)…');
    try {
      const data = await readFile(pdfFile);
      const result = Wasm.protect_pdf(data, pw);
      prog.show(100, 'Done!');
      prog.hide();
      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({
        title: 'PDF Protected!',
        subtitle: 'Encrypted with AES-256-CBC. Opens with any PDF viewer.',
        downloads: [{ url, name: 'protected.pdf', label: 'protected.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  };
  actionBtn.addEventListener('click', actionClick);

  const againHandler = e => {
    if (e.target?.id === 'succ-again-btn') { pdfFile = null; dropArea.style.display = ''; fileInfo.style.display = 'none'; succ.hide(); actionBtn.disabled = true; passInput.value = ''; pass2Input.value = ''; }
  };
  c.addEventListener('click', againHandler);

  return () => {
    dropArea.cleanup();
    actionBtn.removeEventListener('click', actionClick);
    c.removeEventListener('click', againHandler);
    c.innerHTML = '';
  };
}
