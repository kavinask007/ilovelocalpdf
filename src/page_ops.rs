use lopdf::{Document, Object, ObjectId, Dictionary};

pub fn get_or_create_resources_id(doc: &mut Document, page_id: ObjectId) -> Result<ObjectId, String> {
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

pub fn append_page_contents(doc: &mut Document, page_id: ObjectId, new_content_id: ObjectId) -> Result<(), String> {
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

pub fn merge_named_resource(
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

pub fn extract_pages(src: &Document, page_ids: &[ObjectId]) -> Result<Document, String> {
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
