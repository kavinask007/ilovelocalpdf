use flate2::write::ZlibEncoder;
use flate2::Compression;
use lopdf::{Document, Object, Stream};
use std::io::Write;

/// Decompress all streams, then recompress with maximum flate level.
/// Works on text content streams and other non-image streams.
pub fn reflate_compress(doc: &mut Document) {
    doc.decompress();

    let ids: Vec<_> = doc.objects.keys().copied().collect();
    for id in ids {
        if let Some(Object::Stream(stream)) = doc.objects.get_mut(&id) {
            if stream.allows_compression && !is_image_stream(stream) {
                let _ = recompress_stream(stream);
            }
        }
    }
}

fn is_image_stream(stream: &Stream) -> bool {
    stream
        .dict
        .get(b"Subtype")
        .ok()
        .and_then(|o| o.as_name().ok())
        .map(|n| n == b"Image")
        .unwrap_or(false)
}

fn recompress_stream(stream: &mut Stream) -> bool {
    let plain = match stream.get_plain_content() {
        Ok(p) => p,
        Err(_) => stream.content.clone(),
    };

    if plain.is_empty() {
        return false;
    }

    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::best());
    if encoder.write_all(&plain).is_err() {
        return false;
    }
    let compressed = match encoder.finish() {
        Ok(c) => c,
        Err(_) => return false,
    };

    // Keep compression only when it saves space (account for filter dict overhead).
    if compressed.len() + 19 < plain.len() {
        stream.dict.set("Filter", Object::Name(b"FlateDecode".to_vec()));
        stream.dict.remove(b"DecodeParms");
        stream.set_content(compressed);
        true
    } else if stream.dict.get(b"Filter").is_err() {
        stream.set_content(plain);
        false
    } else {
        false
    }
}

/// Pack small indirect objects into object streams where possible.
/// lopdf cannot write ObjStm entries to xref, so we compact object numbering instead
/// to reduce xref table overhead for text-heavy PDFs.
pub fn compact_object_numbering(doc: &mut Document) {
    doc.renumber_objects();
}
