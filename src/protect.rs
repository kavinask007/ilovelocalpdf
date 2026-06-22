use aes::Aes256;
use aes::cipher::{BlockEncrypt, BlockDecrypt, KeyInit};
use aes::cipher::generic_array::GenericArray;
use cbc::{Encryptor, Decryptor};
use cipher::{KeyIvInit, BlockEncryptMut, BlockDecryptMut, block_padding::Pkcs7};
use sha2::{Sha256, Digest};
use rand::RngCore;
use wasm_bindgen::prelude::*;
use lopdf::{Document, Object, ObjectId, Dictionary};
use std::io::Cursor;
use crate::util::{js_err, load_doc};

type Aes256CbcEnc = Encryptor<Aes256>;
type Aes256CbcDec = Decryptor<Aes256>;

// ─── AES-256-CBC helpers ─────────────────────────────────────────────

/// AES-256-CBC encrypt with PKCS7 padding (for per-object encryption)
fn aes_encrypt(key: &[u8], iv: &[u8], data: &[u8]) -> Result<Vec<u8>, String> {
    let mut buf = data.to_vec();
    buf.resize(buf.len() + 16, 0);
    let ct = Aes256CbcEnc::new_from_slices(key, iv)
        .map_err(|e| format!("AES key/IV error: {e}"))?
        .encrypt_padded_mut::<Pkcs7>(&mut buf, data.len())
        .map_err(|e| format!("Encryption error: {e}"))?;
    Ok(ct.to_vec())
}

/// AES-256-CBC decrypt with PKCS7 padding (for per-object decryption)
fn aes_decrypt(key: &[u8], iv: &[u8], data: &[u8]) -> Result<Vec<u8>, String> {
    let mut buf = data.to_vec();
    let pt = Aes256CbcDec::new_from_slices(key, iv)
        .map_err(|e| format!("AES key/IV error: {e}"))?
        .decrypt_padded_mut::<Pkcs7>(&mut buf)
        .map_err(|_| "Decryption failed — wrong password or corrupted data".to_string())?;
    Ok(pt.to_vec())
}

/// Manual AES-256-CBC encrypt without padding (block-aligned data, for /UE /OE /Perms)
fn aes_encrypt_block(key: &[u8], iv: &[u8], data: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256::new_from_slice(key)
        .map_err(|e| format!("AES key error: {e}"))?;
    let mut buf = data.to_vec();
    let mut prev = GenericArray::clone_from_slice(&iv[..16]);
    for chunk in buf.chunks_exact_mut(16) {
        let block = GenericArray::from_mut_slice(chunk);
        for (b, p) in block.iter_mut().zip(prev.iter()) {
            *b ^= p;
        }
        cipher.encrypt_block(block);
        prev = block.clone();
    }
    Ok(buf)
}

/// Manual AES-256-CBC decrypt without padding (block-aligned data)
fn aes_decrypt_block(key: &[u8], iv: &[u8], data: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256::new_from_slice(key)
        .map_err(|e| format!("AES key error: {e}"))?;
    let mut buf = data.to_vec();
    let mut prev = GenericArray::clone_from_slice(&iv[..16]);
    for chunk in buf.chunks_exact_mut(16) {
        let block = GenericArray::from_mut_slice(chunk);
        let ct_copy = block.clone();
        cipher.decrypt_block(block);
        for (b, p) in block.iter_mut().zip(prev.iter()) {
            *b ^= p;
        }
        prev = ct_copy;
    }
    Ok(buf)
}

fn sha256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    out
}

fn random_bytes<const N: usize>() -> [u8; N] {
    let mut buf = [0u8; N];
    rand::rngs::OsRng.fill_bytes(&mut buf);
    buf
}

// ─── Encrypt / decrypt a single object (recursive) ──────────────────

fn should_skip_type(obj: &Object) -> bool {
    obj.type_name()
        .is_ok_and(|name| matches!(name, "XRef" | "ObjStm" | "Linearized"))
}

