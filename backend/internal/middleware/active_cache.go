package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/crezen/backend/internal/models"
)

type cacheEntry struct {
	isActive  bool
	fetchedAt time.Time
}

type activeCache struct {
	mu      sync.Mutex
	entries map[uuid.UUID]cacheEntry
	ttl     time.Duration
}

var cache = &activeCache{
	entries: make(map[uuid.UUID]cacheEntry),
	ttl:     30 * time.Second,
}

// InvalidateUser removes a user from the is_active cache immediately.
func InvalidateUser(id uuid.UUID) {
	cache.mu.Lock()
	delete(cache.entries, id)
	cache.mu.Unlock()
}

func IsActiveMiddleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := c.Get(ContextUserID)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
			return
		}
		id := userID.(uuid.UUID)

		cache.mu.Lock()
		entry, found := cache.entries[id]
		cache.mu.Unlock()

		if !found || time.Since(entry.fetchedAt) > cache.ttl {
			var user models.User
			if err := db.Select("is_active").Where("id = ?", id).First(&user).Error; err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
				return
			}
			entry = cacheEntry{isActive: user.IsActive, fetchedAt: time.Now()}
			cache.mu.Lock()
			cache.entries[id] = entry
			cache.mu.Unlock()
		}

		if !entry.isActive {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "account inactive"})
			return
		}
		c.Next()
	}
}
