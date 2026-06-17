mod analyze;
mod dedup;
mod fonts;
mod streams;

use analyze::analyze_resources;
use dedup::{apply_remapping, find_duplicate_dictionaries, find_duplicate_streams, merge_remappings};
use fonts::{collect_font_usage, compact_content_streams, deduplicate_fonts};
use lopdf::{Document, Object};
use streams::{compact_object_numbering, reflate_compress};

pub fn optimize_pdf(doc: &mut Document) -> Result<(), String> {
    if doc.trailer.get(b"Encrypt").is_ok() {
        return Err(
            "Cannot compress encrypted PDFs. Unlock the file first, then compress.".into(),
        );
    }

    // 1. Resource analysis
    let analysis = analyze_resources(doc);

    // 2. Font usage tracking (enables dedup; full glyph subsetting needs font binaries)
    let _font_usage = collect_font_usage(doc, &analysis);

    // 3. Font deduplication (identical embedded fonts across pages)
    let font_remap = deduplicate_fonts(doc, &analysis);

    // 4. Duplicate stream & dictionary removal
    let stream_remap = find_duplicate_streams(doc);
    let dict_remap = find_duplicate_dictionaries(doc);
    let remapping = merge_remappings(&[font_remap, stream_remap, dict_remap]);
    apply_remapping(doc, &remapping);

    // 5. Compact content stream encoding (text PDFs)
    let analysis = analyze_resources(doc);
    compact_content_streams(doc, &analysis);

    // 6. Object numbering compaction (xref size reduction)
    compact_object_numbering(doc);

    // 7. Unused object garbage collection
    doc.prune_objects();
    doc.delete_zero_length_streams();

    // 8. Flate recompression (decompress → best-level recompress)
    reflate_compress(doc);

    // Strip metadata that bloats output without value
    doc.trailer.remove(b"Prev");
    if let Ok(info) = doc.trailer.get(b"Info").and_then(Object::as_reference) {
        if let Some(Object::Dictionary(dict)) = doc.objects.get_mut(&info) {
            dict.remove(b"ModDate");
            dict.remove(b"CreationDate");
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::{Dictionary, Stream};
    use std::io::Cursor;

    fn text_pdf_with_duplicate_stream() -> Vec<u8> {
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

        let res_id = doc.new_object_id();
        doc.objects.insert(
            res_id,
            Object::Dictionary(Dictionary::from_iter(vec![(
                "Font",
                Object::Dictionary(Dictionary::from_iter(vec![(
                    "F1",
                    Object::Reference(font_id),
                )])),
            )])),
        );

        let content_data = b"BT /F1 12 Tf 100 700 Td (Hello World) Tj ET".to_vec();
        let stream1 = doc.add_object(Stream::new(Dictionary::new(), content_data.clone()));
        let stream2 = doc.add_object(Stream::new(Dictionary::new(), content_data));

        let page_id = doc.new_object_id();
        doc.objects.insert(
            page_id,
            Object::Dictionary(Dictionary::from_iter(vec![
                ("Type", Object::Name(b"Page".to_vec())),
                ("Resources", Object::Reference(res_id)),
                (
                    "Contents",
                    Object::Array(vec![
                        Object::Reference(stream1),
                        Object::Reference(stream2),
                    ]),
                ),
                ("MediaBox", Object::Array(vec![0.into(), 0.into(), 612.into(), 792.into()])),
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
    fn optimize_deduplicates_identical_content_streams() {
        let input = text_pdf_with_duplicate_stream();
        let input_len = input.len();
        let mut doc = Document::load_mem(&input).unwrap();
        let before_count = doc.objects.len();

        optimize_pdf(&mut doc).unwrap();

        assert!(doc.objects.len() < before_count);
        let mut out = Vec::new();
        doc.save_to(&mut Cursor::new(&mut out)).unwrap();
        assert!(out.len() <= input_len);
    }

    #[test]
    fn optimize_rejects_encrypted_pdf() {
        let mut doc = Document::with_version("1.4");
        doc.trailer.set("Encrypt", Object::Dictionary(Dictionary::new()));
        let err = optimize_pdf(&mut doc).unwrap_err();
        assert!(err.contains("encrypted"));
    }
}
