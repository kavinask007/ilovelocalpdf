use wasm_bindgen::prelude::*;
use lopdf::{Document, Object, ObjectId, Dictionary, Stream};
use std::io::Cursor;
use crate::util::{js_err, load_doc, resolve_page_box, resolve_page_resources};

#[wasm_bindgen]
pub fn nup_pdf(data: &[u8], nup: i32) -> Result<js_sys::Uint8Array, JsValue> {
    if nup != 2 && nup != 4 {
        return Err(js_err("nup must be 2 or 4"));
    }

    let src = load_doc(data).map_err(js_err)?;
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

    let sheet_w = 841.89_f32;
    let sheet_h = 595.28_f32;
    let cells: Vec<(f32, f32, f32, f32)> = if nup == 2 {
        vec![
            (0.0, 0.0, sheet_w / 2.0, sheet_h),
            (sheet_w / 2.0, 0.0, sheet_w / 2.0, sheet_h),
        ]
    } else {
        vec![
            (0.0, sheet_h / 2.0, sheet_w / 2.0, sheet_h / 2.0),
            (sheet_w / 2.0, sheet_h / 2.0, sheet_w / 2.0, sheet_h / 2.0),
            (0.0, 0.0, sheet_w / 2.0, sheet_h / 2.0),
            (sheet_w / 2.0, 0.0, sheet_w / 2.0, sheet_h / 2.0),
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
    out.prune_objects();

    let mut buf = Vec::new();
    out.save_to(&mut Cursor::new(&mut buf))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(buf.as_slice()))
}
