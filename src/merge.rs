use wasm_bindgen::prelude::*;
use lopdf::{Document, Object, ObjectId, Dictionary};
use std::io::Cursor;
use crate::util::{js_err, load_doc, remap_object};

#[wasm_bindgen]
pub fn merge_pdfs(pdf_array: js_sys::Array) -> Result<js_sys::Uint8Array, JsValue> {
    let mut docs: Vec<Document> = Vec::new();
    for item in pdf_array.iter() {
        let arr: js_sys::Uint8Array = item.dyn_into()?;
        let bytes: Vec<u8> = arr.to_vec();
        let doc = load_doc(&bytes).map_err(js_err)?;
        docs.push(doc);
    }
    if docs.is_empty() {
        return Err(js_err("No PDFs provided"));
    }
    let mut merged = merge_documents(docs).map_err(|e| js_err(e))?;
    let mut out = Vec::new();
    merged.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(out.as_slice()))
}

fn merge_documents(docs: Vec<Document>) -> Result<Document, String> {
    let mut merged = Document::with_version("1.7");
    let mut all_page_ids: Vec<ObjectId> = Vec::new();

    for doc in docs {
        let page_ids: Vec<ObjectId> = doc.page_iter().collect();
        let offset = merged.max_id;

        for (id, obj) in &doc.objects {
            let new_id = (id.0 + offset, id.1);
            let new_obj = remap_object(obj, offset);
            merged.objects.insert(new_id, new_obj);
        }
        merged.max_id += doc.max_id;

        for pid in &page_ids {
            all_page_ids.push((pid.0 + offset, pid.1));
        }
    }

    let pages_id = merged.new_object_id();
    let page_refs: Vec<Object> = all_page_ids.iter()
        .map(|id| Object::Reference(*id))
        .collect();

    for pid in &all_page_ids {
        if let Some(Object::Dictionary(ref mut dict)) = merged.objects.get_mut(pid) {
            dict.set("Parent", Object::Reference(pages_id));
        }
    }

    let pages_dict = Dictionary::from_iter(vec![
        ("Type", Object::Name(b"Pages".to_vec())),
        ("Kids", Object::Array(page_refs)),
        ("Count", Object::Integer(all_page_ids.len() as i64)),
    ]);
    merged.objects.insert(pages_id, Object::Dictionary(pages_dict));

    let catalog_id = merged.new_object_id();
    let catalog = Dictionary::from_iter(vec![
        ("Type", Object::Name(b"Catalog".to_vec())),
        ("Pages", Object::Reference(pages_id)),
    ]);
    merged.objects.insert(catalog_id, Object::Dictionary(catalog));
    merged.trailer.set("Root", Object::Reference(catalog_id));
    merged.trailer.remove(b"Info");
    merged.trailer.remove(b"Encrypt");

    Ok(merged)
}
