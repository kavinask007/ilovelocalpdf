use wasm_bindgen::prelude::*;
use lopdf::{Document, Object, ObjectId, Dictionary, Stream};
use std::io::Cursor;

#[cfg(feature = "console_error_panic_hook")]
pub use console_error_panic_hook::set_once as set_panic_hook;

fn js_err(s: impl ToString) -> JsValue {
    JsValue::from_str(&s.to_string())
}

#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ─── MERGE PDFs ─────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn merge_pdfs(pdf_array: js_sys::Array) -> Result<js_sys::Uint8Array, JsValue> {
    let mut docs: Vec<Document> = Vec::new();
    for item in pdf_array.iter() {
        let arr: js_sys::Uint8Array = item.dyn_into()?;
        let bytes: Vec<u8> = arr.to_vec();
        let doc = Document::load_mem(&bytes)
            .map_err(|e| js_err(format!("Failed to load PDF: {e}")))?;
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

    // Set parent for each page
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

fn remap_object(obj: &Object, offset: u32) -> Object {
    match obj {
        Object::Reference(id) => Object::Reference((id.0 + offset, id.1)),
        Object::Array(arr) => Object::Array(
            arr.iter().map(|o| remap_object(o, offset)).collect(),
        ),
        Object::Dictionary(dict) => {
            let mut new_dict = Dictionary::new();
            for (k, v) in dict.iter() {
                new_dict.set(k.clone(), remap_object(v, offset));
            }
            Object::Dictionary(new_dict)
        }
        Object::Stream(stream) => {
            let mut new_dict = Dictionary::new();
            for (k, v) in stream.dict.iter() {
                new_dict.set(k.clone(), remap_object(v, offset));
            }
            Object::Stream(Stream {
                dict: new_dict,
                content: stream.content.clone(),
                allows_compression: stream.allows_compression,
                start_position: stream.start_position,
            })
        }
        other => other.clone(),
    }
}

// ─── SPLIT PDF ───────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn split_pdf(data: &[u8], ranges_json: &str) -> Result<js_sys::Array, JsValue> {
    let doc = Document::load_mem(data)
        .map_err(|e| js_err(format!("Load error: {e}")))?;
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

fn extract_pages(src: &Document, page_ids: &[ObjectId]) -> Result<Document, String> {
    let mut out = Document::with_version("1.7");
    for (id, obj) in &src.objects {
        out.objects.insert(*id, obj.clone());
    }
    out.max_id = src.max_id;

    let pages_id = out.new_object_id();
    let page_refs: Vec<Object> = page_ids.iter()
        .map(|id| Object::Reference(*id))
        .collect();

    for pid in page_ids {
        if let Some(Object::Dictionary(ref mut dict)) = out.objects.get_mut(pid) {
            dict.set("Parent", Object::Reference(pages_id));
        }
    }

    let pages_dict = Dictionary::from_iter(vec![
        ("Type", Object::Name(b"Pages".to_vec())),
        ("Kids", Object::Array(page_refs)),
        ("Count", Object::Integer(page_ids.len() as i64)),
    ]);
    out.objects.insert(pages_id, Object::Dictionary(pages_dict));

    let catalog_id = out.new_object_id();
    let catalog = Dictionary::from_iter(vec![
        ("Type", Object::Name(b"Catalog".to_vec())),
        ("Pages", Object::Reference(pages_id)),
    ]);
    out.objects.insert(catalog_id, Object::Dictionary(catalog));
    out.trailer.set("Root", Object::Reference(catalog_id));
    out.trailer.remove(b"Encrypt");
    out.trailer.remove(b"Info");

    Ok(out)
}

// ─── ROTATE PDF ──────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn rotate_pdf(data: &[u8], angle: i32, pages_json: &str) -> Result<js_sys::Uint8Array, JsValue> {
    let mut doc = Document::load_mem(data)
        .map_err(|e| js_err(format!("Load error: {e}")))?;
    let page_ids: Vec<ObjectId> = doc.page_iter().collect();
    let total = page_ids.len();

    let target_pages: Vec<usize> = if pages_json == "all" {
        (0..total).collect()
    } else {
        let nums: Vec<usize> = serde_json::from_str(pages_json)
            .map_err(|e| js_err(format!("Bad pages JSON: {e}")))?;
        nums.iter()
            .map(|&n| n.saturating_sub(1))
            .filter(|&i| i < total)
            .collect()
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

// ─── COMPRESS PDF ────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn compress_pdf(data: &[u8]) -> Result<js_sys::Uint8Array, JsValue> {
    let mut doc = Document::load_mem(data)
        .map_err(|e| js_err(format!("Load error: {e}")))?;
    doc.compress();
    let mut out = Vec::new();
    doc.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    // Some PDFs are already efficiently encoded. In those cases, forcing a rewrite
    // can add overhead and produce a bigger output. Keep the original bytes instead.
    if out.len() >= data.len() {
        Ok(js_sys::Uint8Array::from(data))
    } else {
        Ok(js_sys::Uint8Array::from(out.as_slice()))
    }
}

// ─── ADD WATERMARK ───────────────────────────────────────────────────────────

fn get_or_create_resources_id(doc: &mut Document, page_id: ObjectId) -> Result<ObjectId, String> {
    let resources = doc
        .objects
        .get(&page_id)
        .and_then(|o| o.as_dict().ok())
        .and_then(|d| d.get(b"Resources").ok())
        .cloned();

    match resources {
        Some(Object::Reference(id)) => {
            if doc.objects.get(&id).and_then(|o| o.as_dict().ok()).is_some() {
                Ok(id)
            } else {
                Err("Resources indirect object is not a dictionary".to_string())
            }
        }
        Some(Object::Dictionary(res_dict)) => {
            let res_id = doc.new_object_id();
            doc.objects
                .insert(res_id, Object::Dictionary(res_dict));
            if let Some(Object::Dictionary(page_dict)) = doc.objects.get_mut(&page_id) {
                page_dict.set("Resources", Object::Reference(res_id));
            }
            Ok(res_id)
        }
        _ => {
            let res_id = doc.new_object_id();
            doc.objects
                .insert(res_id, Object::Dictionary(Dictionary::new()));
            if let Some(Object::Dictionary(page_dict)) = doc.objects.get_mut(&page_id) {
                page_dict.set("Resources", Object::Reference(res_id));
            }
            Ok(res_id)
        }
    }
}

fn append_page_contents(doc: &mut Document, page_id: ObjectId, new_content_id: ObjectId) -> Result<(), String> {
    let existing = if let Some(Object::Dictionary(ref page_dict)) = doc.objects.get(&page_id) {
        page_dict.get(b"Contents").cloned().ok()
    } else {
        return Err("Page object not found or not a dictionary".to_string());
    };

    match existing {
        Some(Object::Reference(id)) => {
            let mut is_array = false;
            if let Some(obj) = doc.objects.get(&id) {
                if let Object::Array(_) = obj {
                    is_array = true;
                }
            }
            if is_array {
                if let Some(Object::Array(ref mut arr)) = doc.objects.get_mut(&id) {
                    arr.push(Object::Reference(new_content_id));
                    return Ok(());
                }
            }

            if let Some(Object::Dictionary(ref mut page_dict)) = doc.objects.get_mut(&page_id) {
                page_dict.set(
                    "Contents",
                    Object::Array(vec![
                        Object::Reference(id),
                        Object::Reference(new_content_id),
                    ]),
                );
            }
        }
        Some(Object::Array(mut arr)) => {
            arr.push(Object::Reference(new_content_id));
            if let Some(Object::Dictionary(ref mut page_dict)) = doc.objects.get_mut(&page_id) {
                page_dict.set("Contents", Object::Array(arr));
            }
        }
        Some(Object::Stream(stream)) => {
            let old_id = doc.new_object_id();
            doc.objects.insert(old_id, Object::Stream(stream));
            if let Some(Object::Dictionary(ref mut page_dict)) = doc.objects.get_mut(&page_id) {
                page_dict.set(
                    "Contents",
                    Object::Array(vec![
                        Object::Reference(old_id),
                        Object::Reference(new_content_id),
                    ]),
                );
            }
        }
        None => {
            if let Some(Object::Dictionary(ref mut page_dict)) = doc.objects.get_mut(&page_id) {
                page_dict.set("Contents", Object::Reference(new_content_id));
            }
        }
        Some(_) => {
            return Err("Unsupported page Contents object".to_string());
        }
    }
    Ok(())
}

/// Add a named entry to a page resource subdictionary (Font, ExtGState, etc.),
/// preserving existing entries when the subdictionary is stored indirectly.
fn merge_named_resource(
    doc: &mut Document,
    resources_id: ObjectId,
    resource_key: &[u8],
    name: &[u8],
    value_id: ObjectId,
) -> Result<(), String> {
    let existing = doc
        .objects
        .get(&resources_id)
        .and_then(|o| o.as_dict().ok())
        .and_then(|d| d.get(resource_key).ok())
        .cloned()
        .unwrap_or(Object::Dictionary(Dictionary::new()));

    let (mut sub_dict, indirect_id) = match existing {
        Object::Dictionary(d) => (d, None),
        Object::Reference(id) => {
            let d = match doc.objects.get(&id) {
                Some(Object::Dictionary(d)) => d.clone(),
                _ => {
                    return Err(format!(
                        "{} indirect object is not a dictionary",
                        String::from_utf8_lossy(resource_key)
                    ));
                }
            };
            (d, Some(id))
        }
        _ => (Dictionary::new(), None),
    };

    sub_dict.set(name, Object::Reference(value_id));

    let updated = if let Some(id) = indirect_id {
        doc.objects.insert(id, Object::Dictionary(sub_dict));
        Object::Reference(id)
    } else {
        Object::Dictionary(sub_dict)
    };

    if let Some(Object::Dictionary(res_dict)) = doc.objects.get_mut(&resources_id) {
        res_dict.set(resource_key, updated);
        Ok(())
    } else {
        Err("Resources object is not a dictionary".to_string())
    }
}

fn add_watermark_inner(
    data: &[u8],
    text: &str,
    opacity: f32,
    position: &str,
) -> Result<Vec<u8>, String> {
    let mut doc = Document::load_mem(data)
        .map_err(|e| format!("Load error: {e}"))?;
    let page_ids: Vec<ObjectId> = doc.page_iter().collect();

    let font_id = doc.new_object_id();
    let font_dict = Dictionary::from_iter(vec![
        ("Type",     Object::Name(b"Font".to_vec())),
        ("Subtype",  Object::Name(b"Type1".to_vec())),
        ("BaseFont", Object::Name(b"Helvetica-Bold".to_vec())),
        ("Encoding", Object::Name(b"WinAnsiEncoding".to_vec())),
    ]);
    doc.objects.insert(font_id, Object::Dictionary(font_dict));

    let alpha_gs_id = doc.new_object_id();
    let alpha_dict = Dictionary::from_iter(vec![
        ("Type", Object::Name(b"ExtGState".to_vec())),
        ("ca",   Object::Real(opacity)),
        ("CA",   Object::Real(opacity)),
    ]);
    doc.objects.insert(alpha_gs_id, Object::Dictionary(alpha_dict));

    for pid in &page_ids {
        let (width, height) = get_page_dimensions(&doc, pid);
        let (x, y, angle): (f32, f32, f32) = match position {
            "diagonal" => (width / 2.0, height / 2.0, 45.0),
            "top"      => (width / 2.0, height * 0.85, 0.0),
            "bottom"   => (width / 2.0, height * 0.1,  0.0),
            "center"   => (width / 2.0, height / 2.0,  0.0),
            _          => (width / 2.0, height / 2.0, 45.0),
        };

        let font_size = (width.min(height) * 0.08).max(12.0);
        let rad = angle.to_radians();
        let cos_a = rad.cos();
        let sin_a = rad.sin();
        let text_width_estimate = text.len() as f32 * font_size * 0.5;
        let safe_text = text.replace('\\', "\\\\").replace('(', "\\(").replace(')', "\\)");

        let content_str = format!(
            "q\n/Gs0 gs\n0.6 0.6 0.6 rg\nBT\n/Wm 1 Tf\n\
             {cos:.6} {sin:.6} -{sin:.6} {cos:.6} {tx:.2} {ty:.2} Tm\n\
             {fs} TL\n({txt}) Tj\nET\nQ\n",
            cos = cos_a,
            sin = sin_a,
            tx  = x - text_width_estimate / 2.0 * cos_a,
            ty  = y - text_width_estimate / 2.0 * sin_a,
            fs  = font_size,
            txt = safe_text,
        );

        let wm_stream = Stream::new(Dictionary::new(), content_str.into_bytes());
        let wm_id = doc.new_object_id();
        doc.objects.insert(wm_id, Object::Stream(wm_stream));

        let resources_id = get_or_create_resources_id(&mut doc, *pid)?;
        merge_named_resource(&mut doc, resources_id, b"Font", b"Wm", font_id)?;
        merge_named_resource(&mut doc, resources_id, b"ExtGState", b"Gs0", alpha_gs_id)?;

        append_page_contents(&mut doc, *pid, wm_id)?;
    }

    let mut out = Vec::new();
    doc.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| format!("Save error: {e}"))?;
    Ok(out)
}

