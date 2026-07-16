# Crezen — Architecture

## 1. Overview

Crezen is a web-based credential vault for development teams. It stores encrypted credentials (passwords, API tokens, keys, certificates, etc.) and enforces role-based access. All cryptographic operations are performed inside a Rust WebAssembly module that runs in the browser; the server never sees plaintext credentials or the Master Vault Key.

The vault is a **shared team vault** — all active users have access to all credentials. No per-user ownership.

---

## 2. Repository Layout

```
crezen/
├── frontend/                  # React + TypeScript + Tailwind + Shadcn UI
│   └── src/
│       ├── wasm/              # Rust WASM crate (compiled to pkg/ at build time)
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── api/               # Typed fetch wrappers for Go API
│       └── store/             # Zustand state (auth, vault)
├── backend/                   # Go GIN REST API
│   ├── cmd/server/
│   ├── internal/
│   │   ├── handlers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── repository/
│   │   └── service/
│   └── migrations/            # SQL migrations (golang-migrate)
├── docker-compose.yml
└── architecture.md
```

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript |
| Styling | Tailwind CSS + Shadcn UI |
| Frontend state | Zustand |
| Cryptography | Rust WASM (wasm-pack) with `zeroize` |
| Backend | Go 1.22 + GIN |
| DB queries | sqlc |
| Database | PostgreSQL 16 |
| Auth tokens | JWT (access) + httpOnly refresh token cookie |
| Containerisation | Docker + docker-compose |

---

## 4. Database Schema

### 4.1 `users`

