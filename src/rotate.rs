use wasm_bindgen::prelude::*;
use lopdf::{Object, ObjectId};
use std::io::Cursor;
use crate::util::{js_err, load_doc, page_indices_from_json};

#[wasm_bindgen]
pub fn rotate_pdf(data: &[u8], angle: i32, pages_json: &str) -> Result<js_sys::Uint8Array, JsValue> {
    let mut doc = load_doc(data).map_err(js_err)?;
    let page_ids: Vec<ObjectId> = doc.page_iter().collect();
    let total = page_ids.len();

    let target_pages: Vec<usize> = if pages_json == "all" {
        (0..total).collect()
    } else {
        let nums = page_indices_from_json(pages_json).map_err(js_err)?;
        nums.into_iter().filter(|&i| i < total).collect()
    };

    let normalized = ((angle % 360) + 360) % 360;

    for idx in target_pages {
        let pid = page_ids[idx];
        if let Some(Object::Dictionary(ref mut dict)) = doc.objects.get_mut(&pid) {
            let current = dict.get(b"Rotate")
                .ok()
                .and_then(|o| o.as_i64().ok())
                .unwrap_or(0);
            let new_rot = ((current + normalized as i64) % 360 + 360) % 360;
            dict.set("Rotate", Object::Integer(new_rot));
        }
    }

    let mut out = Vec::new();
    doc.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(out.as_slice()))
}
