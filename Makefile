.PHONY: up down build logs restart clean \
        lint lint-backend lint-frontend lint-rust \
        test test-backend test-rust

# ── Docker ──────────────────────────────────────────────────────────────────

up:
	@[ -f .env ] || (cp .env.example .env && echo "Created .env from .env.example — edit it before rerunning")
	docker compose up --build -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

restart:
	docker compose restart

clean:
	docker compose down -v --remove-orphans

# ── Lint ─────────────────────────────────────────────────────────────────────

lint-backend:
	cd backend && golangci-lint run ./...

lint-frontend:
	cd frontend && npm run lint && npm run format:check

lint-rust:
	cd frontend/src/wasm && cargo clippy --target wasm32-unknown-unknown -- -D warnings

lint: lint-backend lint-frontend lint-rust

# ── Test ─────────────────────────────────────────────────────────────────────

test-backend:
	cd backend && go test -race -count=1 ./...

test-rust:
	cd frontend/src/wasm && cargo test

test: test-backend test-rust
