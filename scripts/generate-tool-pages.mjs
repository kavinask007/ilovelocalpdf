#!/usr/bin/env node
/**
 * Generates /{slug}/index.html for each PDF tool (SEO-friendly paths).
 * Run: node scripts/generate-tool-pages.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SITE_ORIGIN = 'https://ilovelocalpdf.com';
const SITE_NAME = 'I❤️localpdf';

const TOOLS = [
  { id: 'merge', slug: 'merge-pdf', icon: '🔗', title: 'Merge PDF', sub: 'Combine multiple PDFs into one' },
  { id: 'split', slug: 'split-pdf', icon: '✂️', title: 'Split PDF', sub: 'Split PDF into multiple files' },
  { id: 'organize', slug: 'organize-pages', icon: '📋', title: 'Organize Pages', sub: 'Reorder or delete pages' },
  { id: 'delete-pages', slug: 'remove-pages', icon: '🗑️', title: 'Remove Pages', sub: 'Delete specific pages from PDF' },
  { id: 'nup', slug: 'booklet-layout', icon: '📖', title: 'Booklet Layout', sub: 'Arrange pages side-by-side or in a grid' },
  { id: 'compress', slug: 'compress-pdf', icon: '📦', title: 'Compress PDF', sub: 'Reduce PDF file size' },
  { id: 'repair', slug: 'repair-pdf', icon: '🔧', title: 'Repair PDF', sub: 'Fix and recover damaged PDFs' },
  { id: 'img-to-pdf', slug: 'image-to-pdf', icon: '🖼️', title: 'Image to PDF', sub: 'Convert images to PDF' },
  { id: 'pdf-to-img', slug: 'pdf-to-image', icon: '📸', title: 'PDF to Image', sub: 'Export PDF pages as images' },
  { id: 'rotate', slug: 'rotate-pdf', icon: '🔄', title: 'Rotate PDF', sub: 'Rotate pages in your PDF' },
  { id: 'watermark', slug: 'add-watermark', icon: '💧', title: 'Add Watermark', sub: 'Stamp text watermark on PDF' },
  { id: 'page-numbers', slug: 'add-page-numbers', icon: '🔢', title: 'Add Page Numbers', sub: 'Number pages automatically' },
  { id: 'protect', slug: 'protect-pdf', icon: '🔒', title: 'Protect PDF', sub: 'Password-protect your PDF' },
  { id: 'unlock', slug: 'unlock-pdf', icon: '🔓', title: 'Unlock PDF', sub: 'Remove password protection' },
];

const SEO = {
  merge: {
    title: 'Merge PDF Online Free',
    description:
      'Merge multiple PDF files into one document in your browser. Free, private, no uploads — combine PDFs locally with instant results.',
    keywords: 'merge pdf, combine pdf, join pdf files, merge pdf online free',
    body: 'Combine two or more PDFs in the order you choose. Drag to reorder files before merging. Ideal for reports, scans, and handouts.',
    footer:
      'Free merge PDF online, combine PDF files into one, join multiple PDFs, merge scanned documents without upload, client-side PDF merger in your browser.',
  },
  split: {
    title: 'Split PDF Online Free',
    description:
      'Split a PDF into separate files by page range or extract every page. Runs locally in your browser with no file uploads.',
    keywords: 'split pdf, extract pdf pages, divide pdf, split pdf online free',
    body: 'Split by custom page ranges, extract each page as its own file, or divide a document in half. Useful for sharing only the pages you need.',
    footer: 'Split PDF online free, extract pages from PDF, divide PDF by page range, separate PDF into files — all processed locally.',
  },
  organize: {
    title: 'Organize PDF Pages Online Free',
    description:
      'Reorder, rearrange, and delete PDF pages with drag-and-drop thumbnails. Private browser-based PDF page organizer.',
    keywords: 'organize pdf pages, reorder pdf pages, rearrange pdf, sort pdf pages',
    body: 'Preview page thumbnails, drag to reorder, and remove unwanted pages before exporting a new PDF.',
    footer: 'Organize PDF pages, reorder PDF pages online, rearrange PDF page order, sort PDF thumbnails locally.',
  },
  'delete-pages': {
    title: 'Remove PDF Pages Online Free',
    description:
      'Delete specific pages or page ranges from a PDF in your browser. No signup, no uploads, fully private.',
    keywords: 'remove pdf pages, delete pdf pages, remove pages from pdf',
    body: 'Enter one or more page ranges to remove. The tool rebuilds your PDF without the selected pages.',
    footer: 'Remove pages from PDF, delete PDF pages online, drop blank pages from PDF, trim PDF locally.',
  },
  nup: {
    title: 'Booklet Layout PDF — N-up Online Free',
    description:
      'Create 2-up or 4-up booklet layouts from a PDF for printing. Side-by-side or grid layout, processed locally.',
    keywords: 'n-up pdf, 2-up pdf, booklet pdf, print multiple pages per sheet',
    body: 'Place two or four source pages on each sheet for economical printing and booklet-style reading.',
    footer: 'N-up PDF, 2-up PDF printing, 4-up PDF grid, booklet layout PDF, print two pages per sheet.',
  },
  compress: {
    title: 'Compress PDF Online Free',
    description:
      'Reduce PDF file size in your browser without uploading files. Compress PDFs privately for email and sharing.',
    keywords: 'compress pdf, reduce pdf size, shrink pdf, optimize pdf file size',
    body: 'Stream compression lowers file size while keeping documents readable. Great when attachments hit size limits.',
    footer: 'Compress PDF online free, reduce PDF file size, shrink PDF for email attachment, optimize PDF size locally.',
  },
  repair: {
    title: 'Repair PDF Online Free',
    description:
      'Fix damaged or corrupt PDF files locally in your browser. Recover PDFs without sending them to a server.',
    keywords: 'repair pdf, fix corrupt pdf, recover pdf file, broken pdf repair',
    body: 'Attempt recovery on PDFs that fail to open or behave oddly. Processing stays on your device.',
    footer: 'Repair PDF online, fix corrupt PDF, recover damaged PDF file, open broken PDF locally.',
  },
  'img-to-pdf': {
    title: 'Image to PDF Converter Online Free',
    description:
      'Convert JPG, PNG, WebP, and BMP images to a single PDF in your browser. No uploads, batch-friendly.',
    keywords: 'image to pdf, jpg to pdf, png to pdf, pictures to pdf converter',
    body: 'Add multiple images and export one combined PDF — handy for scans, photos, and screenshots.',
    footer: 'Image to PDF converter, JPG to PDF, PNG to PDF, pictures to PDF, batch image PDF in browser.',
  },
  'pdf-to-img': {
    title: 'PDF to Image Converter Online Free',
    description:
      'Export PDF pages as PNG or JPEG images at adjustable DPI. Free, local, private PDF to image conversion.',
    keywords: 'pdf to image, pdf to png, pdf to jpg, export pdf pages as images',
    body: 'Choose resolution and format, then download each page as an image for slides, social posts, or editing.',
    footer: 'PDF to image converter, PDF to PNG, PDF to JPG, export PDF pages as images locally.',
  },
  rotate: {
    title: 'Rotate PDF Online Free',
    description:
      'Rotate PDF pages 90°, 180°, or 270° in your browser. Fix sideways scans without uploading files.',
    keywords: 'rotate pdf, turn pdf pages, fix sideways pdf, rotate pdf online free',
    body: 'Rotate all pages or only selected page numbers. Common fix for mobile scans and landscape exports.',
    footer: 'Rotate PDF online, turn PDF sideways, fix landscape PDF, rotate PDF 90 degrees in browser.',
  },
  watermark: {
    title: 'Add Watermark to PDF Online Free',
    description:
      'Stamp custom text watermarks on PDF pages locally. Adjust position and opacity — no cloud processing.',
    keywords: 'watermark pdf, add watermark to pdf, stamp pdf confidential',
    body: 'Add labels like CONFIDENTIAL or DRAFT with diagonal, center, top, or bottom placement.',
    footer: 'Add watermark to PDF, stamp CONFIDENTIAL on PDF, text watermark PDF free, watermark PDF in browser.',
  },
  'page-numbers': {
    title: 'Add Page Numbers to PDF Online Free',
    description:
      'Number PDF pages automatically with customizable position, start number, and font size. Runs in-browser.',
    keywords: 'add page numbers to pdf, number pdf pages, pdf page numbering',
    body: 'Place numbers at corners or center, top or bottom, with control over where counting starts.',
    footer: 'Add page numbers to PDF, number PDF pages automatically, PDF page numbering tool locally.',
  },
  protect: {
    title: 'Protect PDF with Password Online Free',
    description:
      'Password-protect a PDF in your browser. Encrypt PDFs locally without uploading sensitive documents.',
    keywords: 'protect pdf, password protect pdf, encrypt pdf, lock pdf with password',
    body: 'Set a password before sharing contracts or personal records. Files never leave your computer.',
    footer: 'Password protect PDF, encrypt PDF online, lock PDF with password, secure PDF free in browser.',
  },
  unlock: {
    title: 'Unlock PDF Online Free',
    description:
      'Remove password protection from a PDF you own. Decrypt PDFs locally in your browser — private and free.',
    keywords: 'unlock pdf, remove pdf password, decrypt pdf, unprotect pdf',
    body: 'Enter the document password to produce an unlocked copy for editing or archiving.',
    footer: 'Unlock PDF online, remove PDF password, decrypt PDF free, unprotect PDF file locally.',
  },
};

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderToolPage(tool) {
  const seo = SEO[tool.id];
  const pageTitle = `${seo.title} | ${SITE_NAME}`;
  const canonical = `${SITE_ORIGIN}/${tool.slug}/`;
  const ogDesc = seo.description.replace(/ — .*$/, '.');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(seo.description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <meta name="keywords" content="${esc(seo.keywords)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:title" content="${esc(pageTitle)}" />
  <meta property="og:description" content="${esc(ogDesc)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${esc(pageTitle)}" />
  <meta name="twitter:description" content="${esc(ogDesc)}" />
  <link rel="stylesheet" href="../css/style.css" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>❤️</text></svg>" />
</head>
<body>
  <nav class="navbar" aria-label="Main navigation">
    <a href="/" class="navbar-logo">
      <span class="brand-name">I❤️local<span class="brand-accent">pdf</span></span>
    </a>
    <ul class="navbar-links" role="list">
      <li><a href="/#tools-section">All Tools</a></li>
      <li><a href="/#about-section">About</a></li>
    </ul>
    <a href="/#tools-section" class="btn-nav">🔒 100% Local</a>
  </nav>

  <main class="section" role="main" style="padding-top: 100px; padding-bottom: 60px; max-width: 860px;">
    <nav class="tool-breadcrumb" id="tool-breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li><a href="/">Home</a></li>
        <li><a href="/#tools-section">Free PDF Tools</a></li>
        <li aria-current="page"><span id="tool-breadcrumb-current">${esc(tool.title)}</span></li>
      </ol>
    </nav>
    <section style="background: #13131d; border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden;">
      <header class="modal-header">
        <div class="modal-icon" id="tool-page-icon">${tool.icon}</div>
        <div>
          <h1 class="modal-title" id="tool-page-title">${esc(tool.title)}</h1>
          <p class="modal-subtitle" id="tool-page-subtitle">${esc(tool.sub)}</p>
        </div>
      </header>
      <div class="modal-body" id="tool-page-body"></div>
    </section>
    <section style="margin-top: 20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px;">
      <h2 id="tool-seo-title" style="font-family:'Plus Jakarta Sans',sans-serif; font-size:1.1rem; margin-bottom:10px;">${esc(tool.title)} — Free &amp; Private</h2>
      <div id="tool-seo-body" style="color:var(--text-secondary); line-height:1.7;">
        <p>${esc(seo.body)}</p>
        <p>Files are processed on your device with Rust and WebAssembly — nothing is uploaded to a server.</p>
      </div>
    </section>
  </main>

  <footer class="footer" aria-label="Footer">
    <div class="footer-logo">I❤️local<span>pdf</span></div>
    <p class="footer-tagline">Your files never leave your browser. Zero uploads. Zero tracking. Zero cloud.</p>
    <p class="footer-tagline">In-browser processing only — safe for confidential documents.</p>
    <div class="footer-seo" id="footer-seo">
      <p class="footer-seo-privacy">Every tool runs entirely in your web browser. Your PDFs are never uploaded to a server — safe for contracts, medical records, tax files, and other confidential documents.</p>
      <p class="footer-seo-tool"><strong>${esc(seo.title)}</strong> — ${esc(seo.footer)}</p>
    </div>
  </footer>

  <div class="toast" id="global-toast" role="alert" aria-live="polite"></div>

  <script type="module" src="../js/app.js"></script>
</body>
</html>
`;
}

function renderLegacyRedirect() {
  const slugMap = Object.fromEntries(TOOLS.flatMap(t => [[t.id, t.slug], [t.slug, t.slug]]));
  const mapJson = JSON.stringify(slugMap);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redirecting… | ${SITE_NAME}</title>
  <meta name="robots" content="noindex,follow" />
  <link rel="canonical" href="${SITE_ORIGIN}/merge-pdf/" />
  <script>
    (function () {
      var map = ${mapJson};
      var raw = (new URLSearchParams(location.search).get('tool') || 'merge-pdf').trim().toLowerCase();
      var slug = map[raw] || raw.replace(/\\.html$/i, '');
      location.replace('/' + slug + '/');
    })();
  </script>
</head>
<body>
  <p>Redirecting to the PDF tool… <a href="/merge-pdf/">Continue</a></p>
</body>
</html>
`;
}

function renderSitemap() {
  const urls = [
    `  <url>
    <loc>${SITE_ORIGIN}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`,
    ...TOOLS.map(
      t => `  <url>
    <loc>${SITE_ORIGIN}/${t.slug}/</loc>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>`
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

function generateForSite(siteDir) {
  const base = path.join(ROOT, siteDir);
  for (const tool of TOOLS) {
    const dir = path.join(base, tool.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderToolPage(tool));
  }
  fs.writeFileSync(path.join(base, 'tool.html'), renderLegacyRedirect());
  fs.writeFileSync(path.join(base, 'sitemap.xml'), renderSitemap());
  console.log(`✓ ${siteDir}: ${TOOLS.length} tool pages + sitemap`);
}

for (const site of ['www', 'docs']) {
  generateForSite(site);
}
