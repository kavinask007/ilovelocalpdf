use wasm_bindgen::prelude::*;

mod compress;
mod util;
mod page_ops;
mod merge;
mod split;
mod rotate;
mod watermark;
mod page_numbers;
mod image_to_pdf;
mod nup;
mod organize;
mod repair;
mod protect;

#[cfg(feature = "console_error_panic_hook")]
pub use console_error_panic_hook::set_once as set_panic_hook;

#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

pub use merge::merge_pdfs;
pub use split::split_pdf;
pub use rotate::rotate_pdf;
pub use watermark::add_watermark;
pub use page_numbers::add_page_numbers;
pub use image_to_pdf::images_to_pdf;
pub use nup::nup_pdf;
pub use organize::{organize_pages, delete_pages};
pub use compress::compress_pdf;
pub use repair::repair_pdf;
pub use protect::{
    protect_pdf,
    unlock_pdf,
    is_legacy_protected,
    get_pdf_info,
    get_page_count,
};