#[wasm_bindgen]
pub fn add_watermark(
    data: &[u8],
    text: &str,
    opacity: f32,
    position: &str,
) -> Result<js_sys::Uint8Array, JsValue> {
    add_watermark_inner(data, text, opacity, position)
        .map(|out| js_sys::Uint8Array::from(out.as_slice()))
        .map_err(js_err)
}

fn get_page_dimensions(doc: &Document, page_id: &ObjectId) -> (f32, f32) {
    if let Some([x0, y0, x1, y1]) = resolve_page_box(doc, *page_id, b"MediaBox") {
        return ((x1 - x0).max(1.0), (y1 - y0).max(1.0));
    }
    (612.0, 792.0)
}

// ─── ADD PAGE NUMBERS ────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn add_page_numbers(
    data: &[u8],
    position: &str,
    start_num: i32,
    font_size: f32,
) -> Result<js_sys::Uint8Array, JsValue> {
    let mut doc = Document::load_mem(data)
        .map_err(|e| js_err(format!("Load error: {e}")))?;
    let page_ids: Vec<ObjectId> = doc.page_iter().collect();

    let font_id = doc.new_object_id();
    let font_dict = Dictionary::from_iter(vec![
        ("Type",     Object::Name(b"Font".to_vec())),
        ("Subtype",  Object::Name(b"Type1".to_vec())),
        ("BaseFont", Object::Name(b"Helvetica".to_vec())),
        ("Encoding", Object::Name(b"WinAnsiEncoding".to_vec())),
    ]);
    doc.objects.insert(font_id, Object::Dictionary(font_dict));

    for (idx, pid) in page_ids.iter().enumerate() {
        let page_num = start_num + idx as i32;
        let (width, height) = get_page_dimensions(&doc, pid);

        let (x, y): (f32, f32) = match position {
            "top-left"     => (36.0, height - 24.0),
            "top-center"   => (width / 2.0 - 10.0, height - 24.0),
            "top-right"    => (width - 50.0, height - 24.0),
            "bottom-left"  => (36.0, 18.0),
            "bottom-right" => (width - 50.0, 18.0),
            _              => (width / 2.0 - 10.0, 18.0),
        };

        let content_str = format!(
            "q\n0 0 0 rg\nBT\n/Pn 1 Tf\n{fs} 0 0 {fs} {x:.2} {y:.2} Tm\n({num}) Tj\nET\nQ\n",
            fs  = font_size,
            x   = x,
            y   = y,
            num = page_num,
        );

        let pn_stream = Stream::new(Dictionary::new(), content_str.into_bytes());
        let pn_id = doc.new_object_id();
        doc.objects.insert(pn_id, Object::Stream(pn_stream));

        let resources_id = get_or_create_resources_id(&mut doc, *pid).map_err(|e| js_err(e))?;
        merge_named_resource(&mut doc, resources_id, b"Font", b"Pn", font_id).map_err(|e| js_err(e))?;

        append_page_contents(&mut doc, *pid, pn_id).map_err(|e| js_err(e))?;
    }

    let mut out = Vec::new();
    doc.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(out.as_slice()))
}

