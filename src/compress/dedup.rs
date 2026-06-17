use lopdf::{Document, Object, ObjectId, Stream};
use std::collections::HashMap;

/// Build a map from duplicate object ids to their canonical representative.
pub fn find_duplicate_streams(doc: &Document) -> HashMap<ObjectId, ObjectId> {
    let mut seen: HashMap<Vec<u8>, ObjectId> = HashMap::new();
    let mut remapping = HashMap::new();

    let ids: Vec<ObjectId> = doc.objects.keys().copied().collect();
    for id in ids {
        let stream = match doc.objects.get(&id).and_then(|o| o.as_stream().ok()) {
            Some(s) => s,
            None => continue,
        };

        if is_font_program_stream(stream) {
            continue;
        }

        let fp = stream_fingerprint(stream);
        if let Some(&canonical) = seen.get(&fp) {
            if canonical != id {
                remapping.insert(id, canonical);
            }
        } else {
            seen.insert(fp, id);
        }
    }

    remapping
}

/// Deduplicate non-stream objects with identical structure (e.g. repeated ExtGState, ColorSpace).
pub fn find_duplicate_dictionaries(doc: &Document) -> HashMap<ObjectId, ObjectId> {
    let mut seen: HashMap<Vec<u8>, ObjectId> = HashMap::new();
    let mut remapping = HashMap::new();

    let ids: Vec<ObjectId> = doc.objects.keys().copied().collect();
    for id in ids {
        let dict = match doc.objects.get(&id) {
            Some(Object::Dictionary(d)) => d,
            _ => continue,
        };

        if is_protected_type(dict) {
            continue;
        }

        let fp = dictionary_fingerprint(dict);
        if let Some(&canonical) = seen.get(&fp) {
            if canonical != id {
                remapping.insert(id, canonical);
            }
        } else {
            seen.insert(fp, id);
        }
    }

    remapping
}

pub fn merge_remappings(maps: &[HashMap<ObjectId, ObjectId>]) -> HashMap<ObjectId, ObjectId> {
    let mut merged = HashMap::new();
    for map in maps {
        for (&dup, &canonical) in map {
            let resolved = resolve_chain(canonical, &merged);
            if dup != resolved {
                merged.insert(dup, resolved);
            }
        }
    }
    merged
}

pub fn apply_remapping(doc: &mut Document, remapping: &HashMap<ObjectId, ObjectId>) {
    if remapping.is_empty() {
        return;
    }

    doc.traverse_objects(|obj| {
        remap_object_refs(obj, remapping);
    });

    for &dup_id in remapping.keys() {
        doc.objects.remove(&dup_id);
    }
}

fn remap_object_refs(obj: &mut Object, remapping: &HashMap<ObjectId, ObjectId>) {
    match obj {
        Object::Reference(id) => {
            *id = resolve_chain(*id, remapping);
        }
        Object::Array(arr) => {
            for item in arr.iter_mut() {
                remap_object_refs(item, remapping);
            }
        }
        Object::Dictionary(dict) => {
            for (_, v) in dict.iter_mut() {
                remap_object_refs(v, remapping);
            }
        }
        Object::Stream(stream) => {
            for (_, v) in stream.dict.iter_mut() {
                remap_object_refs(v, remapping);
            }
        }
        _ => {}
    }
}

fn resolve_chain(mut id: ObjectId, remapping: &HashMap<ObjectId, ObjectId>) -> ObjectId {
    while let Some(&next) = remapping.get(&id) {
        if next == id {
            break;
        }
        id = next;
    }
    id
}

fn stream_fingerprint(stream: &Stream) -> Vec<u8> {
    let content = stream
        .get_plain_content()
        .unwrap_or_else(|_| stream.content.clone());

    let mut fp = content;
    for (k, v) in stream.dict.iter() {
        if k.as_slice() == b"Length" || k.as_slice() == b"Filter" || k.as_slice() == b"DecodeParms" {
            continue;
        }
        fp.extend_from_slice(k);
        fp.extend_from_slice(&object_bytes(v));
    }
    fp
}

fn dictionary_fingerprint(dict: &lopdf::Dictionary) -> Vec<u8> {
    let mut fp = Vec::new();
    for (k, v) in dict.iter() {
        fp.extend_from_slice(k);
        fp.extend_from_slice(&object_bytes(v));
    }
    fp
}

fn object_bytes(obj: &Object) -> Vec<u8> {
    match obj {
        Object::Name(n) => n.clone(),
        Object::Integer(i) => i.to_le_bytes().to_vec(),
        Object::Real(f) => f.to_le_bytes().to_vec(),
        Object::String(s, _) => s.clone(),
        Object::Boolean(b) => vec![u8::from(*b)],
        Object::Reference((a, b)) => {
            let mut v = a.to_le_bytes().to_vec();
            v.extend_from_slice(&b.to_le_bytes());
            v
        }
        Object::Array(arr) => {
            let mut v = Vec::new();
            for item in arr {
                v.extend_from_slice(&object_bytes(item));
            }
            v
        }
        Object::Dictionary(d) => dictionary_fingerprint(d),
        _ => Vec::new(),
    }
}

fn is_font_program_stream(stream: &Stream) -> bool {
    stream
        .dict
        .get(b"Subtype")
        .ok()
        .and_then(|o| o.as_name().ok())
        .map(|n| n == b"Type1C" || n == b"CIDFontType0C" || n == b"OpenType")
        .unwrap_or(false)
        || stream.dict.has(b"Length1")
}

fn is_protected_type(dict: &lopdf::Dictionary) -> bool {
    if let Ok(t) = dict.get(b"Type").and_then(Object::as_name) {
        matches!(t, b"Page" | b"Pages" | b"Catalog" | b"Outlines" | b"OCG")
    } else {
        false
    }
}
