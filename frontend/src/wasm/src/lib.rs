use std::cell::RefCell;

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use hkdf::Hkdf;
use sha2::Sha256;
use wasm_bindgen::prelude::*;
use zeroize::Zeroizing;

thread_local! {
    static VAULT_KEY: RefCell<Option<Zeroizing<Vec<u8>>>> = RefCell::new(None);
}

fn js_err(msg: &str) -> JsValue {
    #[cfg(target_arch = "wasm32")]
    { js_sys::Error::new(msg).into() }
    #[cfg(not(target_arch = "wasm32"))]
    { JsValue::from_str(msg) }
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

/// Generate `count` recovery codes that each encrypt the current vault key.
/// Vault must be unlocked. Returns a JSON string: [{code, salt_b64, encrypted_b64}, …].
#[wasm_bindgen]
pub fn generate_recovery_codes(count: u32) -> Result<String, JsValue> {
    VAULT_KEY.with(|k| {
        let borrow = k.borrow();
        let vault_key = borrow.as_ref().ok_or_else(|| js_err("vault locked"))?;

        let mut entries = Vec::new();
        for _ in 0..count {
            // 16 random bytes → 32-char uppercase hex → "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            let mut code_bytes = [0u8; 16];
            getrandom::getrandom(&mut code_bytes).map_err(|_| js_err("rng failed"))?;
            let hex_str: String = code_bytes.iter().map(|b| format!("{:02X}", b)).collect();
            let code_formatted = hex_str
                .as_bytes()
                .chunks(4)
                .map(|c| std::str::from_utf8(c).unwrap())
                .collect::<Vec<_>>()
                .join("-");

            // Per-code HKDF salt
            let mut salt = [0u8; 16];
            getrandom::getrandom(&mut salt).map_err(|_| js_err("rng failed"))?;

            // Derive AES key: HKDF(ikm=code_bytes, salt=salt, info="crezen-recovery")
            let hk = Hkdf::<Sha256>::new(Some(&salt), &code_bytes);
            let mut enc_key = Zeroizing::new([0u8; 32]);
            hk.expand(b"crezen-recovery", &mut *enc_key)
                .map_err(|_| js_err("hkdf expand failed"))?;

            // AES-256-GCM encrypt the vault key
            let key = Key::<Aes256Gcm>::from_slice(&*enc_key);
            let cipher = Aes256Gcm::new(key);
            let mut nonce_bytes = [0u8; 12];
            getrandom::getrandom(&mut nonce_bytes).map_err(|_| js_err("rng failed"))?;
            let nonce = Nonce::from_slice(&nonce_bytes);
            let ct = cipher
                .encrypt(nonce, vault_key.as_slice())
                .map_err(|_| js_err("encrypt failed"))?;

            let mut blob = Vec::with_capacity(12 + ct.len());
            blob.extend_from_slice(&nonce_bytes);
            blob.extend_from_slice(&ct);

            entries.push(format!(
                r#"{{"code":"{}","salt_b64":"{}","encrypted_b64":"{}"}}"#,
                code_formatted,
                B64.encode(salt),
                B64.encode(&blob)
            ));
        }

        Ok(format!("[{}]", entries.join(",")))
    })
}

/// Decrypt a recovery code blob and store the recovered vault key in WASM memory,
/// effectively unlocking the vault.
#[wasm_bindgen]
pub fn recover_vault_key(code: &str, salt_b64: &str, encrypted_b64: &str) -> Result<(), JsValue> {
    // Normalize: strip dashes, must be exactly 32 hex chars (16 bytes)
    let clean: String = code.chars().filter(|c| *c != '-').collect::<String>().to_uppercase();
    if clean.len() != 32 {
        return Err(js_err("invalid recovery code length"));
    }
    let mut code_bytes = [0u8; 16];
    for (i, chunk) in clean.as_bytes().chunks(2).enumerate() {
        let hex_pair = std::str::from_utf8(chunk).map_err(|_| js_err("invalid code"))?;
        code_bytes[i] = u8::from_str_radix(hex_pair, 16).map_err(|_| js_err("invalid code hex"))?;
    }

    let salt = B64.decode(salt_b64).map_err(|_| js_err("invalid salt encoding"))?;
    let blob = B64.decode(encrypted_b64).map_err(|_| js_err("invalid encrypted data"))?;
    if blob.len() < 12 {
        return Err(js_err("encrypted data too short"));
    }

    let hk = Hkdf::<Sha256>::new(Some(&salt), &code_bytes);
    let mut enc_key = Zeroizing::new([0u8; 32]);
    hk.expand(b"crezen-recovery", &mut *enc_key)
        .map_err(|_| js_err("hkdf expand failed"))?;

    let key = Key::<Aes256Gcm>::from_slice(&*enc_key);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(&blob[..12]);
    let vault_key_bytes = cipher
        .decrypt(nonce, &blob[12..])
        .map_err(|_| js_err("invalid recovery code"))?;

    VAULT_KEY.with(|k| {
        *k.borrow_mut() = Some(Zeroizing::new(vault_key_bytes));
    });

    Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SALT_B64: &str = "AAAAAAAAAAAAAAAAAAAAAA=="; // 16 zero bytes in base64

    fn low_cost_argon2(mvk: &str) -> Zeroizing<Vec<u8>> {
        // time=1, mem=1024 KiB, lanes=1 — fast enough for unit tests
        argon2_derive(mvk, TEST_SALT_B64, 1, 1024, 1).expect("argon2_derive failed")
    }

    #[test]
    fn test_derive_from_master_deterministic() {
        let master = vec![0u8; 32];
        let a = derive_from_master(&master, b"crezen-verifier").unwrap();
        let b = derive_from_master(&master, b"crezen-verifier").unwrap();
        assert_eq!(*a, *b);
    }

    #[test]
    fn test_derive_from_master_labels_differ() {
        let master = vec![1u8; 32];
        let verifier = derive_from_master(&master, b"crezen-verifier").unwrap();
        let vault_key = derive_from_master(&master, b"crezen-vault-key").unwrap();
        assert_ne!(*verifier, *vault_key, "different labels must yield different keys");
    }

    #[test]
    fn test_derive_from_master_output_length() {
        let master = vec![2u8; 32];
        let out = derive_from_master(&master, b"test").unwrap();
        assert_eq!(out.len(), 32);
    }

    #[test]
    fn test_argon2_derive_deterministic() {
        let a = low_cost_argon2("my-mvk");
        let b = low_cost_argon2("my-mvk");
        assert_eq!(*a, *b);
    }

    #[test]
    fn test_argon2_derive_mvk_sensitivity() {
        let a = low_cost_argon2("mvk-one");
        let b = low_cost_argon2("mvk-two");
        assert_ne!(*a, *b, "different MVKs must yield different master keys");
    }

    #[test]
    fn test_vault_lifecycle() {
        // Ensure locked at start of test
        lock_vault();
        assert!(!is_vault_unlocked(), "vault should start locked");

        // Manually inject a key to simulate init_vault_key
        VAULT_KEY.with(|k| {
            *k.borrow_mut() = Some(Zeroizing::new(vec![42u8; 32]));
        });
        assert!(is_vault_unlocked(), "vault should be unlocked after key injection");

        lock_vault();
        assert!(!is_vault_unlocked(), "vault should be locked after lock_vault()");
    }

    #[test]
    fn test_verifier_and_vault_key_differ() {
        // The verifier and vault_key derived from the same master must be distinct
        let master = low_cost_argon2("test-mvk");
        let verifier = derive_from_master(&master, b"crezen-verifier").unwrap();
        let vault_key = derive_from_master(&master, b"crezen-vault-key").unwrap();
        assert_ne!(*verifier, *vault_key);
    }
}
