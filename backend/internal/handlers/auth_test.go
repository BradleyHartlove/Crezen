package handlers

import (
	"testing"
)

func TestHashTokenDeterministic(t *testing.T) {
	h1 := hashToken("abc123")
	h2 := hashToken("abc123")
	if h1 != h2 {
		t.Fatal("hashToken is not deterministic")
	}
}

func TestHashTokenLength(t *testing.T) {
	h := hashToken("anything")
	if len(h) != 64 {
		t.Fatalf("expected 64-char hex output, got %d", len(h))
	}
}

func TestHashTokenDistinct(t *testing.T) {
	if hashToken("a") == hashToken("b") {
		t.Fatal("distinct inputs must produce distinct hashes")
	}
}

func TestHashTokenDiffersFromInput(t *testing.T) {
	raw := "mysecrettoken"
	if hashToken(raw) == raw {
		t.Fatal("hashToken output must differ from input")
	}
}

func TestGenerateRefreshTokenIsValid(t *testing.T) {
	raw, hashed, err := generateRefreshToken()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if raw == "" || hashed == "" {
		t.Fatal("raw and hashed tokens must be non-empty")
	}
	if raw == hashed {
		t.Fatal("raw and hashed tokens must differ")
	}
}

func TestGenerateRefreshTokenHashConsistent(t *testing.T) {
	raw, hashed, err := generateRefreshToken()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if hashed != hashToken(raw) {
		t.Fatal("hashed token does not match hashToken(raw)")
	}
}

func TestGenerateRefreshTokenUnique(t *testing.T) {
	raw1, _, _ := generateRefreshToken()
	raw2, _, _ := generateRefreshToken()
	if raw1 == raw2 {
		t.Fatal("successive tokens must be unique")
	}
}

func TestTimingSafeEqualEqual(t *testing.T) {
	a := []byte("hello world")
	if !timingSafeEqual(a, a) {
		t.Fatal("identical slices must be equal")
	}
}

func TestTimingSafeEqualNotEqual(t *testing.T) {
	if timingSafeEqual([]byte("hello"), []byte("world")) {
		t.Fatal("different content must not be equal")
	}
}

func TestTimingSafeEqualDifferentLength(t *testing.T) {
	if timingSafeEqual([]byte("short"), []byte("longer")) {
		t.Fatal("different-length slices must not be equal")
	}
}
