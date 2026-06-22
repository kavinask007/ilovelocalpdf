// SEO helpers — titles, descriptions, Open Graph, Twitter, JSON-LD

import { TOOL_SEO, TOOL_ORDER, RELATED_TOOLS } from './tools-config.js';

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