// ─── PROTECT PDF ─────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn protect_pdf(data: &[u8], password: &str) -> Result<js_sys::Uint8Array, JsValue> {
    let mut doc = Document::load_mem(data)
        .map_err(|e| js_err(format!("Load error: {e}")))?;

    let hash = format!("{:016x}", simple_hash(password));
    let info_id = doc.new_object_id();
    let info_dict = Dictionary::from_iter(vec![
        ("Producer", Object::string_literal("I❤️localpdf".as_bytes().to_vec())),
        ("Creator",  Object::string_literal("I❤️localpdf".as_bytes().to_vec())),
        ("PasswordHash", Object::string_literal(hash.into_bytes())),
        ("Protected", Object::Boolean(true)),
    ]);
    doc.objects.insert(info_id, Object::Dictionary(info_dict));
    doc.trailer.set("Info", Object::Reference(info_id));

    let mut out = Vec::new();
    doc.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(out.as_slice()))
}

fn simple_hash(s: &str) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

// ─── UNLOCK PDF ──────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn unlock_pdf(data: &[u8], password: &str) -> Result<js_sys::Uint8Array, JsValue> {
    let mut doc = Document::load_mem(data)
        .map_err(|e| js_err(format!("Load error: {e}")))?;

    // Check if protected by our simple hash system
    let info_id_opt = match doc.trailer.get(b"Info") {
        Ok(Object::Reference(id)) => Some(*id),
        _ => None,
    };

    if let Some(info_id) = info_id_opt {
        let (is_protected, stored_hash) = match doc.objects.get(&info_id) {
            Some(Object::Dictionary(d)) => {
                let prot = d.get(b"Protected").ok()
                    .and_then(|b| b.as_bool().ok())
                    .unwrap_or(false);
                let hash = d.get(b"PasswordHash").ok()
                    .and_then(|s| s.as_str().ok())
                    .map(|bytes| String::from_utf8_lossy(bytes).into_owned())
                    .unwrap_or_default();
                (prot, hash)
            }
            _ => (false, String::new()),
        };

        if is_protected {
            let expected = format!("{:016x}", simple_hash(password));
            if stored_hash != expected {
                return Err(js_err("Incorrect password"));
            }
            // Remove protection markers
            if let Some(Object::Dictionary(ref mut info_dict)) = doc.objects.get_mut(&info_id) {
                info_dict.remove(b"PasswordHash");
                info_dict.remove(b"Protected");
            }
        }
    }

    let mut out = Vec::new();
    doc.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(out.as_slice()))
}

