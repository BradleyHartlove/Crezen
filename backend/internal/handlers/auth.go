package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/crezen/backend/internal/middleware"
	"github.com/crezen/backend/internal/models"
)

type AuthHandler struct {
	DB        *gorm.DB
	JWTSecret string
}

func (h *AuthHandler) Status(c *gin.Context) {
	var count int64
	h.DB.Model(&models.VaultConfig{}).Count(&count)
	c.JSON(http.StatusOK, gin.H{"initialized": count > 0})
}

type setupRequest struct {
	Username        string `json:"username"          binding:"required,min=3,max=64"`
	Password        string `json:"password"          binding:"required,min=8"`
	Argon2Salt      string `json:"argon2_salt"       binding:"required"`
	Argon2Hash      string `json:"argon2_hash"       binding:"required"`
	Argon2Time      uint32 `json:"argon2_time"       binding:"required"`
	Argon2Memory    uint32 `json:"argon2_memory"     binding:"required"`
	Argon2Lanes     uint8  `json:"argon2_lanes"      binding:"required"`
}

func (h *AuthHandler) Setup(c *gin.Context) {
	var count int64
	h.DB.Model(&models.VaultConfig{}).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "already initialized"})
		return
	}

	var req setupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	saltBytes, err := base64.StdEncoding.DecodeString(req.Argon2Salt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid argon2_salt encoding"})
		return
	}
	hashBytes, err := base64.StdEncoding.DecodeString(req.Argon2Hash)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid argon2_hash encoding"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "password hashing failed"})
		return
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		vc := models.VaultConfig{
			Argon2Salt:   saltBytes,
			Argon2Hash:   hashBytes,
			Argon2Time:   req.Argon2Time,
			Argon2Memory: req.Argon2Memory,
			Argon2Lanes:  req.Argon2Lanes,
		}
		if err := tx.Create(&vc).Error; err != nil {
			return err
		}
		user := models.User{
			Username:       req.Username,
			HashedPassword: string(hashed),
			IsAdmin:        true,
			IsActive:       true,
			IsInitial:      true,
		}
		return tx.Create(&user).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "setup failed"})
		return
	}
	writeAudit(h.DB, nil, req.Username, models.AuditUserCreated, nil, nil)
	c.JSON(http.StatusCreated, gin.H{"message": "setup complete"})
}

type registerRequest struct {
	Username string `json:"username" binding:"required,min=3,max=64"`
	Password string `json:"password" binding:"required,min=8"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "password hashing failed"})
		return
	}

	user := models.User{
		Username:       req.Username,
		HashedPassword: string(hashed),
		IsAdmin:        false,
		IsActive:       false,
	}
	if err := h.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username already taken"})
		return
	}
	writeAudit(h.DB, &user.ID, req.Username, models.AuditUserCreated, nil, nil)
	c.JSON(http.StatusCreated, gin.H{"message": "account created, awaiting admin approval"})
}

type loginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		writeAudit(h.DB, nil, req.Username, models.AuditLoginFailure, nil, nil)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.HashedPassword), []byte(req.Password)); err != nil {
		writeAudit(h.DB, &user.ID, user.Username, models.AuditLoginFailure, nil, nil)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}
	if !user.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "account inactive"})
		return
	}

	accessToken, err := issueAccessToken(h.JWTSecret, user.ID, user.Username, user.IsAdmin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	rawToken, tokenHash, err := generateRefreshToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}
	rt := models.RefreshToken{
		TokenHash: tokenHash,
		UserID:    user.ID,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	}
	h.DB.Create(&rt)

	writeAudit(h.DB, &user.ID, user.Username, models.AuditLoginSuccess, nil, nil)
	setRefreshCookie(c, rawToken)
	c.JSON(http.StatusOK, gin.H{
		"access_token": accessToken,
		"user": gin.H{
			"id":         user.ID,
			"username":   user.Username,
			"is_admin":   user.IsAdmin,
			"is_initial": user.IsInitial,
		},
	})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	rawToken, err := c.Cookie("refresh_token")
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing refresh token"})
		return
	}

	tokenHash := hashToken(rawToken)
	var rt models.RefreshToken
	if err := h.DB.Where("token_hash = ? AND revoked = false AND expires_at > ?", tokenHash, time.Now()).First(&rt).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired refresh token"})
		return
	}

	var user models.User
	if err := h.DB.Where("id = ? AND is_active = true", rt.UserID).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user inactive or not found"})
		return
	}

	// rotate
	h.DB.Model(&rt).Update("revoked", true)
	newRaw, newHash, err := generateRefreshToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}
	h.DB.Create(&models.RefreshToken{
		TokenHash: newHash,
		UserID:    user.ID,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	})

	accessToken, err := issueAccessToken(h.JWTSecret, user.ID, user.Username, user.IsAdmin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	setRefreshCookie(c, newRaw)
	c.JSON(http.StatusOK, gin.H{"access_token": accessToken})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	userID := c.MustGet(middleware.ContextUserID).(uuid.UUID)
	username := c.MustGet(middleware.ContextUsername).(string)

	rawToken, err := c.Cookie("refresh_token")
	if err == nil {
		tokenHash := hashToken(rawToken)
		h.DB.Model(&models.RefreshToken{}).Where("token_hash = ?", tokenHash).Update("revoked", true)
	}
	writeAudit(h.DB, &userID, username, models.AuditLogout, nil, nil)
	c.SetCookie("refresh_token", "", -1, "/", "", true, true)
	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

// helpers

func generateRefreshToken() (raw, hashed string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return
	}
	raw = hex.EncodeToString(b)
	hashed = hashToken(raw)
	return
}

func hashToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

func setRefreshCookie(c *gin.Context, raw string) {
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie("refresh_token", raw, 7*24*60*60, "/", "", true, true)
}

func writeAudit(db *gorm.DB, userID *uuid.UUID, username string, action models.AuditAction, credID *uuid.UUID, meta []byte) {
	entry := models.AuditLog{
		UserID:       userID,
		Username:     username,
		Action:       action,
		CredentialID: credID,
		Meta:         meta,
	}
	db.Create(&entry)
}

func timingSafeEqual(a, b []byte) bool {
	return subtle.ConstantTimeCompare(a, b) == 1
}
