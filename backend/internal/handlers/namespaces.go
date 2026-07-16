package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/crezen/backend/internal/models"
)

type NamespacesHandler struct {
	DB *gorm.DB
}

func (h *NamespacesHandler) List(c *gin.Context) {
	var ns []models.Namespace
	h.DB.Order("name ASC").Find(&ns)
	c.JSON(http.StatusOK, ns)
}

func (h *NamespacesHandler) Create(c *gin.Context) {
	var req struct {
		Name        string `json:"name"        binding:"required,min=1,max=64"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ns := models.Namespace{Name: req.Name, Description: req.Description}
	if err := h.DB.Create(&ns).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "namespace name already exists"})
		return
	}
	c.JSON(http.StatusCreated, ns)
}

func (h *NamespacesHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
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
	h.DB.Model(&models.Namespace{}).Where("id = ?", id).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (h *NamespacesHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	h.DB.Where("id = ?", id).Delete(&models.Namespace{})
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
