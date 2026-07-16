# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Crezen

A web-based credential vault for development teams. Credentials are encrypted entirely in the browser using a Rust WASM module — the Go backend never sees plaintext values or the Master Vault Key (MVK). It's a shared team vault: all active users access all credentials.

## Commands

### Run (Docker — primary)

```sh
cp .env.example .env   # first time only; edit before running
make up                # docker compose up --build -d
make logs              # follow logs
make down              # stop
make clean             # stop + remove volumes
```

### Backend (Go)

```sh
cd backend
go build ./...                    # compile check
go test ./...                     # run all tests
go test ./internal/handlers/...   # single package
go run ./cmd/server               # run locally (needs DB)
```

### Frontend (React + TypeScript)

```sh
cd frontend
npm install
npm run dev      # Vite dev server on :5173, proxies /api → localhost:8080
npm run build    # tsc + vite build
```

### WASM (Rust)

The WASM crate lives at `frontend/src/wasm/`. Build with:

```sh
cd frontend/src/wasm
wasm-pack build --target web --out-dir pkg
```

The compiled `pkg/` directory is imported by `frontend/src/wasm/index.ts`. Rebuild whenever `src/lib.rs` changes; the output is committed so the frontend can build without Rust toolchain installed.

## Architecture

### Cryptographic flow (critical to understand)

All key material lives exclusively in the browser's WASM `thread_local`. The server stores only an Argon2id + HKDF-derived **verifier**; the actual **vault_key** used for AES-256-GCM is derived under a different HKDF label and never sent anywhere.

```
raw_mvk + argon2_salt
   └─► Argon2id → master
         ├─► HKDF("crezen-verifier")  → verifier  [stored in vault_config, compared server-side]
         └─► HKDF("crezen-vault-key") → vault_key [stays in WASM thread_local only]
```

Encrypted credentials are stored as `base64(nonce || ciphertext || GCM tag)` in the `credentials.encrypted_data` column.

### Session lifecycle

- **JWT access token** (15 min TTL) — held in Zustand memory, never localStorage.
- **Refresh token** (7 day TTL) — httpOnly cookie, rotated on every use, revoked on logout/deactivation/MVK rotation.
- **Auto-lock** — `useActivityTimer` hook fires `wasm.lockVault()` after 10 minutes of inactivity; user re-enters MVK without a full re-login.
- **is_active cache** — `IsActiveMiddleware` maintains a 30-second in-process cache per user; call `middleware.InvalidateUser(id)` after any activation/deactivation change so it takes effect immediately.

### Backend (`backend/`)

Go 1.23 + Gin. Entry point: `cmd/server/main.go`. Structure:

- `internal/config/` — env-var loading (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT`)
- `internal/db/` — GORM connection + golang-migrate runner (migrations in `internal/db/migrations/`)
- `internal/models/` — GORM model structs
- `internal/handlers/` — one file per resource (`auth`, `vault`, `users`, `namespaces`, `credentials`, `audit`); `jwt.go` has shared token helpers
- `internal/middleware/` — `auth` (JWT parse → sets `ContextUserID`/`ContextIsAdmin`), `active_cache` (is_active check), `admin` (gate admin routes), `rate_limit` (token bucket via `golang.org/x/time/rate`)
- `internal/router/` — wires all routes; public routes, protected routes (JWT + is_active), and admin routes (JWT + is_active + is_admin)

Adding a new migration: create numbered SQL files in `internal/db/migrations/` following the existing `000NNN_<name>.up.sql` / `.down.sql` pattern. Migrations run automatically on startup.

### Frontend (`frontend/src/`)

React 18 + TypeScript + Tailwind + Shadcn UI (Radix primitives).

- `api/` — typed `fetch` wrappers; `client.ts` adds the `Authorization` header from the auth store and handles token refresh
- `store/` — three Zustand stores: `auth` (user + access token), `vault` (unlock state), `ui` (sidebar/panel visibility)
- `wasm/index.ts` — thin TypeScript wrapper around the compiled WASM pkg; call `initWasm()` once at app start before any other `wasm.*` calls
- `components/auth/ProtectedRoute` — checks `isAuthenticated`; `VaultUnlockModal` fires when `wasm.isVaultUnlocked()` returns false
- `components/credentials/` — `RevealButton` and `CopyButton` both call `wasm.decryptCredential()` inline; plaintext is never stored in state
- `hooks/useActivityTimer` — attaches global `mousemove`/`keydown` listeners; calls `wasm.lockVault()` on idle timeout

### UI theme

Terminal-inspired. Monospace font for credential values. Accent: Tailwind `green-500` (`#22c55e`). Components are Shadcn UI restyled to match the dark/light terminal aesthetic.

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres DSN |
| `JWT_SECRET` | ≥32 random chars; `openssl rand -hex 32` |
| `CORS_ORIGIN` | Frontend origin (e.g. `http://localhost`) |
| `PORT` | Backend listen port (default `8080`) |
| `POSTGRES_DB/USER/PASSWORD` | Used by the postgres Docker service |

## Key Constraints

- `vault_config` is **write-once** at setup (`/auth/setup` returns 409 if it already exists). Argon2 params are frozen after initialization.
- The `is_initial` user flag marks the first admin account; it cannot be deleted.
- `GET /credentials` returns metadata only (no `encrypted_data`). Fetching `encrypted_data` requires `GET /credentials/:id`, which also writes a `credential_viewed` audit entry.
- Rate-limited endpoints: `/auth/login`, `/auth/setup`, `/vault/verify-mvk`.
- MVK rotation (`POST /vault/rotate`) is admin-only and revokes all refresh tokens, forcing a full logout for every user.
