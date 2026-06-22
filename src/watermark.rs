use wasm_bindgen::prelude::*;
use lopdf::{Object, ObjectId, Dictionary, Stream};
use std::io::Cursor;
use crate::util::{js_err, get_page_dimensions, load_doc, make_helvetica_font};
use crate::page_ops::{get_or_create_resources_id, append_page_contents, merge_named_resource};

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

fn add_watermark_inner(
    data: &[u8],
    text: &str,
    opacity: f32,
    position: &str,
) -> Result<Vec<u8>, String> {
    let mut doc = load_doc(data)?;
    let page_ids: Vec<ObjectId> = doc.page_iter().collect();

    let font_id = make_helvetica_font(&mut doc, true);

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
        let mut safe_text = String::with_capacity(text.len() + 8);
        for c in text.chars() {
            match c {
                '\\' => safe_text.push_str("\\\\"),
                '('  => safe_text.push_str("\\("),
                ')'  => safe_text.push_str("\\)"),
                '\n' => safe_text.push_str("\\n"),
                '\r' => safe_text.push_str("\\r"),
                '\t' => safe_text.push_str("\\t"),
                c if (c as u32) < 32 => safe_text.push_str(&format!("\\{:o}", c as u8)),
                c => safe_text.push(c),
            }
        }

        let content_str = format!(
             "q\n/Gs0 gs\n0.6 0.6 0.6 rg\nBT\n/Wm {fs} Tf\n\
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

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::{Document, Dictionary, Stream};
    use std::io::Cursor;

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
