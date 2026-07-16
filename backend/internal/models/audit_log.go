package models

import (
	"time"

	"github.com/google/uuid"
)

type AuditAction string

const (
	AuditCredentialViewed   AuditAction = "credential_viewed"
	AuditCredentialCreated  AuditAction = "credential_created"
	AuditCredentialUpdated  AuditAction = "credential_updated"
	AuditCredentialDeleted  AuditAction = "credential_deleted"
	AuditUserCreated        AuditAction = "user_created"
	AuditUserActivated      AuditAction = "user_activated"
	AuditUserDeactivated    AuditAction = "user_deactivated"
	AuditUserDeleted        AuditAction = "user_deleted"
	AuditUserRoleChanged    AuditAction = "user_role_changed"
	AuditUserPasswordReset  AuditAction = "user_password_reset"
	AuditVaultUnlocked      AuditAction = "vault_unlocked"
	AuditVaultLocked        AuditAction = "vault_locked"
	AuditVaultMVKRotated    AuditAction = "vault_mvk_rotated"
	AuditLoginSuccess       AuditAction = "login_success"
	AuditLoginFailure       AuditAction = "login_failure"
	AuditLogout             AuditAction = "logout"
)

func (AuditLog) TableName() string { return "audit_log" }

type AuditLog struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID       *uuid.UUID `gorm:"type:uuid"                                      json:"user_id"`
	Username     string     `                                                      json:"username"`
	Action       AuditAction `gorm:"type:audit_action;not null"                    json:"action"`
	CredentialID *uuid.UUID `gorm:"type:uuid"                                      json:"credential_id"`
	Meta         []byte     `gorm:"type:jsonb"                                     json:"meta,omitempty"`
	CreatedAt    time.Time  `                                                      json:"created_at"`
}
