use wasm_bindgen::prelude::*;
use lopdf::ObjectId;
use std::io::Cursor;
use crate::util::{js_err, load_doc};
use crate::page_ops::extract_pages;

#[wasm_bindgen]
pub fn split_pdf(data: &[u8], ranges_json: &str) -> Result<js_sys::Array, JsValue> {
    let doc = load_doc(data).map_err(js_err)?;
    let page_ids: Vec<ObjectId> = doc.page_iter().collect();
    let total = page_ids.len();

    let ranges: Vec<Vec<usize>> = serde_json::from_str(ranges_json)
        .map_err(|e| js_err(format!("Bad ranges JSON: {e}")))?;

    let result = js_sys::Array::new();

    for range in &ranges {
        if range.len() < 2 {
            return Err(js_err("Each range must have [start, end]"));
        }
        let start = (range[0].saturating_sub(1)).min(total.saturating_sub(1));
        let end = range[1].min(total);
        let selected: Vec<ObjectId> = page_ids[start..end].to_vec();
        let mut out_doc = extract_pages(&doc, &selected).map_err(|e| js_err(e))?;
        let mut buf = Vec::new();
        out_doc.save_to(&mut Cursor::new(&mut buf))
            .map_err(|e| js_err(format!("Save error: {e}")))?;
        result.push(&js_sys::Uint8Array::from(buf.as_slice()));
    }

    Ok(result)
}
