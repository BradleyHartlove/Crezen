package models

import (
	"time"

	"github.com/google/uuid"
)

func (RecoveryCode) TableName() string { return "recovery_codes" }

type RecoveryCode struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CodeHash     string     `gorm:"uniqueIndex;not null"                           json:"-"`
	SaltB64      string     `gorm:"not null"                                       json:"-"`
	EncryptedB64 string     `gorm:"not null"                                       json:"-"`
	CreatedAt    time.Time  `                                                      json:"created_at"`
	LastUsedAt   *time.Time `                                                      json:"last_used_at"`
}
