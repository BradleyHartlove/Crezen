package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/crezen/backend/internal/middleware"
)

func TestAdminMiddlewareAllowsAdmin(t *testing.T) {
	router := gin.New()
	router.GET("/", func(c *gin.Context) {
		c.Set(middleware.ContextUserID, uuid.New())
		c.Set(middleware.ContextIsAdmin, true)
	}, middleware.AdminMiddleware(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req, _ := http.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for admin, got %d", w.Code)
	}
}

func TestAdminMiddlewareBlocksNonAdmin(t *testing.T) {
	router := gin.New()
	router.GET("/", func(c *gin.Context) {
		c.Set(middleware.ContextUserID, uuid.New())
		c.Set(middleware.ContextIsAdmin, false)
	}, middleware.AdminMiddleware(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req, _ := http.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for non-admin, got %d", w.Code)
	}
}

func TestAdminMiddlewareMissingContext(t *testing.T) {
	router := gin.New()
	router.GET("/", middleware.AdminMiddleware(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req, _ := http.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 when IsAdmin context absent, got %d", w.Code)
	}
}
