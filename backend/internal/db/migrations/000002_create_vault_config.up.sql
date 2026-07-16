CREATE TABLE vault_config (
    id             SERIAL PRIMARY KEY,
    argon2_salt    BYTEA NOT NULL,
    argon2_hash    BYTEA NOT NULL,
    argon2_time    INT NOT NULL DEFAULT 3,
    argon2_memory  INT NOT NULL DEFAULT 65536,
    argon2_lanes   INT NOT NULL DEFAULT 4,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