fn encrypt_object(
    obj: &mut Object,
    enc_key: &[u8; 32],
    obj_num: u32,
    gen_num: u16,
    skip_id: Option<ObjectId>,
) -> Result<(), String> {
    if skip_id == Some((obj_num, gen_num)) {
        return Ok(());
    }
    if should_skip_type(obj) {
        return Ok(());
    }

    match obj {
        Object::Stream(stream) => {
            let iv: [u8; 16] = random_bytes();
            let ct = aes_encrypt(enc_key, &iv, &stream.content)?;
            stream.content = [&iv[..], &ct[..]].concat();
            stream.dict.set("Length", Object::Integer(stream.content.len() as i64));
        }
        Object::Dictionary(dict) => {
            let keys: Vec<Vec<u8>> = dict.iter().map(|(k, _)| k.to_vec()).collect();
            for key in &keys {
                if let Ok(val) = dict.get_mut(key) {
                    encrypt_object(val, enc_key, obj_num, gen_num, skip_id)?;
                }
            }
        }
        Object::Array(arr) => {
            for item in arr.iter_mut() {
                encrypt_object(item, enc_key, obj_num, gen_num, skip_id)?;
            }
        }
        Object::String(bytes, _) => {
            let iv: [u8; 16] = random_bytes();
            if !bytes.is_empty() {
                let ct = aes_encrypt(enc_key, &iv, bytes)?;
                *bytes = [&iv[..], &ct[..]].concat();
            }
        }
        _ => {}
    }
    Ok(())
}

fn decrypt_object(
    obj: &mut Object,
    enc_key: &[u8; 32],
    obj_num: u32,
    gen_num: u16,
    skip_id: Option<ObjectId>,
) -> Result<(), String> {
    if skip_id == Some((obj_num, gen_num)) {
        return Ok(());
    }
    if should_skip_type(obj) {
        return Ok(());
    }

    match obj {
        Object::Stream(stream) => {
            let bytes = &stream.content;
            if bytes.len() < 17 {
                return Ok(());
            }
            let iv: &[u8; 16] = bytes[..16].try_into().unwrap();
            let ct = &bytes[16..];
            let decrypted = aes_decrypt(enc_key, iv, ct)?;
            stream.content = decrypted;
            stream.dict.set("Length", Object::Integer(stream.content.len() as i64));
        }
        Object::Dictionary(dict) => {
            let keys: Vec<Vec<u8>> = dict.iter().map(|(k, _)| k.to_vec()).collect();
            for key in &keys {
                if let Ok(val) = dict.get_mut(key) {
                    decrypt_object(val, enc_key, obj_num, gen_num, skip_id)?;
                }
            }
        }
        Object::Array(arr) => {
            for item in arr.iter_mut() {
                decrypt_object(item, enc_key, obj_num, gen_num, skip_id)?;
            }
        }
        Object::String(bytes, _) => {
            if bytes.len() < 17 {
                return Ok(());
            }
            let iv: &[u8; 16] = bytes[..16].try_into().unwrap();
            let ct = &bytes[16..];
            let decrypted = aes_decrypt(enc_key, iv, ct)?;
            *bytes = decrypted;
        }
        _ => {}
    }
    Ok(())
}

/// Convert password to the byte string used by PDF R=5 encryption.
/// Both qpdf and PDFium use raw password bytes (not UTF-16BE).
/// Limited to 127 bytes per PDF spec.
fn password_bytes(password: &str) -> Vec<u8> {
    let pw = password.as_bytes();
    let len = pw.len().min(127);
    pw[..len].to_vec()
}

// ─── Encrypt / decrypt the entire document ──────────────────────────