// ─── ORGANIZE PAGES ──────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn organize_pages(data: &[u8], order_json: &str) -> Result<js_sys::Uint8Array, JsValue> {
    let doc = Document::load_mem(data)
        .map_err(|e| js_err(format!("Load error: {e}")))?;
    let page_ids: Vec<ObjectId> = doc.page_iter().collect();
    let total = page_ids.len();

    let order: Vec<usize> = serde_json::from_str(order_json)
        .map_err(|e| js_err(format!("Bad order JSON: {e}")))?;

    let selected: Vec<ObjectId> = order.iter()
        .filter_map(|&i| if i >= 1 && i <= total { Some(page_ids[i - 1]) } else { None })
        .collect();

    let mut out_doc = extract_pages(&doc, &selected).map_err(|e| js_err(e))?;
    let mut out = Vec::new();
    out_doc.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(out.as_slice()))
}

// ─── DELETE PAGES ────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn delete_pages(data: &[u8], pages_json: &str) -> Result<js_sys::Uint8Array, JsValue> {
    let doc = Document::load_mem(data)
        .map_err(|e| js_err(format!("Load error: {e}")))?;
    let page_ids: Vec<ObjectId> = doc.page_iter().collect();
    let total = page_ids.len();

    let to_delete: std::collections::HashSet<usize> = {
        let nums: Vec<usize> = serde_json::from_str(pages_json)
            .map_err(|e| js_err(format!("Bad JSON: {e}")))?;
        nums.into_iter()
            .filter(|&i| i >= 1 && i <= total)
            .map(|i| i - 1)
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

// ─── IMAGES → PDF ────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn images_to_pdf(images_array: js_sys::Array) -> Result<js_sys::Uint8Array, JsValue> {
    let mut doc = Document::with_version("1.7");
    let pages_id = doc.new_object_id();
    let mut page_ids: Vec<ObjectId> = Vec::new();

    for item in images_array.iter() {
        let arr: js_sys::Uint8Array = item.dyn_into()?;
        let bytes: Vec<u8> = arr.to_vec();

        let img = image::load_from_memory(&bytes)
            .map_err(|e| js_err(format!("Image decode error: {e}")))?;

        let (img_w, img_h) = (img.width(), img.height());

        let mut jpeg_buf = Vec::new();
        let rgb = img.to_rgb8();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_buf, 90)
            .encode(&rgb, img_w, img_h, image::ExtendedColorType::Rgb8)
            .map_err(|e| js_err(format!("JPEG encode error: {e}")))?;

        let page_w = 595.0_f32;
        let page_h = 842.0_f32;
        let scale = (page_w / img_w as f32).min(page_h / img_h as f32);
        let draw_w = img_w as f32 * scale;
        let draw_h = img_h as f32 * scale;
        let x_off  = (page_w - draw_w) / 2.0;
        let y_off  = (page_h - draw_h) / 2.0;

        let img_dict = Dictionary::from_iter(vec![
            ("Type",             Object::Name(b"XObject".to_vec())),
            ("Subtype",          Object::Name(b"Image".to_vec())),
            ("Width",            Object::Integer(img_w as i64)),
            ("Height",           Object::Integer(img_h as i64)),
            ("ColorSpace",       Object::Name(b"DeviceRGB".to_vec())),
            ("BitsPerComponent", Object::Integer(8)),
            ("Filter",           Object::Name(b"DCTDecode".to_vec())),
            ("Length",           Object::Integer(jpeg_buf.len() as i64)),
        ]);
        let img_stream = Stream::new(img_dict, jpeg_buf);
        let img_id = doc.new_object_id();
        doc.objects.insert(img_id, Object::Stream(img_stream));

        let content_str = format!(
            "q\n{w:.2} 0 0 {h:.2} {x:.2} {y:.2} cm\n/Im1 Do\nQ\n",
            w = draw_w, h = draw_h, x = x_off, y = y_off
        );
        let content_stream = Stream::new(Dictionary::new(), content_str.into_bytes());
        let content_id = doc.new_object_id();
        doc.objects.insert(content_id, Object::Stream(content_stream));

        let mut xobject_dict = Dictionary::new();
        xobject_dict.set("Im1", Object::Reference(img_id));
        let resources_dict = Dictionary::from_iter(vec![
            ("XObject", Object::Dictionary(xobject_dict)),
        ]);

        let media_box = Object::Array(vec![
            Object::Integer(0), Object::Integer(0),
            Object::Real(page_w), Object::Real(page_h),
        ]);
        let page_dict = Dictionary::from_iter(vec![
            ("Type",      Object::Name(b"Page".to_vec())),
            ("Parent",    Object::Reference(pages_id)),
            ("MediaBox",  media_box),
            ("Contents",  Object::Reference(content_id)),
            ("Resources", Object::Dictionary(resources_dict)),
        ]);
        let page_id = doc.new_object_id();
        doc.objects.insert(page_id, Object::Dictionary(page_dict));
        page_ids.push(page_id);
    }

    let page_refs: Vec<Object> = page_ids.iter()
        .map(|id| Object::Reference(*id))
        .collect();
    let pages_dict = Dictionary::from_iter(vec![
        ("Type",  Object::Name(b"Pages".to_vec())),
        ("Kids",  Object::Array(page_refs)),
        ("Count", Object::Integer(page_ids.len() as i64)),
    ]);
    doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

    let catalog_id = doc.new_object_id();
    let catalog = Dictionary::from_iter(vec![
        ("Type",  Object::Name(b"Catalog".to_vec())),
        ("Pages", Object::Reference(pages_id)),
    ]);
    doc.objects.insert(catalog_id, Object::Dictionary(catalog));
    doc.trailer.set("Root", Object::Reference(catalog_id));

    let mut out = Vec::new();
    doc.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(out.as_slice()))
}

