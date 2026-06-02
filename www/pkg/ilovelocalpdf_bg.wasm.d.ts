/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const add_page_numbers: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
export const add_watermark: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
export const compress_pdf: (a: number, b: number) => [number, number, number];
export const delete_pages: (a: number, b: number, c: number, d: number) => [number, number, number];
export const get_page_count: (a: number, b: number) => [number, number, number];
export const get_pdf_info: (a: number, b: number) => [number, number, number, number];
export const images_to_pdf: (a: any) => [number, number, number];
export const init: () => void;
export const merge_pdfs: (a: any) => [number, number, number];
export const nup_pdf: (a: number, b: number, c: number) => [number, number, number];
export const organize_pages: (a: number, b: number, c: number, d: number) => [number, number, number];
export const protect_pdf: (a: number, b: number, c: number, d: number) => [number, number, number];
export const repair_pdf: (a: number, b: number) => [number, number, number];
export const rotate_pdf: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
export const split_pdf: (a: number, b: number, c: number, d: number) => [number, number, number];
export const unlock_pdf: (a: number, b: number, c: number, d: number) => [number, number, number];
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_start: () => void;
