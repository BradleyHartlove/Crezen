package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type CredentialType string

const (
	CredTypeUsername   CredentialType = "username"
	CredTypePassword   CredentialType = "password"
	CredTypeAPIToken   CredentialType = "api_token"
	CredTypeCACert     CredentialType = "ca_cert"
	CredTypePublicKey  CredentialType = "public_key"
	CredTypePrivateKey CredentialType = "private_key"
	CredTypeCert       CredentialType = "cert"
)

type Credential struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name          string         `gorm:"not null"                                       json:"name"`
	Description   string         `gorm:"not null;default:''"                            json:"description"`
	Type          CredentialType `gorm:"type:credential_type;not null"                  json:"type"`
	NamespaceID   *uuid.UUID     `gorm:"type:uuid"                                      json:"namespace_id"`
	Tags          pq.StringArray `gorm:"type:text[]"                                    json:"tags"`
	EncryptedData string         `gorm:"not null"                                       json:"encrypted_data,omitempty"`
	CreatedAt     time.Time      `                                                      json:"created_at"`
	UpdatedAt     time.Time      `                                                      json:"updated_at"`
}
