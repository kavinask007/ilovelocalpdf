use lopdf::{Dictionary, Document, Object, ObjectId};

pub fn js_err(s: impl ToString) -> wasm_bindgen::JsValue {
    wasm_bindgen::JsValue::from_str(&s.to_string())
}

pub fn get_page_dimensions(doc: &Document, page_id: &ObjectId) -> (f32, f32) {
    if let Some([x0, y0, x1, y1]) = resolve_page_box(doc, *page_id, b"MediaBox") {
        return ((x1 - x0).max(1.0), (y1 - y0).max(1.0));
    }
    (612.0, 792.0)
}

pub fn resolve_page_box(doc: &Document, page_id: ObjectId, key: &[u8]) -> Option<[f32; 4]> {
    let mut cur = page_id;
    loop {
        let dict = match doc.objects.get(&cur) {
            Some(Object::Dictionary(d)) => d,
            _ => return None,
        };
        if let Ok(obj) = dict.get(key) {
            if let Some(box_vals) = box_array_from_object(doc, obj) {
                return Some(box_vals);
            }
        }
        cur = match dict.get(b"Parent") {
            Ok(Object::Reference(pid)) => *pid,
            _ => return None,
        };
    }
}

pub fn box_array_from_object(doc: &Document, obj: &Object) -> Option<[f32; 4]> {
    let resolved = match obj {
        Object::Reference(id) => doc.objects.get(id)?,
        other => other,
    };
    let Object::Array(arr) = resolved else {
        return None;
    };
    if arr.len() < 4 {
        return None;
    }
    let x0 = arr[0].as_float().ok()?;
    let y0 = arr[1].as_float().ok()?;
    let x1 = arr[2].as_float().ok()?;
    let y1 = arr[3].as_float().ok()?;
    Some([x0, y0, x1, y1])
}

pub fn resolve_page_resources(doc: &Document, page_id: ObjectId) -> Option<Object> {
    let mut cur = page_id;
    loop {
        let dict = match doc.objects.get(&cur) {
            Some(Object::Dictionary(d)) => d,
            _ => return None,
        };
        if let Ok(obj) = dict.get(b"Resources") {
            return Some(obj.clone());
        }
        cur = match dict.get(b"Parent") {
            Ok(Object::Reference(pid)) => *pid,
            _ => return None,
        };
    }
}

pub fn remap_object(obj: &Object, offset: u32) -> Object {
    match obj {
        Object::Reference(id) => Object::Reference((id.0 + offset, id.1)),
        Object::Array(arr) => Object::Array(
            arr.iter().map(|o| remap_object(o, offset)).collect(),
        ),
        Object::Dictionary(dict) => {
            let mut new_dict = lopdf::Dictionary::new();
            for (k, v) in dict.iter() {
                new_dict.set(k.clone(), remap_object(v, offset));
            }
            Object::Dictionary(new_dict)
        }
        Object::Stream(stream) => {
            let mut new_dict = lopdf::Dictionary::new();
            for (k, v) in stream.dict.iter() {
                new_dict.set(k.clone(), remap_object(v, offset));
            }
            Object::Stream(lopdf::Stream {
                dict: new_dict,
                content: stream.content.clone(),
                allows_compression: stream.allows_compression,
                start_position: stream.start_position,
            })
        }
        other => other.clone(),
    }
}

/// Load a PDF document from bytes with a consistent error message.
pub fn load_doc(data: &[u8]) -> Result<Document, String> {
    Document::load_mem(data).map_err(|e| format!("Load error: {e}"))
}

/// Parse a JSON array of 1-based page numbers and convert to 0-based indices.
pub fn page_indices_from_json(json: &str) -> Result<Vec<usize>, String> {
    serde_json::from_str::<Vec<usize>>(json)
        .map(|nums| nums.into_iter().map(|n| n.saturating_sub(1)).collect())
        .map_err(|e| format!("Bad JSON: {e}"))
}

/// Create a new Helvetica font object (Type1 with WinAnsiEncoding).
/// Returns the ObjectId of the inserted font dictionary.
pub fn make_helvetica_font(doc: &mut Document, bold: bool) -> ObjectId {
    let font_id = doc.new_object_id();
    let base_name: &[u8] = if bold { b"Helvetica-Bold" } else { b"Helvetica" };
    let font_dict = Dictionary::from_iter(vec![
        ("Type",     Object::Name(b"Font".to_vec())),
        ("Subtype",  Object::Name(b"Type1".to_vec())),
        ("BaseFont", Object::Name(base_name.to_vec())),
        ("Encoding", Object::Name(b"WinAnsiEncoding".to_vec())),
    ]);
    doc.objects.insert(font_id, Object::Dictionary(font_dict));
    font_id
}
