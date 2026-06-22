use wasm_bindgen::prelude::*;
use lopdf::Document;
use std::io::Cursor;
use crate::util::{js_err, load_doc};

#[wasm_bindgen]
pub fn repair_pdf(data: &[u8]) -> Result<js_sys::Uint8Array, JsValue> {
    let doc = load_doc(data).map_err(js_err)?;
    let mut out = Vec::new();
    let mut doc2 = Document::with_version("1.7");
    for (id, obj) in &doc.objects {
        doc2.objects.insert(*id, obj.clone());
    }
    doc2.max_id = doc.max_id;
    if let Ok(root) = doc.trailer.get(b"Root").cloned() {
        doc2.trailer.set("Root", root);
    }
    doc2.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(out.as_slice()))
}
