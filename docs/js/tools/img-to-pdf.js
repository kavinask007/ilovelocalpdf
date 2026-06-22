import { showToast, fmtSize, readFile, makeDropZone, makeProgress, makeSuccess, makeActionBtn, makeFileList } from '../base.js';

export function buildImgToPdf(c, Wasm) {
  let files = [];

  const dropArea = makeDropZone(c, {
    accept: '.jpg,.jpeg,.png,.webp,.bmp,.gif', multiple: true,
    label: 'Drop images here', sublabel: 'JPG, PNG, WebP, BMP supported', icon: '🖼️',
    onFiles: picked => { files.push(...picked); refresh(); },
  });

  const fileListEl = document.createElement('div');
  c.appendChild(fileListEl);

  const addMoreBtn = document.createElement('button');
  addMoreBtn.className = 'btn-secondary';
  addMoreBtn.style.display = 'none';
  addMoreBtn.innerHTML = '➕ Add More Images';
  const addInp = document.createElement('input');
  addInp.type = 'file'; addInp.accept = '.jpg,.jpeg,.png,.webp,.bmp,.gif'; addInp.multiple = true; addInp.style.display = 'none';
  const addInpChange = () => { files.push(...addInp.files); refresh(); addInp.value = ''; };
  addInp.addEventListener('change', addInpChange);
  const addMoreClick = () => addInp.click();
  addMoreBtn.addEventListener('click', addMoreClick);
  c.appendChild(addMoreBtn); c.appendChild(addInp);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '🖼️ Convert to PDF');
  actionBtn.disabled = true;

  function refresh() {
    fileListEl.innerHTML = '';
    makeFileList(fileListEl, files, idx => { files.splice(idx, 1); refresh(); });
    actionBtn.disabled = files.length === 0;
    dropArea.style.display = files.length ? 'none' : '';
    addMoreBtn.style.display = files.length ? '' : 'none';
  }

  const actionClick = async () => {
    if (!Wasm.wasmReady || !files.length) return;
    actionBtn.disabled = true;
    prog.show(20, 'Reading images…');
    try {
      const arr = new globalThis.Array();
      for (let i = 0; i < files.length; i++) {
        prog.show(20 + Math.round((i / files.length) * 60), `Processing ${files[i].name}…`);
        arr.push(await readFile(files[i]));
      }
      prog.show(90, 'Building PDF…');
      const result = Wasm.images_to_pdf(arr);
      prog.show(100, 'Done!');
      prog.hide();
      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({ title: `Created PDF from ${files.length} image${files.length > 1 ? 's' : ''}!`, subtitle: fmtSize(result.length), downloads: [{ url, name: 'images.pdf', label: 'images.pdf' }] });
    } catch (e) {
      prog.hide();
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  };
  actionBtn.addEventListener('click', actionClick);

  const againHandler = e => {
    if (e.target?.id === 'succ-again-btn') { files = []; succ.hide(); refresh(); }
  };
  c.addEventListener('click', againHandler);

  return () => {
    dropArea.cleanup();
    addInp.removeEventListener('change', addInpChange);
    addMoreBtn.removeEventListener('click', addMoreClick);
    actionBtn.removeEventListener('click', actionClick);
    c.removeEventListener('click', againHandler);
    c.innerHTML = '';
  };
}