fn encrypt_document(doc: &mut Document, password: &str) -> Result<ObjectId, String> {
    let pw_bytes = password_bytes(password);

    // Generate random encryption key, validation salt, key salt
    let enc_key: [u8; 32] = random_bytes();
    let validation_salt: [u8; 8] = random_bytes();
    let key_salt: [u8; 8] = random_bytes();
    let zero_iv = [0u8; 16];

    // /U entry (48 bytes):
    //   [0..31] = SHA-256(password + validationSalt)
    //   [32..39] = validationSalt
    //   [40..47] = keySalt
    let mut u_hash_input = pw_bytes.clone();
    u_hash_input.extend_from_slice(&validation_salt);
    let u_hash = sha256(&u_hash_input);
    let mut u_entry = vec![0u8; 48];
    u_entry[..32].copy_from_slice(&u_hash);
    u_entry[32..40].copy_from_slice(&validation_salt);
    u_entry[40..48].copy_from_slice(&key_salt);

    // /UE = AES256(SHA256(password + key_salt), zero_iv, enc_key)
    let mut key_input = pw_bytes.clone();
    key_input.extend_from_slice(&key_salt);
    let intermediate_key = sha256(&key_input);
    let ue_entry = aes_encrypt_block(&intermediate_key, &zero_iv, &enc_key)?;

    // /O and /OE: same as /U and /UE (no separate owner password)
    let mut o_entry = vec![0u8; 48];
    o_entry.copy_from_slice(&u_entry);
    let oe_entry = ue_entry.clone();

    // /Perms (16 bytes, encrypted with enc_key, zero_iv):
    //   [0..3] = permissions little-endian
    //   [4..7] = 0xFFFFFFFF (reserved)
    //   [8]    = 'T' (encrypt metadata)
    //   [9..11] = 'a' 'd' 'b' (magic)
    //   [12..15] = random bytes
    let perms_plain: [u8; 16] = [
        0xFC, 0xFF, 0xFF, 0xFF,  // permissions (allow all)
        0xFF, 0xFF, 0xFF, 0xFF,  // reserved
        b'T',                     // encrypt metadata = true
        b'a', b'd', b'b',        // magic
        0x00, 0x00, 0x00, 0x00,  // random bytes
    ];
    let perms_encrypted = aes_encrypt_block(&enc_key, &zero_iv, &perms_plain)?;

    // Create Encrypt dictionary
    let encrypt_id = doc.new_object_id();
    let stdcf = Dictionary::from_iter(vec![
        ("CFM",       Object::Name(b"AESV3".to_vec())),
        ("AuthEvent", Object::Name(b"DocOpen".to_vec())),
        ("Length",    Object::Integer(32)),
    ]);
    let cf_dict = Dictionary::from_iter(vec![
        ("StdCF", Object::Dictionary(stdcf)),
    ]);
    // /P must match the permissions in /Perms plaintext[0..4] as LE uint32.
    // 0xFFFFFFFC = -4 as signed i32: all operations permitted, reserved bits set.
    let perms_value: i64 = -4;
    let encrypt_dict = Dictionary::from_iter(vec![
        ("Type",      Object::Name(b"Encrypt".to_vec())),
        ("Filter",    Object::Name(b"Standard".to_vec())),
        ("SubFilter", Object::Name(b"AESV3".to_vec())),
        ("R",         Object::Integer(5)),
        ("Length",    Object::Integer(256)),
        ("V",         Object::Integer(5)),
        ("P",         Object::Integer(perms_value)),
        ("O",         Object::String(o_entry, lopdf::StringFormat::Hexadecimal)),
        ("U",         Object::String(u_entry, lopdf::StringFormat::Hexadecimal)),
        ("OE",        Object::String(oe_entry, lopdf::StringFormat::Hexadecimal)),
        ("UE",        Object::String(ue_entry, lopdf::StringFormat::Hexadecimal)),
        ("Perms",     Object::String(perms_encrypted, lopdf::StringFormat::Hexadecimal)),
        ("StmF",      Object::Name(b"StdCF".to_vec())),
        ("StrF",      Object::Name(b"StdCF".to_vec())),
        ("CF",        Object::Dictionary(cf_dict)),
    ]);
    doc.objects.insert(encrypt_id, Object::Dictionary(encrypt_dict));
    doc.trailer.set("Encrypt", Object::Reference(encrypt_id));

    // Encrypt all other objects using enc_key directly (no per-object derivation for V=5)
    let obj_ids: Vec<ObjectId> = doc.objects.keys().copied().collect();
    for obj_id in &obj_ids {
        let (on, gn) = *obj_id;
        if Some((on, gn)) == Some(encrypt_id) {
            continue;
        }
        if let Some(obj) = doc.objects.get_mut(obj_id) {
            encrypt_object(obj, &enc_key, on, gn, Some(encrypt_id))?;
        }
    }

    Ok(encrypt_id)
}