// ─── N-UP PDF (2-UP / 4-UP) ────────────────────────────────────────────────

#[wasm_bindgen]
pub fn nup_pdf(data: &[u8], nup: i32) -> Result<js_sys::Uint8Array, JsValue> {
    if nup != 2 && nup != 4 {
        return Err(js_err("nup must be 2 or 4"));
    }

    let src = Document::load_mem(data)
        .map_err(|e| js_err(format!("Load error: {e}")))?;
    let page_ids: Vec<ObjectId> = src.page_iter().collect();
    if page_ids.is_empty() {
        return Err(js_err("Input PDF has no pages"));
    }

    let mut out = Document::with_version("1.7");
    for (id, obj) in &src.objects {
        out.objects.insert(*id, obj.clone());
    }
    out.max_id = src.max_id;

    let mut forms: Vec<(ObjectId, f32, f32)> = Vec::with_capacity(page_ids.len());
    for pid in &page_ids {
        let media_box = resolve_page_box(&src, *pid, b"MediaBox").unwrap_or([0.0, 0.0, 612.0, 792.0]);
        let page_w = (media_box[2] - media_box[0]).max(1.0);
        let page_h = (media_box[3] - media_box[1]).max(1.0);
        let page_content = src.get_page_content(*pid)
            .map_err(|e| js_err(format!("Read page content error: {e}")))?;

        let mut form_dict = Dictionary::new();
        form_dict.set("Type", Object::Name(b"XObject".to_vec()));
        form_dict.set("Subtype", Object::Name(b"Form".to_vec()));
        form_dict.set("FormType", Object::Integer(1));
        form_dict.set("BBox", Object::Array(vec![
            Object::Real(0.0),
            Object::Real(0.0),
            Object::Real(page_w),
            Object::Real(page_h),
        ]));
        if let Some(resources_obj) = resolve_page_resources(&src, *pid) {
            form_dict.set("Resources", resources_obj);
        } else {
            form_dict.set("Resources", Object::Dictionary(Dictionary::new()));
        }

        let form_id = out.new_object_id();
        out.objects.insert(form_id, Object::Stream(Stream::new(form_dict, page_content)));
        forms.push((form_id, page_w, page_h));
    }

    let sheet_w = 841.89_f32; // A4 landscape
    let sheet_h = 595.28_f32;
    let cells: Vec<(f32, f32, f32, f32)> = if nup == 2 {
        vec![
            (0.0, 0.0, sheet_w / 2.0, sheet_h),
            (sheet_w / 2.0, 0.0, sheet_w / 2.0, sheet_h),
        ]
    } else {
        vec![
            (0.0, sheet_h / 2.0, sheet_w / 2.0, sheet_h / 2.0),          // top-left
            (sheet_w / 2.0, sheet_h / 2.0, sheet_w / 2.0, sheet_h / 2.0), // top-right
            (0.0, 0.0, sheet_w / 2.0, sheet_h / 2.0),                     // bottom-left
            (sheet_w / 2.0, 0.0, sheet_w / 2.0, sheet_h / 2.0),           // bottom-right
        ]
    };

    let pages_id = out.new_object_id();
    let mut new_page_ids: Vec<ObjectId> = Vec::new();
    let per_sheet = nup as usize;
    let total_sheets = (forms.len() + per_sheet - 1) / per_sheet;

    for sheet_idx in 0..total_sheets {
        let mut xobj_dict = Dictionary::new();
        let mut content = String::new();

        for slot in 0..per_sheet {
            let src_idx = sheet_idx * per_sheet + slot;
            if src_idx >= forms.len() {
                break;
            }

            let (form_id, src_w, src_h) = forms[src_idx];
            let (cell_x, cell_y, cell_w, cell_h) = cells[slot];
            let scale = (cell_w / src_w).min(cell_h / src_h);
            let draw_w = src_w * scale;
            let draw_h = src_h * scale;
            let tx = cell_x + (cell_w - draw_w) / 2.0;
            let ty = cell_y + (cell_h - draw_h) / 2.0;
            let name = format!("Nup{}", slot + 1);

            xobj_dict.set(name.as_str(), Object::Reference(form_id));
            content.push_str(&format!(
                "q\n{scale:.6} 0 0 {scale:.6} {tx:.3} {ty:.3} cm\n/{name} Do\nQ\n"
            ));
        }

        let content_id = out.new_object_id();
        out.objects.insert(content_id, Object::Stream(Stream::new(Dictionary::new(), content.into_bytes())));

        let resources = Dictionary::from_iter(vec![
            ("XObject", Object::Dictionary(xobj_dict)),
        ]);
        let page_dict = Dictionary::from_iter(vec![
            ("Type", Object::Name(b"Page".to_vec())),
            ("Parent", Object::Reference(pages_id)),
            ("MediaBox", Object::Array(vec![
                Object::Real(0.0),
                Object::Real(0.0),
                Object::Real(sheet_w),
                Object::Real(sheet_h),
            ])),
            ("Contents", Object::Reference(content_id)),
            ("Resources", Object::Dictionary(resources)),
        ]);

        let page_id = out.new_object_id();
        out.objects.insert(page_id, Object::Dictionary(page_dict));
        new_page_ids.push(page_id);
    }

    let page_refs: Vec<Object> = new_page_ids.iter().map(|id| Object::Reference(*id)).collect();
    let pages_dict = Dictionary::from_iter(vec![
        ("Type", Object::Name(b"Pages".to_vec())),
        ("Kids", Object::Array(page_refs)),
        ("Count", Object::Integer(new_page_ids.len() as i64)),
    ]);
    out.objects.insert(pages_id, Object::Dictionary(pages_dict));

    let catalog_id = out.new_object_id();
    let catalog = Dictionary::from_iter(vec![
        ("Type", Object::Name(b"Catalog".to_vec())),
        ("Pages", Object::Reference(pages_id)),
    ]);
    out.objects.insert(catalog_id, Object::Dictionary(catalog));
    out.trailer.set("Root", Object::Reference(catalog_id));
    out.trailer.remove(b"Info");
    out.trailer.remove(b"Encrypt");

    let mut buf = Vec::new();
    out.save_to(&mut Cursor::new(&mut buf))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(buf.as_slice()))
}

