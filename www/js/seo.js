// SEO helpers — titles, descriptions, Open Graph, Twitter, JSON-LD

export const SITE_NAME = 'I❤️localpdf';
export const PRODUCTION_ORIGIN = 'https://ilovelocalpdf.com';

export function getSiteOrigin() {
  const host = window.location.hostname;
  if (host === 'ilovelocalpdf.com' || host === 'www.ilovelocalpdf.com') {
    return PRODUCTION_ORIGIN;
  }
  return window.location.origin;
}

export function absoluteUrl(relativePath) {
  return new URL(relativePath, getSiteOrigin() + '/').href;
}

export const PRIVACY_FOOTER_INTRO =
  'Every tool on I❤️localpdf runs entirely in your web browser — powered by Rust and WebAssembly on your own device. ' +
  'Your PDFs are never uploaded to a server, never stored in the cloud, and never sent over the network for processing. ' +
  'That makes these tools safe for confidential documents: employment contracts, medical records, tax returns, bank statements, ' +
  'legal discovery, NDAs, student records, and personal identification. No account required, no tracking, and pages can keep working offline after the first load.';

export const TOOL_SEO = {
  merge: {
    title: 'Merge PDF Online Free',
    description:
      'Merge multiple PDF files into one document in your browser. Free, private, no uploads — combine PDFs locally with instant results.',
    keywords: 'merge pdf, combine pdf, join pdf files, merge pdf online free',
    body: 'Combine two or more PDFs in the order you choose. Drag to reorder files before merging. Ideal for reports, scans, and handouts.',
    footerSearch:
      'Free merge PDF online, combine PDF files into one, join multiple PDFs, append PDF pages, merge scanned documents, batch merge without upload, client-side PDF merger, merge contracts in browser, concatenate PDF chapters, unite PDF handouts — all processed locally on your device.',
  },
  split: {
    title: 'Split PDF Online Free',
    description:
      'Split a PDF into separate files by page range or extract every page. Runs locally in your browser with no file uploads.',
    keywords: 'split pdf, extract pdf pages, divide pdf, split pdf online free',
    body: 'Split by custom page ranges, extract each page as its own file, or divide a document in half. Useful for sharing only the pages you need.',
    footerSearch:
      'Split PDF online free, extract pages from PDF, divide PDF by page range, separate PDF into files, pull one page from PDF, split large PDF for email, extract chapter PDF, cut PDF pages browser-based, split confidential PDF without uploading, break PDF into parts locally.',
  },
  organize: {
    title: 'Organize PDF Pages Online Free',
    description:
      'Reorder, rearrange, and delete PDF pages with drag-and-drop thumbnails. Private browser-based PDF page organizer.',
    keywords: 'organize pdf pages, reorder pdf pages, rearrange pdf, sort pdf pages',
    body: 'Preview page thumbnails, drag to reorder, and remove unwanted pages before exporting a new PDF.',
    footerSearch:
      'Organize PDF pages, reorder PDF pages online, rearrange PDF page order, sort PDF thumbnails, drag and drop PDF pages, shuffle PDF sheets, fix page sequence, reorder scanned PDF locally, organize confidential PDF in browser without cloud.',
  },
  'delete-pages': {
    title: 'Remove PDF Pages Online Free',
    description:
      'Delete specific pages or page ranges from a PDF in your browser. No signup, no uploads, fully private.',
    keywords: 'remove pdf pages, delete pdf pages, remove pages from pdf',
    body: 'Enter one or more page ranges to remove. The tool rebuilds your PDF without the selected pages.',
    footerSearch:
      'Remove pages from PDF, delete PDF pages online, drop blank pages from PDF, remove page from confidential PDF, strip pages browser tool, delete page range PDF free, excise pages without upload, trim PDF locally, remove unwanted PDF sheets on your device.',
  },
  nup: {
    title: 'Booklet Layout PDF — N-up Online Free',
    description:
      'Create 2-up or 4-up booklet layouts from a PDF for printing. Side-by-side or grid layout, processed locally.',
    keywords: 'n-up pdf, 2-up pdf, booklet pdf, print multiple pages per sheet',
    body: 'Place two or four source pages on each sheet for economical printing and booklet-style reading.',
    footerSearch:
      'N-up PDF, 2-up PDF printing, 4-up PDF grid, booklet layout PDF, print two pages per sheet, side by side PDF pages, imposition PDF online, create booklet from PDF browser, print handout layout, multi-page per sheet PDF tool — local processing only.',
  },
  compress: {
    title: 'Compress PDF Online Free',
    description:
      'Reduce PDF file size in your browser without uploading files. Compress PDFs privately for email and sharing.',
    keywords: 'compress pdf, reduce pdf size, shrink pdf, optimize pdf file size',
    body: 'Stream compression lowers file size while keeping documents readable. Great when attachments hit size limits.',
    footerSearch:
      'Compress PDF online free, reduce PDF file size, shrink PDF for email attachment, optimize PDF size, make PDF smaller without upload, compress confidential PDF in browser, lower PDF MB locally, PDF compressor client-side, squeeze PDF for Gmail limit.',
  },
  repair: {
    title: 'Repair PDF Online Free',
    description:
      'Fix damaged or corrupt PDF files locally in your browser. Recover PDFs without sending them to a server.',
    keywords: 'repair pdf, fix corrupt pdf, recover pdf file, broken pdf repair',
    body: 'Attempt recovery on PDFs that fail to open or behave oddly. Processing stays on your device.',
    footerSearch:
      'Repair PDF online, fix corrupt PDF, recover damaged PDF file, open broken PDF, rebuild PDF structure, fix PDF that wont open, repair PDF without sending to server, recover confidential PDF locally, mend truncated PDF in browser.',
  },
  'img-to-pdf': {
    title: 'Image to PDF Converter Online Free',
    description:
      'Convert JPG, PNG, WebP, and BMP images to a single PDF in your browser. No uploads, batch-friendly.',
    keywords: 'image to pdf, jpg to pdf, png to pdf, pictures to pdf converter',
    body: 'Add multiple images and export one combined PDF — handy for scans, photos, and screenshots.',
    footerSearch:
      'Image to PDF converter, JPG to PDF, PNG to PDF, pictures to PDF, photo to PDF free, convert images to single PDF, batch image PDF browser, scan photos to PDF locally, create PDF from screenshots without upload, confidential scans to PDF on device.',
  },
  'pdf-to-img': {
    title: 'PDF to Image Converter Online Free',
    description:
      'Export PDF pages as PNG or JPEG images at adjustable DPI. Free, local, private PDF to image conversion.',
    keywords: 'pdf to image, pdf to png, pdf to jpg, export pdf pages as images',
    body: 'Choose resolution and format, then download each page as an image for slides, social posts, or editing.',
    footerSearch:
      'PDF to image converter, PDF to PNG, PDF to JPG, export PDF pages as images, render PDF page to picture, save PDF as JPEG, high DPI PDF export, convert PDF slides to images browser, PDF to image without upload, extract PDF page image locally.',
  },
  rotate: {
    title: 'Rotate PDF Online Free',
    description:
      'Rotate PDF pages 90°, 180°, or 270° in your browser. Fix sideways scans without uploading files.',
    keywords: 'rotate pdf, turn pdf pages, fix sideways pdf, rotate pdf online free',
    body: 'Rotate all pages or only selected page numbers. Common fix for mobile scans and landscape exports.',
    footerSearch:
      'Rotate PDF online, turn PDF sideways, fix landscape PDF, rotate PDF 90 degrees, rotate single PDF page, flip PDF orientation, rotate scanned PDF in browser, rotate confidential PDF without cloud, change PDF page angle locally.',
  },
  watermark: {
    title: 'Add Watermark to PDF Online Free',
    description:
      'Stamp custom text watermarks on PDF pages locally. Adjust position and opacity — no cloud processing.',
    keywords: 'watermark pdf, add watermark to pdf, stamp pdf confidential',
    body: 'Add labels like CONFIDENTIAL or DRAFT with diagonal, center, top, or bottom placement.',
    footerSearch:
      'Add watermark to PDF, stamp CONFIDENTIAL on PDF, text watermark PDF free, brand PDF watermark, draft watermark PDF, diagonal watermark online, watermark PDF in browser, watermark sensitive document locally, overlay text on PDF without upload.',
  },
  'page-numbers': {
    title: 'Add Page Numbers to PDF Online Free',
    description:
      'Number PDF pages automatically with customizable position, start number, and font size. Runs in-browser.',
    keywords: 'add page numbers to pdf, number pdf pages, pdf page numbering',
    body: 'Place numbers at corners or center, top or bottom, with control over where counting starts.',
    footerSearch:
      'Add page numbers to PDF, number PDF pages automatically, PDF page numbering tool, footer page numbers PDF, Bates numbering style PDF, paginate PDF online, insert page numbers browser, number confidential PDF locally, page number PDF without upload.',
  },
  protect: {
    title: 'Protect PDF with Password Online Free',
    description:
      'Password-protect a PDF in your browser. Encrypt PDFs locally without uploading sensitive documents.',
    keywords: 'protect pdf, password protect pdf, encrypt pdf, lock pdf with password',
    body: 'Set a password before sharing contracts or personal records. Files never leave your computer.',
    footerSearch:
      'Password protect PDF, encrypt PDF online, lock PDF with password, secure PDF free, protect confidential PDF in browser, add PDF password without upload, encrypt PDF locally, restrict PDF opening, PDF encryption client-side on your device.',
  },
  unlock: {
    title: 'Unlock PDF Online Free',
    description:
      'Remove password protection from a PDF you own. Decrypt PDFs locally in your browser — private and free.',
    keywords: 'unlock pdf, remove pdf password, decrypt pdf, unprotect pdf',
    body: 'Enter the document password to produce an unlocked copy for editing or archiving.',
    footerSearch:
      'Unlock PDF online, remove PDF password, decrypt PDF free, unprotect PDF file, open password protected PDF you own, strip PDF encryption browser, unlock PDF without upload, remove PDF lock locally, decrypt confidential PDF on device only.',
  },
};

