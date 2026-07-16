package models

import "time"

func (VaultConfig) TableName() string { return "vault_config" }

type VaultConfig struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Argon2Salt   []byte    `gorm:"not null"                 json:"-"`
	Argon2Hash   []byte    `gorm:"not null"                 json:"-"`
	Argon2Time   uint32    `gorm:"not null;default:3"       json:"argon2_time"`
	Argon2Memory uint32    `gorm:"not null;default:65536"   json:"argon2_memory"`
	Argon2Lanes  uint8     `gorm:"not null;default:4"       json:"argon2_lanes"`
	CreatedAt    time.Time `                                json:"created_at"`
}
