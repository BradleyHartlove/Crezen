package handlers

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/crezen/backend/internal/middleware"
	"github.com/crezen/backend/internal/models"
)

type VaultHandler struct {
	DB        *gorm.DB
	JWTSecret string
}

func (h *VaultHandler) GetConfig(c *gin.Context) {
	var vc models.VaultConfig
	if err := h.DB.First(&vc).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "vault not configured"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"argon2_salt":   base64.StdEncoding.EncodeToString(vc.Argon2Salt),
		"argon2_time":   vc.Argon2Time,
		"argon2_memory": vc.Argon2Memory,
		"argon2_lanes":  vc.Argon2Lanes,
	})
}

type verifyMVKRequest struct {
	CandidateVerifier string `json:"candidate_verifier" binding:"required"`
}

func (h *VaultHandler) VerifyMVK(c *gin.Context) {
	userID := c.MustGet(middleware.ContextUserID).(uuid.UUID)
	username := c.MustGet(middleware.ContextUsername).(string)

	var req verifyMVKRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	candidate, err := base64.StdEncoding.DecodeString(req.CandidateVerifier)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid encoding"})
		return
	}

	var vc models.VaultConfig
	if err := h.DB.First(&vc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "vault config missing"})
		return
	}

	if !timingSafeEqual(vc.Argon2Hash, candidate) {
		writeAudit(h.DB, &userID, username, models.AuditLoginFailure, nil, nil)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid vault key"})
		return
	}

	writeAudit(h.DB, &userID, username, models.AuditVaultUnlocked, nil, nil)
	c.JSON(http.StatusOK, gin.H{"message": "verified"})
}

type rotateRequest struct {
	NewArgon2Salt  string `json:"new_argon2_salt"  binding:"required"`
	NewArgon2Hash  string `json:"new_argon2_hash"  binding:"required"`
	NewArgon2Time  uint32 `json:"new_argon2_time"  binding:"required"`
	NewArgon2Memory uint32 `json:"new_argon2_memory" binding:"required"`
	NewArgon2Lanes uint8  `json:"new_argon2_lanes" binding:"required"`
	Credentials    []struct {
		ID            string `json:"id"`
		EncryptedData string `json:"encrypted_data"`
	} `json:"credentials"`
}

func (h *VaultHandler) Rotate(c *gin.Context) {
	userID := c.MustGet(middleware.ContextUserID).(uuid.UUID)
	username := c.MustGet(middleware.ContextUsername).(string)

	var req rotateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	saltBytes, err := base64.StdEncoding.DecodeString(req.NewArgon2Salt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid salt encoding"})
		return
	}
	hashBytes, err := base64.StdEncoding.DecodeString(req.NewArgon2Hash)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid hash encoding"})
		return
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.VaultConfig{}).Where("1=1").Updates(map[string]any{
			"argon2_salt":   saltBytes,
			"argon2_hash":   hashBytes,
			"argon2_time":   req.NewArgon2Time,
			"argon2_memory": req.NewArgon2Memory,
			"argon2_lanes":  req.NewArgon2Lanes,
		}).Error; err != nil {
			return err
		}
		for _, cred := range req.Credentials {
			if err := tx.Model(&models.Credential{}).
				Where("id = ?", cred.ID).
				Update("encrypted_data", cred.EncryptedData).Error; err != nil {
				return err
			}
		}
		// revoke all refresh tokens to force re-login
		if err := tx.Model(&models.RefreshToken{}).Where("revoked = false").Update("revoked", true).Error; err != nil {
			return err
		}
		// invalidate recovery codes — they encrypt the old vault key
		return tx.Where("1=1").Delete(&models.RecoveryCode{}).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "rotation failed"})
		return
	}

	writeAudit(h.DB, &userID, username, models.AuditVaultMVKRotated, nil, nil)
	c.JSON(http.StatusOK, gin.H{"message": "rotation complete"})
}

type recoveryCodeEntry struct {
	Code         string `json:"code"          binding:"required"`
	SaltB64      string `json:"salt_b64"      binding:"required"`
	EncryptedB64 string `json:"encrypted_b64" binding:"required"`
}

type storeRecoveryCodesRequest struct {
	Codes []recoveryCodeEntry `json:"codes" binding:"required,min=1"`
}

func normalizeAndHashCode(code string) (string, error) {
	clean := strings.ToUpper(strings.ReplaceAll(code, "-", ""))
	rawBytes, err := hex.DecodeString(clean)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(rawBytes)
	return hex.EncodeToString(sum[:]), nil
}

func (h *VaultHandler) StoreRecoveryCodes(c *gin.Context) {
	var req storeRecoveryCodesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	records := make([]models.RecoveryCode, 0, len(req.Codes))
	for _, entry := range req.Codes {
		hash, err := normalizeAndHashCode(entry.Code)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid code format"})
			return
		}
		records = append(records, models.RecoveryCode{
			CodeHash:     hash,
			SaltB64:      entry.SaltB64,
			EncryptedB64: entry.EncryptedB64,
		})
	}

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("1=1").Delete(&models.RecoveryCode{}).Error; err != nil {
			return err
		}
		return tx.Create(&records).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store recovery codes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"count": len(records)})
}

func (h *VaultHandler) ListRecoveryCodes(c *gin.Context) {
	var codes []models.RecoveryCode
	if err := h.DB.Select("id, created_at, last_used_at").Find(&codes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	c.JSON(http.StatusOK, codes)
}

type recoverRequest struct {
	Code string `json:"code" binding:"required"`
}

func (h *VaultHandler) Recover(c *gin.Context) {
	var req recoverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := normalizeAndHashCode(req.Code)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid recovery code"})
		return
	}

	var rc models.RecoveryCode
	if err := h.DB.Where("code_hash = ?", hash).First(&rc).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid recovery code"})
		return
	}

	now := time.Now()
	h.DB.Model(&rc).Update("last_used_at", now)

	c.JSON(http.StatusOK, gin.H{
		"salt_b64":      rc.SaltB64,
		"encrypted_b64": rc.EncryptedB64,
	})
}