const TOOL_ORDER = [
  'merge', 'split', 'organize', 'delete-pages', 'nup', 'compress', 'repair',
  'img-to-pdf', 'pdf-to-img', 'rotate', 'watermark', 'page-numbers', 'protect', 'unlock',
];

const RELATED_TOOLS = {
  merge: ['split', 'organize', 'compress'],
  split: ['merge', 'delete-pages', 'organize'],
  organize: ['merge', 'delete-pages', 'rotate'],
  'delete-pages': ['organize', 'split', 'merge'],
  nup: ['merge', 'compress', 'rotate'],
  compress: ['merge', 'repair', 'protect'],
  repair: ['compress', 'merge', 'unlock'],
  'img-to-pdf': ['pdf-to-img', 'merge', 'compress'],
  'pdf-to-img': ['img-to-pdf', 'compress', 'rotate'],
  rotate: ['organize', 'watermark', 'compress'],
  watermark: ['protect', 'page-numbers', 'rotate'],
  'page-numbers': ['watermark', 'organize', 'merge'],
  protect: ['unlock', 'watermark', 'compress'],
  unlock: ['protect', 'repair', 'merge'],
};

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(id, data) {
  let script = document.getElementById(id);
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export function setPageMeta({ title, description, url, keywords }) {
  if (title) document.title = title;
  upsertMeta('name', 'description', description);
  if (keywords) upsertMeta('name', 'keywords', keywords);
  upsertLink('canonical', url);

  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:site_name', SITE_NAME);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:url', url);
  upsertMeta('property', 'og:locale', 'en_US');

  upsertMeta('name', 'twitter:card', 'summary');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
}

