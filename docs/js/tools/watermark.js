import { showToast, fmtSize, readFile, makeDropZone, makeProgress, makeSuccess, makeActionBtn, makeOptions, addOptionRow, makeInput, makeSelect, makeFileInfoEl, onAgain, makeActionRunner } from '../base.js';

export function buildWatermark(c, Wasm) {
  let pdfFile = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to watermark', icon: '💧',
    onFiles: async ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      fileInfo.textContent = `📄 ${f.name} — ${fmtSize(f.size)}`;
      fileInfo.style.display = '';
      try {
        const data = await readFile(f);
        const pages = Wasm.get_page_count(data);
        fileInfo.textContent += ` — ${pages} page${pages !== 1 ? 's' : ''}`;
      } catch(e) { showToast('Could not read PDF: ' + e, 'error'); pdfFile = null; return; }
      actionBtn.disabled = false;
    },
  });

  const fileInfo = makeFileInfoEl(c);

  const opts = makeOptions(c, 'Watermark Options');
  const textInput = makeInput('text', 'CONFIDENTIAL', 'CONFIDENTIAL');
  addOptionRow(opts, 'Watermark text:', textInput);
  const posSelect = makeSelect([['diagonal','Diagonal (default)'],['center','Center'],['top','Top'],['bottom','Bottom']], 'diagonal');
  addOptionRow(opts, 'Position:', posSelect);
  const opacityWrap = document.createElement('div');
  opacityWrap.className = 'slider-wrap';
  const opacityRange = document.createElement('input');
  opacityRange.type = 'range'; opacityRange.min = '5'; opacityRange.max = '100'; opacityRange.value = '30';
  opacityRange.className = 'option-range';
  const opacityVal = document.createElement('span');
  opacityVal.className = 'slider-val';
  opacityVal.textContent = '30%';
  opacityRange.addEventListener('input', () => opacityVal.textContent = opacityRange.value + '%');
  opacityWrap.appendChild(opacityRange);
  opacityWrap.appendChild(opacityVal);
  addOptionRow(opts, 'Opacity:', opacityWrap);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '💧 Add Watermark');
  actionBtn.disabled = true;

  const cleanAction = makeActionRunner({ actionBtn, cb: async () => {
    if (!Wasm.wasmReady || !pdfFile) return;
    actionBtn.disabled = true;
    prog.show(50, 'Adding watermark…');
    const text = textInput.value.trim() || 'WATERMARK';
    const opacity = parseInt(opacityRange.value) / 100;
    const pos = posSelect.value;
    const data = await readFile(pdfFile);
    const result = Wasm.add_watermark(data, text, opacity, pos);
    prog.hide();
    const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
    succ.show({ title: 'Watermark Added!', subtitle: `"${text}" at ${opacity * 100}% opacity`, downloads: [{ url, name: 'watermarked.pdf', label: 'watermarked.pdf' }] });
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
