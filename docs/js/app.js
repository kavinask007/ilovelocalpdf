// ─── I❤️localpdf — Main App ──────────────────────────────────────────
// All PDF operations run via Rust WASM (lopdf + AES-GCM)
// Tool UIs are in separate modules under js/tools/

import init, * as Wasm from '../pkg/ilovelocalpdf.js';
import { showToast } from './base.js';
import { TOOLS, TOOL_SLUGS } from './tools-config.js';
import { buildMerge } from './tools/merge.js';
import { buildSplit } from './tools/split.js';
import { buildOrganize } from './tools/organize.js';
import { buildDeletePages } from './tools/delete-pages.js';
import { buildNup } from './tools/nup.js';
import { buildCompress } from './tools/compress.js';
import { buildRepair } from './tools/repair.js';
import { buildImgToPdf } from './tools/img-to-pdf.js';
import { buildPdfToImg } from './tools/pdf-to-img.js';
import { buildRotate } from './tools/rotate.js';
import { buildWatermark } from './tools/watermark.js';
import { buildPageNumbers } from './tools/page-numbers.js';
import { buildProtect } from './tools/protect.js';
import { buildUnlock } from './tools/unlock.js';
import {
  absoluteUrl,
  applyToolPageSeo,
  buildBreadcrumbJsonLd,
  buildHomeFooterSeoHtml,
  buildToolFooterSeoHtml,
  buildToolSeoSectionHtml,
} from './seo.js';

// ── State ────────────────────────────────────────────────────────────
export let wasmReady = false;
let currentTool = null;
let currentCleanup = null;

function getToolSlug(toolId) { return TOOL_SLUGS[toolId] || toolId; }
function getToolPagePath(toolId) { return `/${getToolSlug(toolId)}/`; }

function resolveToolId(raw) {
  if (!raw) return null;
  const slugToTool = Object.fromEntries(Object.entries(TOOL_SLUGS).map(([id, slug]) => [slug, id]));
  const normalized = decodeURIComponent(String(raw)).trim().toLowerCase().replace(/\.html$/i, '').replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized === 'tool' || normalized === 'index') return null;
  if (TOOLS[normalized]) return normalized;
  if (slugToTool[normalized]) return slugToTool[normalized];
  return null;
}

function getToolIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const byQuery = resolveToolId(params.get('tool'));
  if (byQuery) return byQuery;
  const segments = window.location.pathname.split('/').filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const byPath = resolveToolId(segments[i]);
    if (byPath) return byPath;
  }
  const byHash = resolveToolId(window.location.hash.replace(/^#/, ''));
  if (byHash) return byHash;
  const hrefMatch = window.location.href.match(/[?&#]tool=([^&#]+)/i);
  const byHref = resolveToolId(hrefMatch?.[1] || '');
  if (byHref) return byHref;
  return resolveToolId(sessionStorage.getItem('ilp:lastTool'));
}

function updateToolBreadcrumb(toolId, cfg) {
  const current = document.getElementById('tool-breadcrumb-current');
  if (current) current.textContent = cfg.title;
  let script = document.getElementById('tool-breadcrumb-jsonld');
  if (!script) {
    script = document.createElement('script');
    script.id = 'tool-breadcrumb-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(buildBreadcrumbJsonLd(cfg, toolId, getToolPagePath));
}

// ── Tool builders map ────────────────────────────────────────────────
const toolBuilders = {
  merge: buildMerge, split: buildSplit, organize: buildOrganize,
  'delete-pages': buildDeletePages, nup: buildNup, compress: buildCompress,
  repair: buildRepair, 'img-to-pdf': buildImgToPdf, 'pdf-to-img': buildPdfToImg,
  rotate: buildRotate, watermark: buildWatermark, 'page-numbers': buildPageNumbers,
  protect: buildProtect, unlock: buildUnlock,
};

function buildToolUI(toolId, container) {
  if (currentCleanup) { currentCleanup(); currentCleanup = null; }
  container.innerHTML = '';
  const builder = toolBuilders[toolId];
  if (builder) currentCleanup = builder(container, { get wasmReady() { return wasmReady; }, ...Wasm });
}

// ── Modal helpers ────────────────────────────────────────────────────
const overlay = document.getElementById('modal-overlay');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const modalBody = document.getElementById('modal-body');

function openModal(toolId) {
  if (!overlay || !modalBody) return;
  const cfg = TOOLS[toolId];
  if (!cfg) return;
  currentTool = toolId;
  modalIcon.textContent = cfg.icon;
  modalIcon.style.background = cfg.color + '22';
  modalTitle.textContent = cfg.title;
  modalSubtitle.textContent = cfg.sub;
  modalBody.innerHTML = '';
  buildToolUI(toolId, modalBody);
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  if (!overlay) return;
  if (currentCleanup) { currentCleanup(); currentCleanup = null; }
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  currentTool = null;
}

if (overlay) {
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

// ── Boot ─────────────────────────────────────────────────────────────
async function boot() {
  const overlay = document.getElementById('wasm-loading-overlay');
  try {
    await init();
    wasmReady = true;
    if (overlay) overlay.remove();
  } catch (e) {
    console.error('WASM init failed:', e);
    if (overlay) {
      overlay.innerHTML = `
        <div class="wasm-loading-inner">
          <p class="wasm-loading-text" style="color:var(--accent);">⚠️ Failed to load PDF engine</p>
          <p style="font-size:0.82rem;color:var(--text-muted);">${e.message}</p>
          <button class="btn-secondary" id="wasm-retry-btn" style="max-width:200px;">🔄 Retry</button>
        </div>
      `;
      document.getElementById('wasm-retry-btn')?.addEventListener('click', () => {
        overlay.innerHTML = `
          <div class="wasm-loading-inner">
            <div class="spinner" style="width:40px;height:40px;border-width:3px;"></div>
            <p class="wasm-loading-text">Retrying…</p>
          </div>
        `;
        boot();
      });
    }
    showToast('⚠️ WASM failed to load: ' + e.message, 'error');
  }
}
boot();

// ── Homepage tool card links ─────────────────────────────────────────
document.querySelectorAll('a.tool-card[data-tool]').forEach(card => {
  const id = card.dataset.tool;
  if (id && TOOLS[id]) card.setAttribute('href', getToolPagePath(id));
});

document.querySelectorAll('.tool-card').forEach(card => {
  if (card.tagName === 'A') {
    card.addEventListener('click', () => {
      const tool = card.dataset.tool;
      if (tool && TOOLS[tool]) sessionStorage.setItem('ilp:lastTool', tool);
    });
    return;
  }
  const activate = () => openModal(card.dataset.tool);
  card.addEventListener('click', activate);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
});

// ── Dedicated tool page ──────────────────────────────────────────────
const toolPageContainer = document.getElementById('tool-page-body');
if (toolPageContainer) {
  const toolId = getToolIdFromUrl() || 'merge';
  const cfg = toolId ? TOOLS[toolId] : null;
  if (cfg) {
    const pageTitle = document.getElementById('tool-page-title');
    const pageSubtitle = document.getElementById('tool-page-subtitle');
    const pageIcon = document.getElementById('tool-page-icon');
    if (pageTitle) pageTitle.textContent = cfg.title;
    if (pageSubtitle) pageSubtitle.textContent = cfg.sub;
    if (pageIcon) {
      pageIcon.textContent = cfg.icon;
      pageIcon.style.background = cfg.color + '22';
    }
    applyToolPageSeo(toolId, cfg, getToolPagePath);
    const toolPath = getToolPagePath(toolId);
    const expectedPath = new URL(toolPath, window.location.origin).pathname;
    if (window.location.pathname !== expectedPath || window.location.search) {
      window.history.replaceState({}, '', toolPath);
    }
    updateToolBreadcrumb(toolId, cfg);
    sessionStorage.setItem('ilp:lastTool', toolId);
    const seoTitle = document.getElementById('tool-seo-title');
    const seoBody = document.getElementById('tool-seo-body');
    if (seoTitle) seoTitle.textContent = `${cfg.title} — Free & Private`;
    if (seoBody) seoBody.innerHTML = buildToolSeoSectionHtml(toolId, cfg, getToolPagePath);
    const footerSeo = document.getElementById('footer-seo');
    if (footerSeo) footerSeo.innerHTML = buildToolFooterSeoHtml(toolId, cfg, getToolPagePath);
    currentTool = toolId;
    buildToolUI(toolId, toolPageContainer);
  } else {
    document.title = 'Tool Not Found - I❤️localpdf';
    const current = document.getElementById('tool-breadcrumb-current');
    if (current) current.textContent = 'Tool not found';
    toolPageContainer.innerHTML = `
      <p class="text-muted">This PDF tool could not be found. Browse our full list of free local PDF tools.</p>
      <a class="btn-secondary" href="index.html#tools-section">Browse free PDF tools</a>
    `;
  }
}

// ── Homepage SEO footer ──────────────────────────────────────────────
if (!toolPageContainer) {
  const footerSeo = document.getElementById('footer-seo');
  if (footerSeo) footerSeo.innerHTML = buildHomeFooterSeoHtml(getToolPagePath);
}
