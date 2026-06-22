// Shared tool configuration — single source of truth for all tools
export const TOOLS = {
  merge:        { icon: '🔗', title: 'Merge PDF',        sub: 'Combine multiple PDFs into one',          color: '#e94057' },
  split:        { icon: '✂️', title: 'Split PDF',        sub: 'Split PDF into multiple files',           color: '#f27121' },
  organize:     { icon: '📋', title: 'Organize Pages',   sub: 'Reorder or delete pages',                 color: '#8338ec' },
  'delete-pages':{ icon:'🗑️', title: 'Remove Pages',    sub: 'Delete specific pages from PDF',          color: '#3a86ff' },
  nup:          { icon: '📖', title: 'Booklet Layout',   sub: 'Arrange pages side-by-side or in a grid',  color: '#8338ec' },
  compress:     { icon: '📦', title: 'Compress PDF',     sub: 'Reduce PDF file size',                    color: '#06d6a0' },
  repair:       { icon: '🔧', title: 'Repair PDF',       sub: 'Fix and recover damaged PDFs',            color: '#00b4d8' },
  'img-to-pdf': { icon: '🖼️', title: 'Image to PDF',    sub: 'Convert images to PDF',                   color: '#ff006e' },
  'pdf-to-img': { icon: '📸', title: 'PDF to Image',     sub: 'Export PDF pages as images',              color: '#ffd60a' },
  rotate:       { icon: '🔄', title: 'Rotate PDF',       sub: 'Rotate pages in your PDF',                color: '#e94057' },
  watermark:    { icon: '💧', title: 'Add Watermark',    sub: 'Stamp text watermark on PDF',             color: '#f27121' },
  'page-numbers':{ icon:'🔢', title: 'Add Page Numbers', sub: 'Number pages automatically',              color: '#8338ec' },
  protect:      { icon: '🔒', title: 'Protect PDF',      sub: 'Password-protect your PDF',               color: '#3a86ff' },
  unlock:       { icon: '🔓', title: 'Unlock PDF',       sub: 'Remove password protection',              color: '#06d6a0' },
};

export const TOOL_SLUGS = {
  merge: 'merge-pdf', split: 'split-pdf', organize: 'organize-pages',
  'delete-pages': 'remove-pages', nup: 'booklet-layout', compress: 'compress-pdf',
  repair: 'repair-pdf', 'img-to-pdf': 'image-to-pdf', 'pdf-to-img': 'pdf-to-image',
  rotate: 'rotate-pdf', watermark: 'add-watermark', 'page-numbers': 'add-page-numbers',
  protect: 'protect-pdf', unlock: 'unlock-pdf',
};

