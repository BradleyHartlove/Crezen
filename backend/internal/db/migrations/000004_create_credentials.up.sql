CREATE TYPE credential_type AS ENUM (
    'username', 'password', 'api_token',
    'ca_cert', 'public_key', 'private_key', 'cert'
);

CREATE TABLE credentials (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    type           credential_type NOT NULL,
    namespace_id   UUID REFERENCES namespaces(id) ON DELETE SET NULL,
    tags           TEXT[] NOT NULL DEFAULT '{}',
    encrypted_data TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credentials_namespace ON credentials(namespace_id);
CREATE INDEX idx_credentials_tags ON credentials USING GIN(tags);
CREATE INDEX idx_credentials_type ON credentials(type);