export function applyToolPageSeo(toolId, cfg, getToolPagePath) {
  const seo = TOOL_SEO[toolId] || {};
  const toolPath = getToolPagePath(toolId);
  const pageUrl = absoluteUrl(toolPath);
  const title = `${seo.title || cfg.title} | ${SITE_NAME}`;
  const description =
    seo.description ||
    `Use ${cfg.title} online for free with local browser processing. No uploads, no signup, fully private.`;

  setPageMeta({
    title,
    description,
    url: pageUrl,
    keywords: seo.keywords,
  });

  upsertJsonLd('tool-webapp-jsonld', {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: cfg.title,
    description,
    url: pageUrl,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript and WebAssembly',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: 'Local in-browser processing, no file uploads, no account required',
    isAccessibleForFree: true,
    inLanguage: 'en',
  });

  return { seo, toolPath, pageUrl, title, description };
}

export function buildToolSeoSectionHtml(toolId, cfg, getToolPagePath) {
  const seo = TOOL_SEO[toolId] || {};
  const related = (RELATED_TOOLS[toolId] || [])
    .filter(id => id !== toolId)
    .slice(0, 3);

  const relatedHtml = related.length
    ? `<p style="margin-top:14px;"><strong>Related tools:</strong> ${related
        .map(id => {
          const r = TOOL_SEO[id];
          const label = r?.title?.replace(/ Online Free$/i, '') || id;
          return `<a href="${getToolPagePath(id)}">${label}</a>`;
        })
        .join(' · ')}</p>`
    : '';

  return `
    <p>${seo.body || `${cfg.title} helps you ${cfg.sub.toLowerCase()} directly in your browser.`}</p>
    <p>Everything runs in your browser on your device — nothing is uploaded to a server. Safe for confidential contracts, health records, financial PDFs, and personal documents. Works for school, work, and everyday tasks.</p>
    ${relatedHtml}
  `;
}

