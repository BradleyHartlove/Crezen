CREATE TABLE recovery_codes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash     TEXT NOT NULL UNIQUE,
    salt_b64      TEXT NOT NULL,
    encrypted_b64 TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at  TIMESTAMPTZ
);
