package models

import (
	"time"

	"github.com/google/uuid"
)

type RefreshToken struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TokenHash string    `gorm:"uniqueIndex;not null"                           json:"-"`
	UserID    uuid.UUID `gorm:"type:uuid;not null"                             json:"user_id"`
	ExpiresAt time.Time `gorm:"not null"                                       json:"expires_at"`
	Revoked   bool      `gorm:"not null;default:false"                         json:"revoked"`
	CreatedAt time.Time `                                                      json:"created_at"`
}