fn decrypt_document(doc: &mut Document, password: &str) -> Result<(), String> {
    // Read Encrypt dict from trailer
    let encrypt_ref = doc.trailer.get(b"Encrypt")
        .map_err(|_| "No Encrypt dictionary found".to_string())?
        .clone();

    let encrypt_id = match &encrypt_ref {
        Object::Reference(id) => *id,
        Object::Dictionary(_) => return Err("Expected indirect Encrypt dictionary".to_string()),
        _ => return Err("Invalid Encrypt entry".to_string()),
    };

    let encrypt_dict = match doc.objects.get(&encrypt_id) {
        Some(Object::Dictionary(d)) => d.clone(),
        _ => return Err("Encrypt dictionary not found or invalid".to_string()),
    };

    // Verify it's the right encryption type
    let subfilter = encrypt_dict.get(b"SubFilter")
        .ok()
        .and_then(|o| o.as_name().ok())
        .map(|n| n.to_vec());
    if subfilter.as_deref() != Some(b"AESV3") {
        return Err("Unsupported encryption type — only AES-256 (AESV3) is supported".to_string());
    }

    // Extract /U entry to get salts
    let u_entry = encrypt_dict.get(b"U")
        .ok()
        .and_then(|o| o.as_str().ok())
        .ok_or("Missing or invalid /U entry in Encrypt dictionary")?;

    if u_entry.len() < 48 {
        return Err("Invalid /U entry: too short".to_string());
    }

    let expected_hash = &u_entry[..32];
    let validation_salt: [u8; 8] = u_entry[32..40].try_into().unwrap();
    let key_salt: [u8; 8] = u_entry[40..48].try_into().unwrap();

    let pw_bytes = password_bytes(password);

    // Verify password: SHA-256(password + validationSalt) should match /U[0..31]
    let mut computed_hash_input = pw_bytes.clone();
    computed_hash_input.extend_from_slice(&validation_salt);
    let computed_hash = sha256(&computed_hash_input);
    if computed_hash != expected_hash {
        return Err("Incorrect password".to_string());
    }

    // Recover encryption key from /UE entry
    //   intermediate_key = SHA256(password + key_salt)
    //   enc_key = AES256_decrypt(intermediate_key, zero_iv, /UE)
    let zero_iv = [0u8; 16];
    let mut key_input = pw_bytes.clone();
    key_input.extend_from_slice(&key_salt);
    let intermediate_key = sha256(&key_input);

    let ue_entry = encrypt_dict.get(b"UE")
        .ok()
        .and_then(|o| o.as_str().ok())
        .ok_or("Missing /UE entry in Encrypt dictionary")?;

    let enc_key_vec = aes_decrypt_block(&intermediate_key, &zero_iv, ue_entry)?;
    if enc_key_vec.len() != 32 {
        return Err("Invalid encryption key length".to_string());
    }
    let mut enc_key = [0u8; 32];
    enc_key.copy_from_slice(&enc_key_vec);

    // Decrypt all objects using enc_key directly (no per-object derivation for V=5)
    let obj_ids: Vec<ObjectId> = doc.objects.keys().copied().collect();
    for obj_id in &obj_ids {
        let (on, gn) = *obj_id;
        if Some((on, gn)) == Some(encrypt_id) {
            continue;
        }
        if let Some(obj) = doc.objects.get_mut(obj_id) {
            decrypt_object(obj, &enc_key, on, gn, Some(encrypt_id))?;
        }
    }

    // Remove encryption from trailer
    doc.trailer.remove(b"Encrypt");
    doc.objects.remove(&encrypt_id);

    Ok(())
}

