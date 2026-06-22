use wasm_bindgen::prelude::*;
use lopdf::{Document, Object, ObjectId, Dictionary, Stream};
use std::io::Cursor;
use crate::util::js_err;

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
