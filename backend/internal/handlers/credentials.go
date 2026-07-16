package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"

	"github.com/crezen/backend/internal/middleware"
	"github.com/crezen/backend/internal/models"
)

type CredentialsHandler struct {
	DB *gorm.DB
}

func (h *CredentialsHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.Credential{}).Omit("EncryptedData")

	if ns := c.Query("namespace_id"); ns != "" {
		query = query.Where("namespace_id = ?", ns)
	}
	if tagsParam := c.Query("tags"); tagsParam != "" {
		tags := strings.Split(tagsParam, ",")
		query = query.Where("tags @> ?", pq.StringArray(tags))
	}
	if search := c.Query("search"); search != "" {
		query = query.Where("name ILIKE ? OR description ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	var creds []models.Credential
	query.Order("name ASC").Find(&creds)
	c.JSON(http.StatusOK, creds)
}

func (h *CredentialsHandler) Get(c *gin.Context) {
	userID := c.MustGet(middleware.ContextUserID).(uuid.UUID)
	username := c.MustGet(middleware.ContextUsername).(string)

	id := c.Param("id")
	var cred models.Credential
	if err := h.DB.Where("id = ?", id).First(&cred).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	credUUID := cred.ID
	writeAudit(h.DB, &userID, username, models.AuditCredentialViewed, &credUUID, nil)
	c.JSON(http.StatusOK, cred)
}

type credentialRequest struct {
	Name          string                `json:"name"          binding:"required,min=1,max=128"`
	Description   string                `json:"description"   binding:"required"`
	Type          models.CredentialType `json:"type"          binding:"required"`
	NamespaceID   *string               `json:"namespace_id"`
	Tags          []string              `json:"tags"`
	EncryptedData string                `json:"encrypted_data" binding:"required"`
}

func (h *CredentialsHandler) Create(c *gin.Context) {
	userID := c.MustGet(middleware.ContextUserID).(uuid.UUID)
	username := c.MustGet(middleware.ContextUsername).(string)

	var req credentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cred := models.Credential{
		Name:          req.Name,
		Description:   req.Description,
		Type:          req.Type,
		Tags:          pq.StringArray(req.Tags),
		EncryptedData: req.EncryptedData,
	}
	if req.NamespaceID != nil {
		nsID, err := uuid.Parse(*req.NamespaceID)
		if err == nil {
			cred.NamespaceID = &nsID
		}
	}

	if err := h.DB.Create(&cred).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create failed"})
		return
	}
	writeAudit(h.DB, &userID, username, models.AuditCredentialCreated, &cred.ID, nil)
	c.JSON(http.StatusCreated, cred)
}

type updateCredentialRequest struct {
	Name          string     `json:"name"`
	Description   string     `json:"description"`
	NamespaceID   *string    `json:"namespace_id"`
	Tags          []string   `json:"tags"`
	EncryptedData string     `json:"encrypted_data"`
}

func (h *CredentialsHandler) Update(c *gin.Context) {
	userID := c.MustGet(middleware.ContextUserID).(uuid.UUID)
	username := c.MustGet(middleware.ContextUsername).(string)

	id := c.Param("id")
	var cred models.Credential
	if err := h.DB.Where("id = ?", id).First(&cred).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var req updateCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]any{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.EncryptedData != "" {
		updates["encrypted_data"] = req.EncryptedData
	}
	if req.Tags != nil {
		updates["tags"] = pq.StringArray(req.Tags)
	}
	if req.NamespaceID != nil {
		if *req.NamespaceID == "" {
			updates["namespace_id"] = nil
		} else if nsID, err := uuid.Parse(*req.NamespaceID); err == nil {
			updates["namespace_id"] = nsID
		}
	}

	h.DB.Model(&cred).Updates(updates)
	writeAudit(h.DB, &userID, username, models.AuditCredentialUpdated, &cred.ID, nil)
	c.JSON(http.StatusOK, cred)
}

func (h *CredentialsHandler) Delete(c *gin.Context) {
	userID := c.MustGet(middleware.ContextUserID).(uuid.UUID)
	username := c.MustGet(middleware.ContextUsername).(string)

	id := c.Param("id")
	credUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	h.DB.Where("id = ?", id).Delete(&models.Credential{})
	writeAudit(h.DB, &userID, username, models.AuditCredentialDeleted, &credUUID, nil)
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
