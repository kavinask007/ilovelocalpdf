import { showToast, fmtSize, readFile, makeDropZone, makeProgress, makeSuccess, makeActionBtn } from '../base.js';

export function buildMerge(c, Wasm) {
  let files = [];
  let dragIdx = null;

  const dropArea = makeDropZone(c, {
    multiple: true, label: 'Drop PDFs here to merge', sublabel: 'Select 2 or more PDF files', icon: '🔗',
    onFiles: picked => { files.push(...picked); refresh(); },
  });

  const addMoreBtn = document.createElement('button');
  addMoreBtn.className = 'btn-secondary';
  addMoreBtn.style.display = 'none';
  addMoreBtn.innerHTML = '➕ Add More PDFs';
  const addInp = document.createElement('input');
  addInp.type = 'file'; addInp.accept = '.pdf'; addInp.multiple = true; addInp.style.display = 'none';
  const addInpChange = () => { files.push(...addInp.files); refresh(); addInp.value = ''; };
  addInp.addEventListener('change', addInpChange);
  const addMoreClick = () => addInp.click();
  addMoreBtn.addEventListener('click', addMoreClick);
  c.appendChild(addMoreBtn); c.appendChild(addInp);

  const fileListEl = document.createElement('div');
  c.appendChild(fileListEl);

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '🔗 Merge PDFs');

  function refresh() {
    fileListEl.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'file-list';
    files.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'file-item file-item-draggable';
      item.draggable = true;
      item.dataset.idx = i;
      item.innerHTML = `
        <span class="file-item-icon">📄</span>
        <div class="file-item-info">
          <div class="file-item-name" title="${f.name}">${i + 1}. ${f.name}</div>
          <div class="file-item-size">${fmtSize(f.size)}</div>
        </div>
        <span class="file-drag-handle" aria-hidden="true">↕</span>
        <button class="file-item-remove" aria-label="Remove ${f.name}">✕</button>
      `;
      item.addEventListener('dragstart', () => { dragIdx = i; item.classList.add('dragging'); });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drag-target'); });
      item.addEventListener('dragleave', () => item.classList.remove('drag-target'));
      item.addEventListener('drop', e => {
        e.preventDefault();
        item.classList.remove('drag-target');
        if (dragIdx === null || dragIdx === i) return;
        const [moved] = files.splice(dragIdx, 1);
        files.splice(i, 0, moved);
        dragIdx = null;
        refresh();
      });
      const remBtn = item.querySelector('.file-item-remove');
      remBtn.addEventListener('click', () => { files.splice(i, 1); refresh(); });
      list.appendChild(item);
    });
    fileListEl.appendChild(list);
    actionBtn.disabled = files.length < 2;
    dropArea.style.display = files.length ? 'none' : '';
    addMoreBtn.style.display = files.length ? '' : 'none';
  }

  const actionClick = async () => {
    if (!Wasm.wasmReady) return showToast('WASM not ready yet', 'error');
    actionBtn.disabled = true;
    prog.show(30, 'Reading files…');
    try {
      const arr = new globalThis.Array();
      for (let i = 0; i < files.length; i++) {
        prog.show(30 + Math.round((i / files.length) * 40), `Loading ${files[i].name}…`);
        arr.push(await readFile(files[i]));
      }
      prog.show(80, 'Merging…');
      const result = Wasm.merge_pdfs(arr);
      prog.show(100, 'Done!');
      prog.hide();
      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({
        title: 'PDFs Merged Successfully!',
        subtitle: `Combined ${files.length} files → ${fmtSize(result.length)}`,
        downloads: [{ url, name: 'merged.pdf', label: 'merged.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('Merge failed: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  };
  actionBtn.addEventListener('click', actionClick);

  const againHandler = e => {
    if (e.target?.id === 'succ-again-btn') {
      files = []; succ.hide(); refresh();
    }
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
