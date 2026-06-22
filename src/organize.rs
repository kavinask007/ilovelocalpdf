use wasm_bindgen::prelude::*;
use lopdf::ObjectId;
use std::io::Cursor;
use std::collections::HashSet;
use crate::util::{js_err, load_doc, page_indices_from_json};
use crate::page_ops::extract_pages;

#[wasm_bindgen]
pub fn organize_pages(data: &[u8], order_json: &str) -> Result<js_sys::Uint8Array, JsValue> {
    let doc = load_doc(data).map_err(js_err)?;
    let page_ids: Vec<ObjectId> = doc.page_iter().collect();
    let total = page_ids.len();

    let order = page_indices_from_json(order_json).map_err(js_err)?;

    let selected: Vec<ObjectId> = order.iter()
        .filter_map(|&i| if i < total { Some(page_ids[i]) } else { None })
        .collect();

    let mut out_doc = extract_pages(&doc, &selected).map_err(|e| js_err(e))?;
    let mut out = Vec::new();
    out_doc.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(out.as_slice()))
}

#[wasm_bindgen]
pub fn delete_pages(data: &[u8], pages_json: &str) -> Result<js_sys::Uint8Array, JsValue> {
    let doc = load_doc(data).map_err(js_err)?;
    let page_ids: Vec<ObjectId> = doc.page_iter().collect();
    let total = page_ids.len();

    let to_delete: HashSet<usize> = {
        let nums = page_indices_from_json(pages_json).map_err(js_err)?;
        nums.into_iter()
            .filter(|&i| i < total)
            .collect()
    };

    let remaining: Vec<ObjectId> = page_ids.iter()
        .enumerate()
        .filter(|(i, _)| !to_delete.contains(i))
        .map(|(_, id)| *id)
        .collect();

    let mut out_doc = extract_pages(&doc, &remaining).map_err(|e| js_err(e))?;
    let mut out = Vec::new();
    out_doc.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(out.as_slice()))
}
