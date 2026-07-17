package handlers

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/crezen/backend/internal/middleware"
)

func TestIssueAccessTokenIsValid(t *testing.T) {
	secret := "test-secret-key-that-is-long-enough!!"
	userID := uuid.New()

	token, err := issueAccessToken(secret, userID, "alice", true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token == "" {
		t.Fatal("expected non-empty token string")
	}

	claims := &middleware.Claims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(_ *jwt.Token) (any, error) {
		return []byte(secret), nil
	})
	if err != nil || !parsed.Valid {
		t.Fatalf("token should be valid: %v", err)
	}
	if claims.UserID != userID.String() {
		t.Errorf("expected userID %s, got %s", userID, claims.UserID)
	}
	if claims.Username != "alice" {
		t.Errorf("expected username 'alice', got %q", claims.Username)
	}
	if !claims.IsAdmin {
		t.Error("expected IsAdmin to be true")
	}
}

func TestIssueAccessTokenExpiry(t *testing.T) {
	token, _ := issueAccessToken("secret", uuid.New(), "bob", false)

	claims := &middleware.Claims{}
	jwt.ParseWithClaims(token, claims, func(_ *jwt.Token) (any, error) { //nolint:errcheck
		return []byte("secret"), nil
	})

	ttl := time.Until(claims.ExpiresAt.Time)
	if ttl <= 0 || ttl > 16*time.Minute {
		t.Errorf("expected ~15m TTL, got %v", ttl)
	}
}

func TestIssueAccessTokenWrongSecret(t *testing.T) {
	token, _ := issueAccessToken("correct-secret", uuid.New(), "charlie", false)

	claims := &middleware.Claims{}
	_, err := jwt.ParseWithClaims(token, claims, func(_ *jwt.Token) (any, error) {
		return []byte("wrong-secret"), nil
	})
	if err == nil {
		t.Fatal("expected error when verifying with wrong secret")
	}
}

func TestIssueAccessTokenNonAdminClaim(t *testing.T) {
	secret := "test-secret"
	token, _ := issueAccessToken(secret, uuid.New(), "dave", false)

	claims := &middleware.Claims{}
	jwt.ParseWithClaims(token, claims, func(_ *jwt.Token) (any, error) { //nolint:errcheck
		return []byte(secret), nil
	})
	if claims.IsAdmin {
		t.Error("expected IsAdmin to be false for non-admin token")
	}
}