fn resolve_page_resources(doc: &Document, page_id: ObjectId) -> Option<Object> {
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

fn box_array_from_object(doc: &Document, obj: &Object) -> Option<[f32; 4]> {
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

fn resolve_page_box(doc: &Document, page_id: ObjectId, key: &[u8]) -> Option<[f32; 4]> {
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

// ─── GET PDF INFO ────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn get_pdf_info(data: &[u8]) -> Result<String, JsValue> {
    let doc = Document::load_mem(data)
        .map_err(|e| js_err(format!("Load error: {e}")))?;
    let page_count = doc.get_pages().len();
    Ok(format!(
        r#"{{"pages":{},"size":{}}}"#,
        page_count,
        data.len()
    ))
}

// ─── GET PAGE COUNT ──────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn get_page_count(data: &[u8]) -> Result<u32, JsValue> {
    let doc = Document::load_mem(data)
        .map_err(|e| js_err(format!("Load error: {e}")))?;
    Ok(doc.get_pages().len() as u32)
}

// ─── REPAIR PDF ──────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn repair_pdf(data: &[u8]) -> Result<js_sys::Uint8Array, JsValue> {
    let doc = Document::load_mem(data)
        .map_err(|e| js_err(format!("Could not parse/repair PDF: {e}")))?;
    let mut out = Vec::new();
    // save_to requires &mut self in some versions
    let mut doc2 = Document::with_version("1.7");
    for (id, obj) in &doc.objects {
        doc2.objects.insert(*id, obj.clone());
    }
    doc2.max_id = doc.max_id;
    // copy trailer root/info
    if let Ok(root) = doc.trailer.get(b"Root").cloned() {
        doc2.trailer.set("Root", root);
    }
    doc2.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(out.as_slice()))
}

