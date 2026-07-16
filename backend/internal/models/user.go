package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Username       string    `gorm:"uniqueIndex;not null"                           json:"username"`
	HashedPassword string    `gorm:"not null"                                       json:"-"`
	IsAdmin        bool      `gorm:"not null;default:false"                         json:"is_admin"`
	IsActive       bool      `gorm:"not null;default:false"                         json:"is_active"`
	IsInitial      bool      `gorm:"not null;default:false"                         json:"is_initial"`
	CreatedAt      time.Time `                                                      json:"created_at"`
	UpdatedAt      time.Time `                                                      json:"updated_at"`
}
