# Crezen

A browser-encrypted credential vault for development teams. All cryptographic operations run inside a Rust WebAssembly module — the Go backend **never sees plaintext values or the Master Vault Key**.

---

## How it works

Credentials are encrypted and decrypted entirely in the browser. The server stores only an Argon2id-derived verifier — not the encryption key. Even a full database dump cannot be used to recover credential values without the MVK.

```
raw_mvk + argon2_salt
   └─► Argon2id → master
         ├─► HKDF("crezen-verifier")  → verifier   [stored server-side for login check]
         └─► HKDF("crezen-vault-key") → vault_key  [lives only in WASM thread_local]
```

Each credential is encrypted as `base64(nonce || ciphertext || GCM tag)` using AES-256-GCM with a random nonce. Key material is zeroed via `zeroize` on vault lock, page unload, and module drop.

---

## Features

- **Zero-knowledge backend** — server stores ciphertext only; vault key never leaves the browser
- **Shared team vault** — all active users access all credentials; no per-user ownership
- **Role-based access** — admin and standard user roles
- **Namespaces & tags** — organize credentials by environment or category
- **Audit log** — every view, create, update, delete, and auth event is recorded
- **Auto-lock** — vault locks after 10 minutes of inactivity; re-enter MVK without a full re-login
- **MVK rotation wizard** — guided admin flow that re-encrypts all credentials in the browser and atomically swaps the vault config
- **Short-lived tokens** — 15-minute JWT in memory; 7-day httpOnly refresh cookie, rotated on each use

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind + Shadcn UI |
| State | Zustand |
| Cryptography | Rust WASM (wasm-pack, aes-gcm, argon2, hkdf, zeroize) |
| Backend | Go 1.23 + Gin |
| ORM | GORM + golang-migrate |
| Database | PostgreSQL 16 |
| Auth | JWT (memory) + httpOnly refresh cookie |
| Container | Docker + docker-compose |

---

## Quick start

```sh
cp .env.example .env   # edit before first run
make up                # docker compose up --build -d
make logs              # tail logs
```

Then open `http://localhost` — the first-run wizard will prompt you to create an admin account and set the Master Vault Key.

Other make targets:

```sh
make down     # stop containers
make restart  # restart without rebuild
make clean    # stop + remove volumes (deletes all data)
```

---

## First-run setup

1. Navigate to `http://localhost`. You are redirected to `/setup`.
2. Choose a username and password for the initial admin account.
3. Set the Master Vault Key (MVK) — 10–30 characters. **This is not recoverable.** Write it down.
4. The vault is initialized; you are redirected to login.

After setup, additional users register at `/register` and are activated by an admin.

---

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres DSN (e.g. `postgres://user:pass@postgres:5432/crezen`) |
| `JWT_SECRET` | ≥ 32 random bytes — `openssl rand -hex 32` |
| `CORS_ORIGIN` | Frontend origin (e.g. `http://localhost`) |
| `PORT` | Backend listen port (default `8080`) |
| `POSTGRES_DB` | Database name |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |

---

## Development

### Backend (Go)

```sh
cd backend
go build ./...        # compile check
go test ./...         # run tests
go run ./cmd/server   # run locally (needs a running Postgres)
```

### Frontend (React + TypeScript)

```sh
cd frontend
npm install
npm run dev     # Vite dev server on :5173, proxies /api → localhost:8080
npm run build   # tsc + vite build
```

### WASM (Rust)

```sh
cd frontend/src/wasm
wasm-pack build --target web --out-dir pkg
```

The compiled `pkg/` is committed so the frontend builds without a Rust toolchain. Rebuild only when `src/lib.rs` changes.

---

## API overview

Base path: `/api/v1`. All protected routes require `Authorization: Bearer <token>`.

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/setup`, `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` |
| Vault | `GET /vault/config`, `POST /vault/verify-mvk`, `POST /vault/rotate` (admin) |
| Credentials | `GET/POST /credentials`, `GET/PATCH/DELETE /credentials/:id` |
| Namespaces | `GET/POST /namespaces`, `PATCH/DELETE /namespaces/:id` (admin write) |
| Users | `GET /users` (admin), `GET/PATCH/DELETE /users/:id` |
| Audit | `GET /audit` |

`GET /credentials` returns metadata only. `GET /credentials/:id` includes `encrypted_data` and writes a `credential_viewed` audit entry.

---

## Security notes

- `/auth/setup` returns 409 if `vault_config` already exists — the vault cannot be re-initialized without wiping the database
- `is_active` is checked on every request via a 30-second in-process cache; deactivated users are locked out within seconds
- All refresh tokens are revoked on MVK rotation, forcing a full re-login for every user
- Rate limiting is applied to `/auth/login`, `/auth/setup`, and `/vault/verify-mvk`
- Clipboard is cleared 30 seconds after a copy operation
- `private_key` credential type requires an extra confirmation before reveal or copy

---

## License

[MIT](LICENSE)