export function buildBreadcrumbJsonLd(cfg, toolId, getToolPagePath) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('index.html') },
      { '@type': 'ListItem', position: 2, name: 'Free PDF Tools', item: absoluteUrl('index.html#tools-section') },
      { '@type': 'ListItem', position: 3, name: cfg.title, item: absoluteUrl(getToolPagePath(toolId)) },
    ],
  };
}

export function buildToolFooterSeoHtml(toolId, cfg, getToolPagePath) {
  const seo = TOOL_SEO[toolId] || {};
  const toolLabel = seo.title || cfg.title;
  const searchText =
    seo.footerSearch ||
    `${cfg.title}: ${cfg.sub}. Processed in your browser only — safe for confidential PDFs, no server upload.`;

  return `
    <p class="footer-seo-privacy">${PRIVACY_FOOTER_INTRO}</p>
    <p class="footer-seo-tool"><strong>${toolLabel}</strong> — ${searchText}</p>
    <p class="footer-seo-tool">This page runs <strong>${cfg.title}</strong> with in-browser WebAssembly: your file stays on your computer, which is ideal when you cannot upload sensitive or regulated documents to a cloud PDF service.</p>
  `;
}

export function buildHomeFooterSeoHtml(getToolPagePath) {
  const toolBlocks = TOOL_ORDER.map(id => {
    const seo = TOOL_SEO[id];
    if (!seo) return '';
    const label = seo.title.replace(/ Online Free$/i, '');
    return `<p class="footer-seo-tool"><a href="${getToolPagePath(id)}">${label}</a> — ${seo.footerSearch || seo.keywords}</p>`;
  }).join('');

  return `
    <p class="footer-seo-privacy">${PRIVACY_FOOTER_INTRO}</p>
    ${toolBlocks}
  `;
}