// ─── WASM API ─────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn protect_pdf(data: &[u8], password: &str) -> Result<js_sys::Uint8Array, JsValue> {
    if password.is_empty() {
        return Err(js_err("Password cannot be empty"));
    }
    if password.len() < 4 {
        return Err(js_err("Password must be at least 4 characters"));
    }

    let mut doc = load_doc(data).map_err(js_err)?;

    encrypt_document(&mut doc, password)
        .map_err(|e| js_err(e))?;

    let mut out = Vec::new();
    doc.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(out.as_slice()))
}

#[wasm_bindgen]
pub fn unlock_pdf(data: &[u8], password: &str) -> Result<js_sys::Uint8Array, JsValue> {
    if password.is_empty() {
        return Err(js_err("Password cannot be empty"));
    }

    let mut doc = load_doc(data).map_err(js_err)?;

    decrypt_document(&mut doc, password)
        .map_err(|e| js_err(e))?;

    let mut out = Vec::new();
    doc.save_to(&mut Cursor::new(&mut out))
        .map_err(|e| js_err(format!("Save error: {e}")))?;
    Ok(js_sys::Uint8Array::from(out.as_slice()))
}

/// Check if a PDF was protected by our legacy FNV-1a hash method
#[wasm_bindgen]
pub fn is_legacy_protected(data: &[u8]) -> bool {
    if let Ok(doc) = load_doc(data) {
        if let Ok(Object::Reference(info_id)) = doc.trailer.get(b"Info") {
            if let Some(Object::Dictionary(d)) = doc.objects.get(info_id) {
                if d.get(b"Protected").ok()
                    .and_then(|b| {
                        let val: &Object = b;
                        val.as_bool().ok()
                    })
                    .unwrap_or(false)
                {
                    return true;
                }
            }
        }
    }
    false
}

#[wasm_bindgen]
pub fn get_pdf_info(data: &[u8]) -> Result<String, JsValue> {
    let doc = load_doc(data).map_err(js_err)?;
    let page_count = doc.get_pages().len();
    Ok(format!(
        r#"{{"pages":{},"size":{}}}"#,
        page_count,
        data.len()
    ))
}

