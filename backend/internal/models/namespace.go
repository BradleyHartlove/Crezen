package models

import (
	"time"

	"github.com/google/uuid"
)

type Namespace struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name        string    `gorm:"uniqueIndex;not null"                           json:"name"`
	Description string    `gorm:"not null;default:''"                            json:"description"`
	CreatedAt   time.Time `                                                      json:"created_at"`
}
