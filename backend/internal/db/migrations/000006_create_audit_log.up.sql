CREATE TYPE audit_action AS ENUM (
    'credential_viewed',
    'credential_created',
    'credential_updated',
    'credential_deleted',
    'user_created',
    'user_activated',
    'user_deactivated',
    'user_deleted',
    'user_role_changed',
    'user_password_reset',
    'vault_unlocked',
    'vault_locked',
    'vault_mvk_rotated',
    'login_success',
    'login_failure',
    'logout'
);

CREATE TABLE audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    username      TEXT,
    action        audit_action NOT NULL,
    credential_id UUID REFERENCES credentials(id) ON DELETE SET NULL,
    meta          JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user    ON audit_log(user_id);
CREATE INDEX idx_audit_log_action  ON audit_log(action);