export const TOOL_SEO = {
  merge: {
    title: 'Merge PDF Online Free',
    description: 'Merge multiple PDF files into one document in your browser. Free, private, no uploads — combine PDFs locally with instant results.',
    keywords: 'merge pdf, combine pdf, join pdf files, merge pdf online free',
    body: 'Combine two or more PDFs in the order you choose. Drag to reorder files before merging. Ideal for reports, scans, and handouts.',
    footerSearch: 'Free merge PDF online, combine PDF files into one, join multiple PDFs, append PDF pages, merge scanned documents, batch merge without upload, client-side PDF merger, merge contracts in browser, concatenate PDF chapters, unite PDF handouts — all processed locally on your device.',
  },
  split: {
    title: 'Split PDF Online Free',
    description: 'Split a PDF into separate files by page range or extract every page. Runs locally in your browser with no file uploads.',
    keywords: 'split pdf, extract pdf pages, divide pdf, split pdf online free',
    body: 'Split by custom page ranges, extract each page as its own file, or divide a document in half. Useful for sharing only the pages you need.',
    footerSearch: 'Split PDF online free, extract pages from PDF, divide PDF by page range, separate PDF into files, pull one page from PDF, split large PDF for email, extract chapter PDF, cut PDF pages browser-based, split confidential PDF without uploading, break PDF into parts locally.',
  },
  organize: {
    title: 'Organize PDF Pages Online Free',
    description: 'Reorder, rearrange, and delete PDF pages with drag-and-drop thumbnails. Private browser-based PDF page organizer.',
    keywords: 'organize pdf pages, reorder pdf pages, rearrange pdf, sort pdf pages',
    body: 'Preview page thumbnails, drag to reorder, and remove unwanted pages before exporting a new PDF.',
    footerSearch: 'Organize PDF pages, reorder PDF pages online, rearrange PDF page order, sort PDF thumbnails, drag and drop PDF pages, shuffle PDF sheets, fix page sequence, reorder scanned PDF locally, organize confidential PDF in browser without cloud.',
  },
  'delete-pages': {
    title: 'Remove PDF Pages Online Free',
    description: 'Delete specific pages or page ranges from a PDF in your browser. No signup, no uploads, fully private.',
    keywords: 'remove pdf pages, delete pdf pages, remove pages from pdf',
    body: 'Enter one or more page ranges to remove. The tool rebuilds your PDF without the selected pages.',
    footerSearch: 'Remove pages from PDF, delete PDF pages online, drop blank pages from PDF, remove page from confidential PDF, strip pages browser tool, delete page range PDF free, excise pages without upload, trim PDF locally, remove unwanted PDF sheets on your device.',
  },
  nup: {
    title: 'Booklet Layout PDF — N-up Online Free',
    description: 'Create 2-up or 4-up booklet layouts from a PDF for printing. Side-by-side or grid layout, processed locally.',
    keywords: 'n-up pdf, 2-up pdf, booklet pdf, print multiple pages per sheet',
    body: 'Place two or four source pages on each sheet for economical printing and booklet-style reading.',
    footerSearch: 'N-up PDF, 2-up PDF printing, 4-up PDF grid, booklet layout PDF, print two pages per sheet, side by side PDF pages, imposition PDF online, create booklet from PDF browser, print handout layout, multi-page per sheet PDF tool — local processing only.',
  },
  compress: {
    title: 'Compress PDF Online Free',
    description: 'Reduce PDF file size in your browser without uploading files. Compress PDFs privately for email and sharing.',
    keywords: 'compress pdf, reduce pdf size, shrink pdf, optimize pdf file size',
    body: 'Stream compression lowers file size while keeping documents readable. Great when attachments hit size limits.',
    footerSearch: 'Compress PDF online free, reduce PDF file size, shrink PDF for email attachment, optimize PDF size, make PDF smaller without upload, compress confidential PDF in browser, lower PDF MB locally, PDF compressor client-side, squeeze PDF for Gmail limit.',
  },
  repair: {
    title: 'Repair PDF Online Free',
    description: 'Fix damaged or corrupt PDF files locally in your browser. Recover PDFs without sending them to a server.',
    keywords: 'repair pdf, fix corrupt pdf, recover pdf file, broken pdf repair',
    body: 'Attempt recovery on PDFs that fail to open or behave oddly. Processing stays on your device.',
    footerSearch: 'Repair PDF online, fix corrupt PDF, recover damaged PDF file, open broken PDF, rebuild PDF structure, fix PDF that wont open, repair PDF without sending to server, recover confidential PDF locally, mend truncated PDF in browser.',
  },
  'img-to-pdf': {
    title: 'Image to PDF Converter Online Free',
    description: 'Convert JPG, PNG, WebP, and BMP images to a single PDF in your browser. No uploads, batch-friendly.',
    keywords: 'image to pdf, jpg to pdf, png to pdf, pictures to pdf converter',
    body: 'Add multiple images and export one combined PDF — handy for scans, photos, and screenshots.',
    footerSearch: 'Image to PDF converter, JPG to PDF, PNG to PDF, pictures to PDF, photo to PDF free, convert images to single PDF, batch image PDF browser, scan photos to PDF locally, create PDF from screenshots without upload, confidential scans to PDF on device.',
  },
  'pdf-to-img': {
    title: 'PDF to Image Converter Online Free',
    description: 'Export PDF pages as PNG or JPEG images at adjustable DPI. Free, local, private PDF to image conversion.',
    keywords: 'pdf to image, pdf to png, pdf to jpg, export pdf pages as images',
    body: 'Choose resolution and format, then download each page as an image for slides, social posts, or editing.',
    footerSearch: 'PDF to image converter, PDF to PNG, PDF to JPG, export PDF pages as images, render PDF page to picture, save PDF as JPEG, high DPI PDF export, convert PDF slides to images browser, PDF to image without upload, extract PDF page image locally.',
  },
  rotate: {
    title: 'Rotate PDF Online Free',
    description: 'Rotate PDF pages 90°, 180°, or 270° in your browser. Fix sideways scans without uploading files.',
    keywords: 'rotate pdf, turn pdf pages, fix sideways pdf, rotate pdf online free',
    body: 'Rotate all pages or only selected page numbers. Common fix for mobile scans and landscape exports.',
    footerSearch: 'Rotate PDF online, turn PDF sideways, fix landscape PDF, rotate PDF 90 degrees, rotate single PDF page, flip PDF orientation, rotate scanned PDF in browser, rotate confidential PDF without cloud, change PDF page angle locally.',
  },
  watermark: {
    title: 'Add Watermark to PDF Online Free',
    description: 'Stamp custom text watermarks on PDF pages locally. Adjust position and opacity — no cloud processing.',
    keywords: 'watermark pdf, add watermark to pdf, stamp pdf confidential',
    body: 'Add labels like CONFIDENTIAL or DRAFT with diagonal, center, top, or bottom placement.',
    footerSearch: 'Add watermark to PDF, stamp CONFIDENTIAL on PDF, text watermark PDF free, brand PDF watermark, draft watermark PDF, diagonal watermark online, watermark PDF in browser, watermark sensitive document locally, overlay text on PDF without upload.',
  },
  'page-numbers': {
    title: 'Add Page Numbers to PDF Online Free',
    description: 'Number PDF pages automatically with customizable position, start number, and font size. Runs in-browser.',
    keywords: 'add page numbers to pdf, number pdf pages, pdf page numbering',
    body: 'Place numbers at corners or center, top or bottom, with control over where counting starts.',
    footerSearch: 'Add page numbers to PDF, number PDF pages automatically, PDF page numbering tool, footer page numbers PDF, Bates numbering style PDF, paginate PDF online, insert page numbers browser, number confidential PDF locally, page number PDF without upload.',
  },
  protect: {
    title: 'Protect PDF with Password Online Free',
    description: 'Password-protect a PDF in your browser. Encrypt PDFs locally without uploading sensitive documents.',
    keywords: 'protect pdf, password protect pdf, encrypt pdf, lock pdf with password',
    body: 'Set a password before sharing contracts or personal records. Files never leave your computer.',
    footerSearch: 'Password protect PDF, encrypt PDF online, lock PDF with password, secure PDF free, protect confidential PDF in browser, add PDF password without upload, encrypt PDF locally, restrict PDF opening, PDF encryption client-side on your device.',
  },
  unlock: {
    title: 'Unlock PDF Online Free',
    description: 'Remove password protection from a PDF you own. Decrypt PDFs locally in your browser — private and free.',
    keywords: 'unlock pdf, remove pdf password, decrypt pdf, unprotect pdf',
    body: 'Enter the document password to produce an unlocked copy for editing or archiving.',
    footerSearch: 'Unlock PDF online, remove PDF password, decrypt PDF free, unprotect PDF file, open password protected PDF you own, strip PDF encryption browser, unlock PDF without upload, remove PDF lock locally, decrypt confidential PDF on device only.',
  },
};

export const TOOL_ORDER = [
  'merge', 'split', 'organize', 'delete-pages', 'nup', 'compress', 'repair',
  'img-to-pdf', 'pdf-to-img', 'rotate', 'watermark', 'page-numbers', 'protect', 'unlock',
];

export const RELATED_TOOLS = {
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
