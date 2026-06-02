/* tslint:disable */
/* eslint-disable */

export function add_page_numbers(data: Uint8Array, position: string, start_num: number, font_size: number): Uint8Array;

export function add_watermark(data: Uint8Array, text: string, opacity: number, position: string): Uint8Array;

export function compress_pdf(data: Uint8Array): Uint8Array;

export function delete_pages(data: Uint8Array, pages_json: string): Uint8Array;

export function get_page_count(data: Uint8Array): number;

export function get_pdf_info(data: Uint8Array): string;

export function images_to_pdf(images_array: Array<any>): Uint8Array;

export function init(): void;

export function merge_pdfs(pdf_array: Array<any>): Uint8Array;

export function nup_pdf(data: Uint8Array, nup: number): Uint8Array;

export function organize_pages(data: Uint8Array, order_json: string): Uint8Array;

export function protect_pdf(data: Uint8Array, password: string): Uint8Array;

export function repair_pdf(data: Uint8Array): Uint8Array;

export function rotate_pdf(data: Uint8Array, angle: number, pages_json: string): Uint8Array;

export function split_pdf(data: Uint8Array, ranges_json: string): Array<any>;

export function unlock_pdf(data: Uint8Array, password: string): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly add_page_numbers: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly add_watermark: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly compress_pdf: (a: number, b: number) => [number, number, number];
    readonly delete_pages: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly get_page_count: (a: number, b: number) => [number, number, number];
    readonly get_pdf_info: (a: number, b: number) => [number, number, number, number];
    readonly images_to_pdf: (a: any) => [number, number, number];
    readonly init: () => void;
    readonly merge_pdfs: (a: any) => [number, number, number];
    readonly nup_pdf: (a: number, b: number, c: number) => [number, number, number];
    readonly organize_pages: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly protect_pdf: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly repair_pdf: (a: number, b: number) => [number, number, number];
    readonly rotate_pdf: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly split_pdf: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly unlock_pdf: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