#[wasm_bindgen]
pub fn get_page_count(data: &[u8]) -> Result<u32, JsValue> {
    let doc = load_doc(data).map_err(js_err)?;
    Ok(doc.get_pages().len() as u32)
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::{Document, Dictionary, Object, Stream};

    /// Build an in-memory document (no xref) to test content decryption,
    /// not serialization artifacts.
    fn make_doc() -> Document {
        let mut doc = Document::with_version("1.7");
        let font_id = doc.new_object_id();
        doc.objects.insert(font_id, Object::Dictionary(Dictionary::from_iter(vec![
            ("Type", Object::Name(b"Font".to_vec())),
            ("Subtype", Object::Name(b"Type1".to_vec())),
            ("BaseFont", Object::Name(b"Helvetica".to_vec())),
        ])));
        let content_id = doc.new_object_id();
        let content = Stream::new(Dictionary::new(), b"BT /F1 24 Tf 72 720 Td (Hello) Tj ET".to_vec());
        doc.objects.insert(content_id, Object::Stream(content));
        let page_id = doc.new_object_id();
        let page = Dictionary::from_iter(vec![
            ("Type", Object::Name(b"Page".to_vec())),
            ("MediaBox", Object::Array(vec![
                Object::Integer(0), Object::Integer(0), Object::Integer(612), Object::Integer(792),
            ])),
            ("Contents", Object::Reference(content_id)),
            ("Resources", Object::Dictionary(Dictionary::from_iter(vec![(
                "Font", Object::Dictionary(Dictionary::from_iter(vec![(
                    "F1", Object::Reference(font_id),
                )])),
            )]))),
        ]);
        doc.objects.insert(page_id, Object::Dictionary(page));
        let pages_id = doc.new_object_id();
        doc.objects.insert(pages_id, Object::Dictionary(Dictionary::from_iter(vec![
            ("Type", Object::Name(b"Pages".to_vec())),
            ("Kids", Object::Array(vec![Object::Reference(page_id)])),
            ("Count", Object::Integer(1)),
        ])));
        let catalog_id = doc.new_object_id();
        doc.objects.insert(catalog_id, Object::Dictionary(Dictionary::from_iter(vec![
            ("Type", Object::Name(b"Catalog".to_vec())),
            ("Pages", Object::Reference(pages_id)),
        ])));
        doc.trailer.set("Root", Object::Reference(catalog_id));
        doc
    }

    fn get_stream_content(doc: &Document, id: ObjectId) -> Vec<u8> {
        match doc.objects.get(&id) {
            Some(Object::Stream(s)) => s.content.clone(),
            _ => panic!("object {id:?} is not a stream"),
        }
    }

    #[test]
    fn protect_and_unlock_roundtrip() {
        let password = "test123";

        // Encrypt
        let mut doc = make_doc();
        let content_id = (2, 0); // object 2 is our stream
        let original_content = get_stream_content(&doc, content_id);

        encrypt_document(&mut doc, password).unwrap();

        // After encryption the stream content should be different
        let encrypted_content = get_stream_content(&doc, content_id);
        assert_ne!(encrypted_content, original_content, "stream should be encrypted");
        assert!(doc.trailer.get(b"Encrypt").is_ok(), "should have Encrypt trailer");

        // Decrypt
        decrypt_document(&mut doc, password).unwrap();

        let decrypted_content = get_stream_content(&doc, content_id);
        assert_eq!(decrypted_content, original_content, "decrypted stream should match original");
        assert!(doc.trailer.get(b"Encrypt").is_err(), "Encrypt should be removed after unlock");
    }

    #[test]
    fn protect_with_wrong_password_fails() {
        let mut doc = make_doc();
        encrypt_document(&mut doc, "correctpw").unwrap();

        let result = decrypt_document(&mut doc, "wrongpw");
        assert!(result.is_err(), "wrong password should fail");
        assert!(result.unwrap_err().contains("Incorrect password"));
    }

    #[test]
    fn encrypt_decrypt_in_memory() {
        let password = "test123";
        let mut doc = make_doc();
        let content_id = (2, 0);
        let original_content = get_stream_content(&doc, content_id);

        encrypt_document(&mut doc, password).unwrap();
        decrypt_document(&mut doc, password).unwrap();

        let final_content = get_stream_content(&doc, content_id);
        assert_eq!(final_content, original_content, "in-memory roundtrip should match");
    }

    #[test]
    fn save_and_load_roundtrip() {
        // Full roundtrip: encrypt → save → load → decrypt
        let password = "test123";

        // Build original doc
        let mut doc = make_doc();
        let content_id = (2, 0);
        let original_content = get_stream_content(&doc, content_id);

        // Encrypt
        encrypt_document(&mut doc, password).unwrap();

        // Save to bytes
        let mut encrypted_bytes = Vec::new();
        doc.save_to(&mut Cursor::new(&mut encrypted_bytes)).unwrap();

        // Load encrypted bytes
        let mut loaded = Document::load_mem(&encrypted_bytes).unwrap();

        // Verify Encrypt dict is intact
        assert!(loaded.trailer.get(b"Encrypt").is_ok(), "trailer should have Encrypt");

        // Decrypt
        decrypt_document(&mut loaded, password).unwrap();

        // Save decrypted bytes
        let mut decrypted_bytes = Vec::new();
        loaded.save_to(&mut Cursor::new(&mut decrypted_bytes)).unwrap();

        // Load decrypted bytes and verify content
        let final_doc = Document::load_mem(&decrypted_bytes).unwrap();
        let final_content = get_stream_content(&final_doc, content_id);
        assert_eq!(final_content, original_content, "save/load roundtrip should restore original content");
        assert!(final_doc.trailer.get(b"Encrypt").is_err(), "Encrypt should be gone after unlock");
    }
}
