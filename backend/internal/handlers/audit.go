package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/crezen/backend/internal/models"
)

type AuditHandler struct {
	DB *gorm.DB
}

func (h *AuditHandler) List(c *gin.Context) {
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	query := h.DB.Model(&models.AuditLog{}).Order("created_at DESC").Limit(limit)

	if before := c.Query("before"); before != "" {
		t, err := time.Parse(time.RFC3339, before)
		if err == nil {
			query = query.Where("created_at < ?", t)
		}
	}
	if action := c.Query("action"); action != "" {
		query = query.Where("action = ?", action)
	}
	if userID := c.Query("user_id"); userID != "" {
		query = query.Where("user_id = ?", userID)
	}

	var entries []models.AuditLog
	query.Find(&entries)
	c.JSON(http.StatusOK, entries)
}