#[cfg(test)]
mod watermark_tests {
    use super::*;

    fn minimal_pdf() -> Vec<u8> {
        let mut doc = Document::with_version("1.4");
        let font_id = doc.new_object_id();
        doc.objects.insert(
            font_id,
            Object::Dictionary(Dictionary::from_iter(vec![
                ("Type", Object::Name(b"Font".to_vec())),
                ("Subtype", Object::Name(b"Type1".to_vec())),
                ("BaseFont", Object::Name(b"Helvetica".to_vec())),
            ])),
        );

        let content_id = doc.new_object_id();
        let content = Stream::new(Dictionary::new(), b"BT /F1 24 Tf 72 720 Td (Hello) Tj ET".to_vec());
        doc.objects.insert(content_id, Object::Stream(content));

        let page_id = doc.new_object_id();
        let page = Dictionary::from_iter(vec![
            ("Type", Object::Name(b"Page".to_vec())),
            ("MediaBox", Object::Array(vec![
                Object::Integer(0),
                Object::Integer(0),
                Object::Integer(612),
                Object::Integer(792),
            ])),
            ("Contents", Object::Reference(content_id)),
            (
                "Resources",
                Object::Dictionary(Dictionary::from_iter(vec![(
                    "Font",
                    Object::Dictionary(Dictionary::from_iter(vec![(
                        "F1",
                        Object::Reference(font_id),
                    )])),
                )])),
            ),
        ]);
        doc.objects.insert(page_id, Object::Dictionary(page));

        let pages_id = doc.new_object_id();
        doc.objects.insert(
            pages_id,
            Object::Dictionary(Dictionary::from_iter(vec![
                ("Type", Object::Name(b"Pages".to_vec())),
                ("Kids", Object::Array(vec![Object::Reference(page_id)])),
                ("Count", Object::Integer(1)),
            ])),
        );

        let catalog_id = doc.new_object_id();
        doc.objects.insert(
            catalog_id,
            Object::Dictionary(Dictionary::from_iter(vec![
                ("Type", Object::Name(b"Catalog".to_vec())),
                ("Pages", Object::Reference(pages_id)),
            ])),
        );
        doc.trailer.set("Root", Object::Reference(catalog_id));

        let mut out = Vec::new();
        doc.save_to(&mut Cursor::new(&mut out)).unwrap();
        out
    }

