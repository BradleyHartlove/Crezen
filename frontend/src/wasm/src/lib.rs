use std::cell::RefCell;

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use hkdf::Hkdf;
use js_sys::Error;
use sha2::Sha256;
use wasm_bindgen::prelude::*;
use zeroize::Zeroizing;

thread_local! {
    static VAULT_KEY: RefCell<Option<Zeroizing<Vec<u8>>>> = RefCell::new(None);
}

fn js_err(msg: &str) -> JsValue {
    Error::new(msg).into()
}

fn argon2_derive(
    raw_mvk: &str,
    salt_b64: &str,
    time: u32,
    mem: u32,
    lanes: u32,
) -> Result<Zeroizing<Vec<u8>>, JsValue> {
    let salt = B64
        .decode(salt_b64)
        .map_err(|_| js_err("invalid salt encoding"))?;

    let params = Params::new(mem, time, lanes, Some(32))
        .map_err(|e| js_err(&format!("argon2 params: {e}")))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut master = Zeroizing::new(vec![0u8; 32]);
    argon2
        .hash_password_into(raw_mvk.as_bytes(), &salt, &mut master)
        .map_err(|e| js_err(&format!("argon2: {e}")))?;

    Ok(master)
}

fn derive_from_master(master: &[u8], info: &[u8]) -> Result<Zeroizing<Vec<u8>>, JsValue> {
    let hk = Hkdf::<Sha256>::new(None, master);
    let mut out = Zeroizing::new(vec![0u8; 32]);
    hk.expand(info, &mut out)
        .map_err(|_| js_err("hkdf expand failed"))?;
    Ok(out)
}

/// Derive the verifier (base64) from raw_mvk for server-side comparison.
/// Does NOT store the vault key.
#[wasm_bindgen]
pub fn derive_verifier(
    raw_mvk: &str,
    salt_b64: &str,
    time: u32,
    mem: u32,
    lanes: u32,
) -> Result<String, JsValue> {
    let master = argon2_derive(raw_mvk, salt_b64, time, mem, lanes)?;
    let verifier = derive_from_master(&master, b"crezen-verifier")?;
    Ok(B64.encode(&*verifier))
}

/// Derive and store the vault key after server confirms the verifier is correct.
#[wasm_bindgen]
pub fn init_vault_key(
    raw_mvk: &str,
    salt_b64: &str,
    time: u32,
    mem: u32,
    lanes: u32,
) -> Result<(), JsValue> {
    let master = argon2_derive(raw_mvk, salt_b64, time, mem, lanes)?;
    let vault_key = derive_from_master(&master, b"crezen-vault-key")?;
    VAULT_KEY.with(|k| {
        *k.borrow_mut() = Some(vault_key);
    });
    Ok(())
}

/// Encrypt plaintext. Returns base64(12-byte nonce || ciphertext || 16-byte GCM tag).
#[wasm_bindgen]
pub fn encrypt_credential(plaintext: &str) -> Result<String, JsValue> {
    VAULT_KEY.with(|k| {
        let borrow = k.borrow();
        let key_bytes = borrow.as_ref().ok_or_else(|| js_err("vault locked"))?;

        let key = Key::<Aes256Gcm>::from_slice(key_bytes);
        let cipher = Aes256Gcm::new(key);

        let mut nonce_bytes = [0u8; 12];
        getrandom::getrandom(&mut nonce_bytes).map_err(|_| js_err("random nonce failed"))?;
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|_| js_err("encryption failed"))?;

        let mut blob = Vec::with_capacity(12 + ciphertext.len());
        blob.extend_from_slice(&nonce_bytes);
        blob.extend_from_slice(&ciphertext);

        Ok(B64.encode(&blob))
    })
}

/// Decrypt a base64(nonce || ciphertext || tag) blob.
#[wasm_bindgen]
pub fn decrypt_credential(ciphertext_b64: &str) -> Result<String, JsValue> {
    VAULT_KEY.with(|k| {
        let borrow = k.borrow();
        let key_bytes = borrow.as_ref().ok_or_else(|| js_err("vault locked"))?;

        let key = Key::<Aes256Gcm>::from_slice(key_bytes);
        let cipher = Aes256Gcm::new(key);

        let blob = B64
            .decode(ciphertext_b64)
            .map_err(|_| js_err("invalid ciphertext encoding"))?;

        if blob.len() < 12 {
            return Err(js_err("ciphertext too short"));
        }

        let nonce = Nonce::from_slice(&blob[..12]);
        let plaintext = cipher
            .decrypt(nonce, &blob[12..])
            .map_err(|_| js_err("decryption failed"))?;

        String::from_utf8(plaintext).map_err(|_| js_err("plaintext is not valid UTF-8"))
    })
}

/// Zero and drop the vault key from WASM memory.
#[wasm_bindgen]
pub fn lock_vault() {
    VAULT_KEY.with(|k| {
        *k.borrow_mut() = None; // Zeroizing<Vec<u8>> zeroes on drop
    });
}

/// Returns true if the vault key is currently held in memory.
#[wasm_bindgen]
pub fn is_vault_unlocked() -> bool {
    VAULT_KEY.with(|k| k.borrow().is_some())
}
