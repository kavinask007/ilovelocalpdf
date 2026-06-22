import { showToast, fmtSize, readFile, makeDropZone, makeProgress, makeSuccess, makeActionBtn, makeOptions, makeRadioGroup, makeInput, addOptionRow, makeFileInfoEl, onAgain, makeActionRunner } from '../base.js';

export function buildRotate(c, Wasm) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to rotate', icon: '🔄',
    onFiles: ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      actionBtn.disabled = false;
    },
  });

  const fileInfo = makeFileInfoEl(c);

  const opts = makeOptions(c, 'Rotation Options');
  const angleGroup = makeRadioGroup(opts, 'rot-angle', [['90', '↻ 90°'], ['180', '↺ 180°'], ['270', '↻ 270°']], '90');
  opts.appendChild(angleGroup);
  const pagesInput = makeInput('text', 'all', 'all');
  addOptionRow(opts, 'Pages (e.g. 1,3 or "all"):', pagesInput);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '🔄 Rotate PDF');
  actionBtn.disabled = true;

  const cleanAction = makeActionRunner({ actionBtn, cb: async () => {
    if (!Wasm.wasmReady || !pdfFile) return;
    actionBtn.disabled = true;
    prog.show(40, 'Rotating…');
    const data = await readFile(pdfFile);
    const angle = parseInt(opts.querySelector('input[name=rot-angle]:checked')?.value || '90');
    const pagesVal = pagesInput.value.trim() || 'all';

    // Validate page numbers if not "all"
    if (pagesVal !== 'all') {
      const nums = pagesVal.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      const pageCount = Wasm.get_page_count(data);
      for (const n of nums) {
        if (n < 1 || n > pageCount) {
          showToast(`Invalid page number: ${n}. PDF has ${pageCount} pages.`, 'error');
          return;
        }
      }
    }

    const result = pagesVal === 'all'
      ? Wasm.rotate_pdf(data, angle, 'all')
      : Wasm.rotate_pdf(data, angle, JSON.stringify(pagesVal.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))));
    prog.show(100, 'Done!');
    prog.hide();
    const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
    succ.show({ title: `Rotated ${angle}°!`, subtitle: pdfFile.name, downloads: [{ url, name: 'rotated.pdf', label: 'rotated.pdf' }] });
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
