package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/crezen/backend/internal/middleware"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func makeToken(secret string, userID uuid.UUID, username string, isAdmin bool, ttl time.Duration) string {
	claims := &middleware.Claims{
		UserID:   userID.String(),
		Username: username,
		IsAdmin:  isAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	tok, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	return tok
}

func TestAuthMiddlewareNoToken(t *testing.T) {
	router := gin.New()
	router.GET("/", middleware.AuthMiddleware("secret"), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req, _ := http.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddlewareValidToken(t *testing.T) {
	const secret = "test-secret-value-that-is-long-enough!!"
	userID := uuid.New()
	token := makeToken(secret, userID, "alice", false, 15*time.Minute)

	called := false
	router := gin.New()
	router.GET("/", middleware.AuthMiddleware(secret), func(c *gin.Context) {
		called = true
		gotID, _ := c.Get(middleware.ContextUserID)
		if gotID.(uuid.UUID) != userID {
			t.Errorf("context userID mismatch: got %v, want %v", gotID, userID)
		}
		gotName, _ := c.Get(middleware.ContextUsername)
		if gotName.(string) != "alice" {
			t.Errorf("context username mismatch: got %v", gotName)
		}
		c.Status(http.StatusOK)
	})

	req, _ := http.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if !called {
		t.Fatal("handler was not called")
	}
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestAuthMiddlewareExpiredToken(t *testing.T) {
	const secret = "test-secret-value-that-is-long-enough!!"
	token := makeToken(secret, uuid.New(), "bob", false, -time.Minute)

	router := gin.New()
	router.GET("/", middleware.AuthMiddleware(secret), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req, _ := http.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddlewareMalformedToken(t *testing.T) {
	router := gin.New()
	router.GET("/", middleware.AuthMiddleware("secret"), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req, _ := http.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer not.a.real.token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddlewareWrongSecret(t *testing.T) {
	token := makeToken("correct-secret", uuid.New(), "carol", false, 15*time.Minute)

	router := gin.New()
	router.GET("/", middleware.AuthMiddleware("wrong-secret"), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req, _ := http.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}
