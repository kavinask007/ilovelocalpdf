use wasm_bindgen::prelude::*;
use lopdf::{Object, ObjectId, Dictionary, Stream};
use std::io::Cursor;
use crate::util::{js_err, get_page_dimensions, load_doc, make_helvetica_font};
use crate::page_ops::{get_or_create_resources_id, append_page_contents, merge_named_resource};

#[wasm_bindgen]
pub fn add_page_numbers(
    data: &[u8],
    position: &str,
    start_num: i32,
    font_size: f32,
) -> Result<js_sys::Uint8Array, JsValue> {
    let mut doc = load_doc(data).map_err(js_err)?;
    let page_ids: Vec<ObjectId> = doc.page_iter().collect();

    let font_id = make_helvetica_font(&mut doc, false);

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