    #[test]
    fn watermark_embeds_text_in_output() {
        let input = minimal_pdf();
        let out = add_watermark_inner(&input, "CONFIDENTIAL", 0.3, "diagonal").unwrap();
        let out_str = String::from_utf8_lossy(&out);
        assert!(
            out_str.contains("CONFIDENTIAL"),
            "output should contain watermark text"
        );
    }

    fn pdf_with_indirect_font_resources() -> Vec<u8> {
        let mut doc = Document::with_version("1.4");
        let font_id = doc.new_object_id();
        doc.objects.insert(
            font_id,
            Object::Dictionary(Dictionary::from_iter(vec![
                ("Type", Object::Name(b"Font".to_vec())),
                ("Subtype", Object::Name(b"Type1".to_vec())),
                ("BaseFont", Object::Name(b"Helvetica".to_vec())),
            ])),
        );
        let fonts_id = doc.new_object_id();
        doc.objects.insert(
            fonts_id,
            Object::Dictionary(Dictionary::from_iter(vec![(
                "F1",
                Object::Reference(font_id),
            )])),
        );
        let resources_id = doc.new_object_id();
        doc.objects.insert(
            resources_id,
            Object::Dictionary(Dictionary::from_iter(vec![(
                "Font",
                Object::Reference(fonts_id),
            )])),
        );
        let media_id = doc.new_object_id();
        doc.objects.insert(
            media_id,
            Object::Array(vec![
                Object::Integer(0),
                Object::Integer(0),
                Object::Integer(612),
                Object::Integer(792),
            ]),
        );
        let content_id = doc.new_object_id();
        doc.objects.insert(
            content_id,
            Object::Stream(Stream::new(
                Dictionary::new(),
                b"BT /F1 12 Tf 72 720 Td (Hello) Tj ET".to_vec(),
            )),
        );
        let page_id = doc.new_object_id();
        doc.objects.insert(
            page_id,
            Object::Dictionary(Dictionary::from_iter(vec![
                ("Type", Object::Name(b"Page".to_vec())),
                ("MediaBox", Object::Reference(media_id)),
                ("Contents", Object::Reference(content_id)),
                ("Resources", Object::Reference(resources_id)),
            ])),
        );
        let pages_id = doc.new_object_id();
        doc.objects.insert(
            pages_id,
            Object::Dictionary(Dictionary::from_iter(vec![
                ("Type", Object::Name(b"Pages".to_vec())),
                ("Kids", Object::Array(vec![Object::Reference(page_id)])),
                ("Count", Object::Integer(1)),
            ])),
        );
        let catalog_id = doc.new_object_id();
        doc.objects.insert(
            catalog_id,
            Object::Dictionary(Dictionary::from_iter(vec![
                ("Type", Object::Name(b"Catalog".to_vec())),
                ("Pages", Object::Reference(pages_id)),
            ])),
        );
        doc.trailer.set("Root", Object::Reference(catalog_id));
        let mut out = Vec::new();
        doc.save_to(&mut Cursor::new(&mut out)).unwrap();
        out
    }

    #[test]
    fn watermark_preserves_indirect_font_resources() {
        let input = pdf_with_indirect_font_resources();
        let out = add_watermark_inner(&input, "CONFIDENTIAL", 0.3, "diagonal").unwrap();
        assert!(String::from_utf8_lossy(&out).contains("CONFIDENTIAL"));
        let doc = Document::load_mem(&out).unwrap();
        let fonts = doc.objects.get(&fonts_id_from_resources(&doc).1).unwrap();
        let Object::Dictionary(fonts_dict) = fonts else {
            panic!("expected font dictionary");
        };
        assert!(fonts_dict.has(b"F1"), "original font should remain");
        assert!(fonts_dict.has(b"Wm"), "watermark font should be added");
    }

    fn fonts_id_from_resources(doc: &Document) -> (ObjectId, ObjectId) {
        let page_id = doc.page_iter().next().unwrap();
        let res_id = match doc
            .objects
            .get(&page_id)
            .and_then(|o| o.as_dict().ok())
            .and_then(|d| d.get(b"Resources").ok())
        {
            Some(Object::Reference(id)) => *id,
            _ => panic!("expected indirect resources"),
        };
        let font_ref = doc
            .objects
            .get(&res_id)
            .and_then(|o| o.as_dict().ok())
            .and_then(|d| d.get(b"Font").ok())
            .and_then(|o| match o {
                Object::Reference(id) => Some(*id),
                _ => None,
            })
            .expect("expected indirect font dict");
        (res_id, font_ref)
    }

    #[test]
    fn watermark_appends_content_stream() {
        let input = minimal_pdf();
        let out = add_watermark_inner(&input, "TEST", 0.5, "center").unwrap();
        let doc = Document::load_mem(&out).unwrap();
        let page_id = doc.page_iter().next().unwrap();
        let contents = doc
            .objects
            .get(&page_id)
            .and_then(|o| o.as_dict().ok())
            .and_then(|d| d.get(b"Contents").ok());
        match contents {
            Some(Object::Array(arr)) => assert!(arr.len() >= 2, "should append watermark stream"),
            _ => panic!("expected Contents array after watermark, got {:?}", contents),
        }
    }
}
