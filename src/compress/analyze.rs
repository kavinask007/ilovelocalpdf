use lopdf::{Document, Object, ObjectId};
use std::collections::{HashMap, HashSet};

/// Resources and objects discovered during PDF analysis.
#[derive(Debug, Default)]
pub struct ResourceAnalysis {
    pub referenced: HashSet<ObjectId>,
    pub content_streams: Vec<ObjectId>,
    pub font_objects: HashSet<ObjectId>,
    pub font_file_streams: HashSet<ObjectId>,
    pub xobject_streams: HashSet<ObjectId>,
    pub page_resources: HashMap<ObjectId, ObjectId>,
}

pub fn analyze_resources(doc: &Document) -> ResourceAnalysis {
    let mut analysis = ResourceAnalysis::default();

    for page_id in doc.page_iter() {
        collect_page_resources(doc, page_id, &mut analysis);
        collect_content_streams(doc, page_id, &mut analysis);
    }

    if let Ok(root) = doc.trailer.get(b"Root").and_then(Object::as_reference) {
        collect_refs_from_object(doc, root, &mut analysis.referenced);
    }

    analysis
}

fn collect_page_resources(doc: &Document, page_id: ObjectId, analysis: &mut ResourceAnalysis) {
    analysis.referenced.insert(page_id);

    let resources = match doc
        .objects
        .get(&page_id)
        .and_then(|o| o.as_dict().ok())
        .and_then(|d| d.get(b"Resources").ok())
    {
        Some(obj) => obj.clone(),
        None => return,
    };

    let res_id = match resources {
        Object::Reference(id) => id,
        Object::Dictionary(_) => return,
        _ => return,
    };

    analysis.page_resources.insert(page_id, res_id);
    analysis.referenced.insert(res_id);
    collect_refs_from_object(doc, res_id, &mut analysis.referenced);

    if let Some(Object::Dictionary(res_dict)) = doc.objects.get(&res_id) {
        if let Ok(fonts) = res_dict.get(b"Font").and_then(Object::as_dict) {
            for (_, font_ref) in fonts.iter() {
                if let Ok(font_id) = font_ref.as_reference() {
                    analysis.font_objects.insert(font_id);
                    collect_font_files(doc, font_id, analysis);
                }
            }
        }

        if let Ok(xobjects) = res_dict.get(b"XObject").and_then(Object::as_dict) {
            for (_, xobj_ref) in xobjects.iter() {
                if let Ok(xobj_id) = xobj_ref.as_reference() {
                    if is_image_xobject(doc, xobj_id) {
                        analysis.xobject_streams.insert(xobj_id);
                    }
                    analysis.referenced.insert(xobj_id);
                }
            }
        }
    }
}

fn collect_font_files(doc: &Document, font_id: ObjectId, analysis: &mut ResourceAnalysis) {
    analysis.referenced.insert(font_id);

    let font_dict = match doc.objects.get(&font_id).and_then(|o| o.as_dict().ok()) {
        Some(d) => d,
        None => return,
    };

    if let Ok(desc_ref) = font_dict.get(b"FontDescriptor").and_then(Object::as_reference) {
        analysis.referenced.insert(desc_ref);
        if let Some(Object::Dictionary(desc)) = doc.objects.get(&desc_ref) {
            for key in [b"FontFile".as_slice(), b"FontFile2", b"FontFile3"] {
                if let Ok(file_ref) = desc.get(key).and_then(Object::as_reference) {
                    analysis.font_file_streams.insert(file_ref);
                    analysis.referenced.insert(file_ref);
                }
            }
        }
    }

    if let Ok(descendant_ref) = font_dict.get(b"DescendantFonts").and_then(|o| o.as_array()) {
        for item in descendant_ref {
            if let Ok(cid_id) = item.as_reference() {
                collect_font_files(doc, cid_id, analysis);
            }
        }
    }
}

fn is_image_xobject(doc: &Document, xobj_id: ObjectId) -> bool {
    doc.objects
        .get(&xobj_id)
        .and_then(|o| o.as_stream().ok())
        .and_then(|s| s.dict.get(b"Subtype").ok())
        .and_then(|o| o.as_name().ok())
        .map(|n| n == b"Image")
        .unwrap_or(false)
}

fn collect_content_streams(doc: &Document, page_id: ObjectId, analysis: &mut ResourceAnalysis) {
    for stream_id in doc.get_page_contents(page_id) {
        analysis.content_streams.push(stream_id);
        analysis.referenced.insert(stream_id);
    }
}

fn collect_refs_from_object(doc: &Document, id: ObjectId, seen: &mut HashSet<ObjectId>) {
    if !seen.insert(id) {
        return;
    }

    let obj = match doc.objects.get(&id) {
        Some(o) => o,
        None => return,
    };

    match obj {
        Object::Reference(rid) => collect_refs_from_object(doc, *rid, seen),
        Object::Array(arr) => {
            for item in arr {
                if let Ok(rid) = item.as_reference() {
                    collect_refs_from_object(doc, rid, seen);
                }
            }
        }
        Object::Dictionary(dict) => {
            for (_, v) in dict.iter() {
                if let Ok(rid) = v.as_reference() {
                    collect_refs_from_object(doc, rid, seen);
                }
            }
        }
        Object::Stream(stream) => {
            for (_, v) in stream.dict.iter() {
                if let Ok(rid) = v.as_reference() {
                    collect_refs_from_object(doc, rid, seen);
                }
            }
        }
        _ => {}
    }
}