```sql
CREATE TABLE users (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username         TEXT NOT NULL UNIQUE,
    hashed_password  TEXT NOT NULL,           -- bcrypt cost >= 12
    is_admin         BOOLEAN NOT NULL DEFAULT FALSE,
    is_active        BOOLEAN NOT NULL DEFAULT FALSE,
    is_initial       BOOLEAN NOT NULL DEFAULT FALSE, -- first account; undeletable
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.2 `vault_config`

Exactly one row. Written once at setup; Argon2 params are **frozen** after initialization.

```sql
CREATE TABLE vault_config (
    id             SERIAL PRIMARY KEY,
    argon2_salt    BYTEA NOT NULL,              -- random 16-byte salt
    argon2_hash    BYTEA NOT NULL,              -- Argon2id(salt || MVK)
    argon2_time    INT NOT NULL DEFAULT 3,
    argon2_memory  INT NOT NULL DEFAULT 65536,  -- 64 MiB
    argon2_lanes   INT NOT NULL DEFAULT 4,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- no updated_at: this row is never mutated after setup
);
```

### 4.3 `namespaces`

Namespaces represent logical environments (e.g., `staging`, `production`, `testing`).

```sql
CREATE TABLE namespaces (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.4 `credentials`

```sql
CREATE TYPE credential_type AS ENUM (
    'username', 'password', 'api_token',
    'ca_cert', 'public_key', 'private_key', 'cert'
);

CREATE TABLE credentials (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL,
    description    TEXT NOT NULL,
    type           credential_type NOT NULL,
    namespace_id   UUID REFERENCES namespaces(id) ON DELETE SET NULL,
    tags           TEXT[] NOT NULL DEFAULT '{}',
    encrypted_data TEXT NOT NULL,              -- base64(nonce || ciphertext || tag)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credentials_namespace ON credentials(namespace_id);
CREATE INDEX idx_credentials_tags ON credentials USING GIN(tags);
```

### 4.5 `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash  TEXT NOT NULL UNIQUE,          -- SHA-256 of the raw token
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```

### 4.6 `audit_log`

```sql
CREATE TYPE audit_action AS ENUM (
    'credential_viewed', 'credential_created', 'credential_updated', 'credential_deleted',
    'user_created', 'user_activated', 'user_deactivated', 'user_deleted', 'user_role_changed',
    'user_password_reset',
    'vault_unlocked', 'vault_locked', 'vault_mvk_rotated',
    'login_success', 'login_failure', 'logout'
);

CREATE TABLE audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    username      TEXT,                          -- snapshot in case user is later deleted
    action        audit_action NOT NULL,
    credential_id UUID REFERENCES credentials(id) ON DELETE SET NULL,
    meta          JSONB,                         -- optional: { "ip": "...", "field": "..." }
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
```

---

## 5. Cryptographic Design

### 5.1 Master Vault Key (MVK) — lifecycle

The implementation uses HKDF to derive two independent 32-byte keys from a single Argon2id master, so that the encryption key and the server-stored verifier are cryptographically separate:

```
raw_mvk + argon2_salt
   │
   └─► Argon2id(raw_mvk, salt, params) → master [32 bytes, never stored/sent]
           │
           ├─► HKDF-Expand(master, "crezen-verifier",   32) → verifier
           │         stored in vault_config.argon2_hash
           │         sent to POST /api/v1/vault/verify-mvk for comparison
           │         server returns 200 OK or 401 — hash never sent to browser
           │
           └─► HKDF-Expand(master, "crezen-vault-key",  32) → vault_key
                         stored in WASM thread_local, never leaves the browser
                         used as AES-256-GCM key for all credential operations
```

Knowing the stored `verifier` does **not** allow decryption — the `vault_key` is derived from a different HKDF label and is never persisted anywhere.

### 5.2 Credential Encryption / Decryption

**Encrypt (save credential):**
1. WASM receives plaintext credential value.
2. WASM generates a random 12-byte nonce via `getrandom`.
3. WASM encrypts with AES-256-GCM using `vault_key`.
4. Output: `base64(nonce || ciphertext || GCM tag)` → sent to Go API as `encrypted_data`.

**Decrypt (read credential):**
1. WASM receives `encrypted_data` from the API.
2. WASM base64-decodes, splits nonce / ciphertext / tag, decrypts.
3. Plaintext is used in the UI (copy-to-clipboard or reveal); never persisted.

### 5.3 Memory Safety

All key material in the WASM crate uses the `zeroize` crate. The `vault_key` buffer is zeroed on `lock_vault()` and on WASM module drop. Intermediate Argon2 outputs are also zeroed after use.

### 5.4 WASM-Exposed Functions

```rust
/// Derive verifier (base64) for server-side comparison. Does NOT store vault_key.
pub fn derive_verifier(raw_mvk, salt_b64, time, mem, lanes) -> Result<String, JsValue>;

/// Derive and store vault_key after server confirms the verifier. Zeroes master immediately.
pub fn init_vault_key(raw_mvk, salt_b64, time, mem, lanes) -> Result<(), JsValue>;

/// Encrypt plaintext with cached vault_key. Returns base64(nonce || ciphertext || tag).
pub fn encrypt_credential(plaintext: &str) -> Result<String, JsValue>;

/// Decrypt base64 blob with cached vault_key. Returns plaintext.
pub fn decrypt_credential(ciphertext_b64: &str) -> Result<String, JsValue>;

/// Zero vault_key via `zeroize` and drop from thread_local.
pub fn lock_vault();

/// Returns true if vault_key is present in memory.
pub fn is_vault_unlocked() -> bool;
```

---

## 6. Session Behaviour

- **JWT access token:** 15-minute TTL, stored in memory (Zustand). Not in localStorage.
- **Refresh token:** 7-day TTL, stored in an httpOnly `Secure` cookie. Rotated on each use. Revoked immediately on logout, user deletion, or deactivation.
- **Auto-lock:** A Zustand activity timer resets on any user interaction (mouse, keyboard). After **10 minutes** of inactivity, `WASM.lock_vault()` is called and the user is redirected to a re-entry screen to re-enter the MVK (no full re-login required — JWT is still valid).
- **is_active middleware check:** Every protected route handler runs a Go middleware that looks up the user's `is_active` flag in a short-lived in-process cache (TTL: 30 seconds). If `is_active = false`, the request is rejected with 401. This ensures deactivated users are locked out within seconds of an admin action.
- **Tab/window close:** A `beforeunload` listener calls `WASM.lock_vault()` to zero key material on page exit.

---

## 7. Backend API

Base path: `/api/v1`

All protected routes require `Authorization: Bearer <access_token>`.

### 7.1 Auth & Setup

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auth/status` | None | Returns `{ initialized: bool }` — drives setup redirect |
| POST | `/auth/setup` | None | First-run only; 409 if `vault_config` already exists |
| POST | `/auth/register` | None | Create inactive user account |
| POST | `/auth/login` | None | Verify password; return access token + set refresh cookie |
| POST | `/auth/refresh` | Cookie | Rotate refresh token; return new access token |
| POST | `/auth/logout` | JWT | Revoke refresh token |

### 7.2 Vault Config & Verification

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/vault/config` | JWT | Return `{ argon2_salt, argon2_time, argon2_memory, argon2_lanes }` |
| POST | `/vault/verify-mvk` | JWT | Timing-safe compare of submitted hash vs stored hash; 200 or 401 |
| POST | `/vault/rotate` | JWT + Admin | Replace MVK hash + accept re-encrypted credential blobs in batch |

### 7.3 Namespaces

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/namespaces` | JWT | List all namespaces |
| POST | `/namespaces` | JWT + Admin | Create namespace |
| PATCH | `/namespaces/:id` | JWT + Admin | Rename / update namespace |
| DELETE | `/namespaces/:id` | JWT + Admin | Delete namespace (credentials → namespace_id NULL) |

### 7.4 Users

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users` | JWT + Admin | List all users |
| GET | `/users/:id` | JWT | Own profile; admin can fetch any |
| PATCH | `/users/:id/activate` | JWT + Admin | Toggle `is_active` |
| PATCH | `/users/:id/role` | JWT + Admin | Set `is_admin` |
| PATCH | `/users/:id/password` | JWT (self or admin) | Reset password |
| DELETE | `/users/:id` | JWT | Delete own account; admin can delete any except initial |

### 7.5 Credentials

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/credentials` | JWT | List credentials (metadata only — no `encrypted_data`). Supports `?namespace=&tags=` filter |
| GET | `/credentials/:id` | JWT | Fetch single credential including `encrypted_data`; writes `credential_viewed` audit entry |
| POST | `/credentials` | JWT | Create credential |
| PATCH | `/credentials/:id` | JWT | Update credential (name, description, tags, namespace, or re-encrypted data) |
| DELETE | `/credentials/:id` | JWT | Delete credential |

### 7.6 Audit Log

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/audit` | JWT | Paginated audit log; supports `?user_id=&action=&limit=&before=` |

---

## 8. MVK Rotation Wizard

Accessible only to admins via `/admin/vault`. This is a guided multi-step flow because the operation is destructive and irreversible.

```
Step 1 — Warning
   Display: "This operation will re-encrypt every credential with a new Master Vault Key.
             All users will be signed out and must re-enter the new MVK at next login."
   Confirm checkbox + "Begin Rotation" button.

Step 2 — Enter New MVK
   Admin enters new MVK (10–30 chars), confirms it (second input).
   WASM derives new vault_key from new MVK + a newly generated salt.

Step 3 — Re-encryption
   Browser fetches all credential IDs from GET /credentials.
   For each credential:
     - GET /credentials/:id  → receive encrypted_data
     - WASM.decrypt_credential(encrypted_data)   [old vault_key]
     - WASM.encrypt_credential(plaintext)        [new vault_key]
     - Progress bar advances (n / total)
   On completion, browser sends POST /vault/rotate {
       new_argon2_salt, new_argon2_hash,
       credentials: [{ id, encrypted_data }, ...]
   }
   Server replaces vault_config and all encrypted_data values in a single transaction.

Step 4 — Done
   Old vault_key zeroed via WASM.lock_vault().
   All refresh tokens revoked server-side (force logout all users).
   Admin is redirected to login.
```

---

## 9. Frontend Pages & Components

```
/setup                   SetupPage           — initial admin + MVK creation
/login                   LoginPage           — username + password + MVK
/vault                   VaultPage           — credential list, search, namespace/tag filter
/vault/new               NewCredentialPage
/vault/:id               CredentialDetailPage — decrypt on demand
/admin/users             UserManagementPage   — admin only
/admin/vault             VaultSettingsPage    — MVK rotation wizard
/profile                 ProfilePage          — change own password, delete own account
```

### Key Components

- **`VaultUnlockGuard`** — wraps all protected routes; checks `WASM.is_vault_unlocked()` and redirects to MVK re-entry if false.
- **`ActivityTimer`** — global hook that resets on interaction events and calls `WASM.lock_vault()` after 10 minutes idle.
- **`CredentialCard`** — shows type icon, name, description, namespace badge, tag chips, timestamps.
- **`RevealButton`** — calls WASM to decrypt; shows plaintext for configurable N seconds, then clears DOM.
- **`CopyButton`** — decrypts and writes to clipboard; schedules `navigator.clipboard.writeText('')` after 30 seconds.
- **`AuditSidePanel`** — slide-in panel available on all pages (accessible via a toolbar button); displays paginated audit log visible to all users.
- **`MVKRotationWizard`** — step-by-step wizard component with progress bar (see §8).
- **`ThemeToggle`** — light / dark mode switcher (Tailwind `dark:` classes, preference persisted to localStorage).
- **`NamespaceFilter` + `TagFilter`** — filter controls on the vault list view; drive `?namespace=&tags=` query params.

### UI Theme

Terminal-inspired aesthetic: monospace font for credential values, black/dark-grey backgrounds in dark mode, white/light-grey in light mode. Accent color: green (`#22c55e` / Tailwind `green-500`). Minimal chrome. Shadcn UI components restyled to match.

---

## 10. Security Considerations

| Concern | Mitigation |
|---|---|
| MVK brute-force | `argon2_hash` never sent to browser; server-side timing-safe compare only |
| Offline credential brute-force | AES-256-GCM with random nonce per credential; no key material on server |
| JWT theft | Short 15-min TTL; no localStorage; refresh token is httpOnly cookie |
| Refresh token theft | httpOnly + Secure cookie; rotated on each use; revocation table |
| Deactivated user access | is_active checked on every request via 30s in-process cache |
| Stale sessions after MVK rotation | All refresh tokens forcibly revoked on rotation |
| WASM key lingering in memory | `zeroize` on `lock_vault()`, page unload, and module drop |
| Unauthorized setup re-run | `/auth/setup` returns 409 if `vault_config` exists |
| Clipboard exposure | Clipboard cleared after 30 seconds |
| Private key over-exposure | `private_key` type shows additional confirmation dialog before reveal/copy |
| Audit trail | All sensitive actions logged with user identity and timestamp |
| Rate limiting | `/auth/login`, `/auth/setup`, `/vault/verify-mvk` rate-limited in GIN middleware |
| TLS | All traffic over HTTPS in production; enforced via nginx in docker-compose |
| CORS | Restricted to frontend origin via GIN CORS middleware |

---

## 11. Deployment (docker-compose)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment: [POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD]
    volumes: [pgdata:/var/lib/postgresql/data]

  backend:
    build: ./backend          # multi-stage Go Dockerfile
    environment: [DATABASE_URL, JWT_SECRET, CORS_ORIGIN, ...]
    depends_on: [postgres]

  frontend:
    build: ./frontend         # Vite build + nginx
    ports: ["443:443"]
    # /api/* proxied to backend; /wasm/* served as wasm content-type
```

Environment variables manage DB connection, JWT secret, CORS origin, TLS cert paths, and Argon2 params (read-only after setup).

---

## 12. Build Pipeline

```
frontend/src/wasm/  →  wasm-pack build --target web  →  frontend/src/wasm/pkg/
                              ↓
                     Vite bundles React + WASM pkg → dist/
                              ↓
                     nginx serves dist/ + proxies /api to Go

backend/  →  go build ./cmd/server  →  single binary
          →  Docker multi-stage image
```

---

## 13. Out of Scope (v1)

- Custom / arbitrary credential types
- Per-user credential ownership or granular ACLs
- Argon2 param migration after initial setup
- LDAP / SSO / OAuth login
- Secrets injection (CLI, CI/CD integrations)
- Mobile clients
