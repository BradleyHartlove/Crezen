import init, {
  derive_verifier,
  init_vault_key,
  encrypt_credential,
  decrypt_credential,
  lock_vault,
  is_vault_unlocked,
  generate_recovery_codes,
  recover_vault_key,
} from './pkg/crezen_wasm'

let initialized = false

export async function initWasm(): Promise<void> {
  if (!initialized) {
    await init()
    initialized = true
  }
}

export const wasm = {
  deriveVerifier: (rawMvk: string, saltB64: string, time: number, mem: number, lanes: number): string =>
    derive_verifier(rawMvk, saltB64, time, mem, lanes),

  initVaultKey: (rawMvk: string, saltB64: string, time: number, mem: number, lanes: number): void =>
    init_vault_key(rawMvk, saltB64, time, mem, lanes),

  encryptCredential: (plaintext: string): string =>
    encrypt_credential(plaintext),

  decryptCredential: (ciphertextB64: string): string =>
    decrypt_credential(ciphertextB64),

  lockVault: (): void => lock_vault(),

  isVaultUnlocked: (): boolean => is_vault_unlocked(),

  generateRecoveryCodes: (count: number): Array<{ code: string; salt_b64: string; encrypted_b64: string }> =>
    JSON.parse(generate_recovery_codes(count)),

  recoverVaultKey: (code: string, saltB64: string, encryptedB64: string): void =>
    recover_vault_key(code, saltB64, encryptedB64),
}
