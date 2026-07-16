package handlers

import (
	"encoding/base64"
	"net/http"

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
		return tx.Model(&models.RefreshToken{}).Where("revoked = false").Update("revoked", true).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "rotation failed"})
		return
	}

	writeAudit(h.DB, &userID, username, models.AuditVaultMVKRotated, nil, nil)
	c.JSON(http.StatusOK, gin.H{"message": "rotation complete"})
}
