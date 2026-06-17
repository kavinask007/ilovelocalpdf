use super::analyze::ResourceAnalysis;
use lopdf::content::{Content, Operation};
use lopdf::{Document, Object, ObjectId};
use std::collections::{HashMap, HashSet};

/// Glyph bytes used per font object id (from content stream analysis).
pub type FontUsage = HashMap<ObjectId, HashSet<Vec<u8>>>;

/// Collect character codes used by each font object referenced on pages.
pub fn collect_font_usage(doc: &Document, analysis: &ResourceAnalysis) -> FontUsage {
    let mut page_font_maps: HashMap<ObjectId, HashMap<Vec<u8>, ObjectId>> = HashMap::new();

    for (&page_id, &res_id) in &analysis.page_resources {
        if let Some(map) = build_font_name_map(doc, res_id) {
            page_font_maps.insert(page_id, map);
        }
    }

    let mut usage: FontUsage = HashMap::new();

    for page_id in doc.page_iter() {
        let font_map = match page_font_maps.get(&page_id) {
            Some(m) => m,
            None => continue,
        };

        let content = match doc.get_and_decode_page_content(page_id) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut current_font: Option<ObjectId> = None;
        for op in &content.operations {
            match op.operator.as_str() {
                "Tf" => {
                    if let Some(Object::Name(name)) = op.operands.first() {
                        current_font = font_map.get(name).copied();
                    }
                }
                "Tj" => {
                    if let (Some(font_id), Some(bytes)) =
                        (current_font, extract_string_bytes(&op.operands))
                    {
                        usage.entry(font_id).or_default().extend(bytes);
                    }
                }
                "TJ" => {
                    if let Some(font_id) = current_font {
                        let glyphs = extract_tj_array_bytes(&op.operands);
                        usage.entry(font_id).or_default().extend(glyphs);
                    }
                }
                "'" | "\"" => {
                    if let (Some(font_id), Some(bytes)) =
                        (current_font, extract_string_bytes(&op.operands))
                    {
                        usage.entry(font_id).or_default().extend(bytes);
                    }
                }
                _ => {}
            }
        }
    }

    usage
}

fn build_font_name_map(doc: &Document, res_id: ObjectId) -> Option<HashMap<Vec<u8>, ObjectId>> {
    let res_dict = doc.objects.get(&res_id)?.as_dict().ok()?;
    let fonts = res_dict.get(b"Font").ok()?.as_dict().ok()?;
    let mut map = HashMap::new();
    for (name, font_ref) in fonts.iter() {
        if let Ok(font_id) = font_ref.as_reference() {
            map.insert(name.clone(), font_id);
        }
    }
    Some(map)
}

fn extract_string_bytes(operands: &[Object]) -> Option<Vec<Vec<u8>>> {
    operands.first().and_then(|o| match o {
        Object::String(bytes, _) => Some(vec![bytes.clone()]),
        _ => None,
    })
}

fn extract_tj_array_bytes(operands: &[Object]) -> Vec<Vec<u8>> {
    let mut out = Vec::new();
    if let Some(Object::Array(arr)) = operands.first() {
        for item in arr {
            if let Object::String(bytes, _) = item {
                out.push(bytes.clone());
            }
        }
    }
    out
}

/// Deduplicate font file streams and font dictionaries with identical embedded data.
pub fn deduplicate_fonts(doc: &mut Document, analysis: &ResourceAnalysis) -> HashMap<ObjectId, ObjectId> {
    let mut remapping = HashMap::new();
    deduplicate_font_file_streams(doc, analysis, &mut remapping);
    deduplicate_font_dictionaries(doc, analysis, &mut remapping);
    remapping
}

fn font_file_fingerprint(doc: &Document, id: ObjectId) -> Option<Vec<u8>> {
    let stream = doc.objects.get(&id)?.as_stream().ok()?;
    let content = stream
        .get_plain_content()
        .unwrap_or_else(|_| stream.content.clone());
    Some(content)
}

fn deduplicate_font_file_streams(
    doc: &Document,
    analysis: &ResourceAnalysis,
    remapping: &mut HashMap<ObjectId, ObjectId>,
) {
    let mut seen: HashMap<Vec<u8>, ObjectId> = HashMap::new();

    for &id in &analysis.font_file_streams {
        let fp = match font_file_fingerprint(doc, id) {
            Some(f) => f,
            None => continue,
        };
        if let Some(&canonical) = seen.get(&fp) {
            remapping.insert(id, canonical);
        } else {
            seen.insert(fp, id);
        }
    }
}

fn font_dict_fingerprint(doc: &Document, font_id: ObjectId) -> Option<Vec<u8>> {
    let dict = doc.objects.get(&font_id)?.as_dict().ok()?;
    let base_font = dict.get(b"BaseFont").ok()?.as_name().ok()?;

    let file_fp = dict
        .get(b"FontDescriptor")
        .ok()
        .and_then(|o| o.as_reference().ok())
        .and_then(|desc_id| doc.objects.get(&desc_id))
        .and_then(|o| o.as_dict().ok())
        .and_then(|desc| {
            for key in [b"FontFile".as_slice(), b"FontFile2", b"FontFile3"] {
                if let Ok(file_ref) = desc.get(key).and_then(|o| o.as_reference()) {
                    return font_file_fingerprint(doc, file_ref);
                }
            }
            None
        });

    let mut fp = base_font.to_vec();
    if let Some(file) = file_fp {
        fp.extend_from_slice(&file);
    }
    Some(fp)
}

fn deduplicate_font_dictionaries(
    doc: &Document,
    analysis: &ResourceAnalysis,
    remapping: &mut HashMap<ObjectId, ObjectId>,
) {
    let mut seen: HashMap<Vec<u8>, ObjectId> = HashMap::new();

    for &font_id in &analysis.font_objects {
        let resolved = resolve_id(font_id, remapping);
        if remapping.contains_key(&font_id) {
            continue;
        }
        let fp = match font_dict_fingerprint(doc, resolved) {
            Some(f) => f,
            None => continue,
        };
        if let Some(&canonical) = seen.get(&fp) {
            remapping.insert(font_id, canonical);
        } else {
            seen.insert(fp, font_id);
        }
    }
}

fn resolve_id(id: ObjectId, remapping: &HashMap<ObjectId, ObjectId>) -> ObjectId {
    let mut current = id;
    while let Some(&next) = remapping.get(&current) {
        if next == current {
            break;
        }
        current = next;
    }
    current
}

/// Re-encode page content streams with compact operator layout (lossless for text PDFs).
pub fn compact_content_streams(doc: &mut Document, analysis: &ResourceAnalysis) {
    for &stream_id in &analysis.content_streams {
        let plain = {
            let stream = match doc.objects.get(&stream_id).and_then(|o| o.as_stream().ok()) {
                Some(s) => s,
                None => continue,
            };
            match stream.get_plain_content() {
                Ok(p) => p,
                Err(_) => continue,
            }
        };

        let content = match Content::<Vec<Operation>>::decode(&plain) {
            Ok(c) => c,
            Err(_) => continue,
        };

        if let Ok(encoded) = content.encode() {
            if encoded.len() < plain.len() {
                if let Some(Object::Stream(stream)) = doc.objects.get_mut(&stream_id) {
                    stream.set_plain_content(encoded);
                }
            }
        }
    }
}
