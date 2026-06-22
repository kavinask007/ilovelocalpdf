import { showToast, readFile, makeDropZone, makeProgress, makeSuccess, makeActionBtn, loadPdfJs } from '../base.js';

export function buildOrganize(c, Wasm) {
  let pdfFile = null;
  let pageOrder = [];
  let dragPage = null;

  const dropArea = makeDropZone(c, {
    label: 'Drop a PDF to organize', icon: '📋',
    onFiles: async ([f]) => {
      pdfFile = f;
      dropArea.style.display = 'none';
      await loadPageThumbs(f);
      actionBtn.disabled = false;
    },
  });

  const thumbGrid = document.createElement('div');
  thumbGrid.className = 'page-grid';
  thumbGrid.style.display = 'none';
  c.appendChild(thumbGrid);

  const hint = document.createElement('p');
  hint.style.cssText = 'font-size:.78rem;color:var(--text-muted);text-align:center;margin:8px 0;';
  hint.textContent = 'Drag pages to reorder. Click ✕ to delete.';
  hint.style.display = 'none';
  c.appendChild(hint);

  let cachedData = null;

  async function loadPageThumbs(file) {
    thumbGrid.innerHTML = '';
    thumbGrid.style.display = 'grid';
    hint.style.display = '';
    cachedData = await readFile(file);
    const pageCount = Wasm.get_page_count(cachedData);
    pageOrder = Array.from({ length: pageCount }, (_, i) => i + 1);
    await renderThumbs(cachedData, pageCount);
  }

  async function renderThumbs(data, n) {
    thumbGrid.innerHTML = '';
    const pdfjsLib = await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: data.buffer }).promise;
    for (let i = 1; i <= n; i++) {
      const pageNum = pageOrder[i - 1];
      const thumb = document.createElement('div');
      thumb.className = 'page-thumb';
      thumb.draggable = true;
      thumb.dataset.page = String(pageNum);
      const canvas = document.createElement('canvas');
      thumb.appendChild(canvas);
      const label = document.createElement('div');
      label.className = 'page-thumb-label';
      label.textContent = `Page ${pageNum}`;
      thumb.appendChild(label);
      const delBtn = document.createElement('button');
      delBtn.className = 'page-thumb-delete';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        const p = parseInt(thumb.dataset.page, 10);
        const idx = pageOrder.indexOf(p);
        if (idx !== -1) pageOrder.splice(idx, 1);
        thumb.remove();
        updateThumbLabels();
        actionBtn.disabled = pageOrder.length === 0;
      });
      thumb.appendChild(delBtn);
      thumbGrid.appendChild(thumb);
      const page = await pdf.getPage(pageNum);
      const vp = page.getViewport({ scale: 0.3 });
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      setupDrag(thumb);
    }
    updateThumbLabels();
  }

  function updateThumbLabels() {
    [...thumbGrid.querySelectorAll('.page-thumb')].forEach((el, idx) => {
      const p = parseInt(el.dataset.page, 10);
      const label = el.querySelector('.page-thumb-label');
      label.textContent = `Page ${p} • #${idx + 1}`;
    });
  }

  function setupDrag(el) {
    el.addEventListener('dragstart', () => { dragPage = parseInt(el.dataset.page, 10); el.classList.add('dragging'); });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-target'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-target'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-target');
      if (!Number.isInteger(dragPage)) return;
      const targetPage = parseInt(el.dataset.page, 10);
      if (dragPage === targetPage) return;
      const dragIdx = pageOrder.indexOf(dragPage);
      const targetIdx = pageOrder.indexOf(targetPage);
      if (dragIdx < 0 || targetIdx < 0) return;
      const [moved] = pageOrder.splice(dragIdx, 1);
      pageOrder.splice(targetIdx, 0, moved);
      const draggedEl = thumbGrid.querySelector(`.page-thumb[data-page="${dragPage}"]`);
      const targetEl = thumbGrid.querySelector(`.page-thumb[data-page="${targetPage}"]`);
      if (draggedEl && targetEl) {
        if (dragIdx < targetIdx) targetEl.insertAdjacentElement('afterend', draggedEl);
        else targetEl.insertAdjacentElement('beforebegin', draggedEl);
      }
      updateThumbLabels();
      dragPage = null;
    });
  }

  const prog = makeProgress(c);
  const succ = makeSuccess(c);
  const actionBtn = makeActionBtn(c, '📋 Apply Order');
  actionBtn.disabled = true;

  const actionClick = async () => {
    if (!Wasm.wasmReady || !pdfFile) return;
    actionBtn.disabled = true;
    prog.show(40, 'Reorganizing pages…');
    try {
      const data = cachedData || await readFile(pdfFile);
      const result = Wasm.organize_pages(data, JSON.stringify(pageOrder));
      prog.show(100, 'Done!');
      prog.hide();
      const url = URL.createObjectURL(new Blob([result], { type: 'application/pdf' }));
      succ.show({
        title: 'Pages Reorganized!',
        subtitle: `${pageOrder.length} pages in new order`,
        downloads: [{ url, name: 'organized.pdf', label: 'organized.pdf' }],
      });
    } catch (e) {
      prog.hide();
      showToast('Error: ' + e.message, 'error');
      actionBtn.disabled = false;
    }
  };
  actionBtn.addEventListener('click', actionClick);

  const againHandler = e => {
    if (e.target?.id === 'succ-again-btn') {
      pdfFile = null; cachedData = null; pageOrder = []; thumbGrid.innerHTML = ''; thumbGrid.style.display = 'none'; hint.style.display = 'none'; dropArea.style.display = ''; succ.hide(); actionBtn.disabled = true;
    }
  };
  c.addEventListener('click', againHandler);

  return () => {
    dropArea.cleanup();
    actionBtn.removeEventListener('click', actionClick);
    c.removeEventListener('click', againHandler);
    c.innerHTML = '';
  };
}
