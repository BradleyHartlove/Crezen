package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/crezen/backend/internal/middleware"
	"github.com/crezen/backend/internal/models"
)

type UsersHandler struct {
	DB *gorm.DB
}

func (h *UsersHandler) List(c *gin.Context) {
	var users []models.User
	h.DB.Find(&users)
	c.JSON(http.StatusOK, users)
}

func (h *UsersHandler) Get(c *gin.Context) {
	callerID := c.MustGet(middleware.ContextUserID).(uuid.UUID)
	isAdmin, _ := c.Get(middleware.ContextIsAdmin)

	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if callerID != targetID {
		if admin, ok := isAdmin.(bool); !ok || !admin {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
	}

	var user models.User
	if err := h.DB.Where("id = ?", targetID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *UsersHandler) Activate(c *gin.Context) {
	callerID := c.MustGet(middleware.ContextUserID).(uuid.UUID)
	callerUsername := c.MustGet(middleware.ContextUsername).(string)

	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req struct {
		Active bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.DB.Where("id = ?", targetID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	h.DB.Model(&user).Update("is_active", req.Active)
	middleware.InvalidateUser(targetID)

	action := models.AuditUserDeactivated
	if req.Active {
		action = models.AuditUserActivated
	}
	writeAudit(h.DB, &callerID, callerUsername, action, nil, nil)
	c.JSON(http.StatusOK, gin.H{"is_active": req.Active})
}

func (h *UsersHandler) SetRole(c *gin.Context) {
	callerID := c.MustGet(middleware.ContextUserID).(uuid.UUID)
	callerUsername := c.MustGet(middleware.ContextUsername).(string)

	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req struct {
		IsAdmin bool `json:"is_admin"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.DB.Model(&models.User{}).Where("id = ?", targetID).Update("is_admin", req.IsAdmin)
	writeAudit(h.DB, &callerID, callerUsername, models.AuditUserRoleChanged, nil, nil)
	c.JSON(http.StatusOK, gin.H{"is_admin": req.IsAdmin})
}

func (h *UsersHandler) ResetPassword(c *gin.Context) {
	callerID := c.MustGet(middleware.ContextUserID).(uuid.UUID)
	callerUsername := c.MustGet(middleware.ContextUsername).(string)
	isAdmin, _ := c.Get(middleware.ContextIsAdmin)

	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if callerID != targetID {
		if admin, ok := isAdmin.(bool); !ok || !admin {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
	}

	var req struct {
		Password string `json:"password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "hashing failed"})
		return
	}
	h.DB.Model(&models.User{}).Where("id = ?", targetID).Update("hashed_password", string(hashed))
	writeAudit(h.DB, &callerID, callerUsername, models.AuditUserPasswordReset, nil, nil)
	c.JSON(http.StatusOK, gin.H{"message": "password updated"})
}

func (h *UsersHandler) Delete(c *gin.Context) {
	callerID := c.MustGet(middleware.ContextUserID).(uuid.UUID)
	callerUsername := c.MustGet(middleware.ContextUsername).(string)
	isAdmin, _ := c.Get(middleware.ContextIsAdmin)

	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if callerID != targetID {
		if admin, ok := isAdmin.(bool); !ok || !admin {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
	}

	var user models.User
	if err := h.DB.Where("id = ?", targetID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if user.IsInitial {
		c.JSON(http.StatusForbidden, gin.H{"error": "initial account cannot be deleted"})
		return
	}

	h.DB.Delete(&user)
	writeAudit(h.DB, &callerID, callerUsername, models.AuditUserDeleted, nil, nil)
	c.JSON(http.StatusOK, gin.H{"message": "user deleted"})
}
