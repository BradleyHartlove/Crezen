package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

type ipLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type rateLimiterStore struct {
	mu       sync.Mutex
	limiters map[string]*ipLimiter
	r        rate.Limit
	b        int
}

func newStore(r rate.Limit, b int) *rateLimiterStore {
	s := &rateLimiterStore{
		limiters: make(map[string]*ipLimiter),
		r:        r,
		b:        b,
	}
	go s.cleanup()
	return s
}

func (s *rateLimiterStore) get(ip string) *rate.Limiter {
	s.mu.Lock()
	defer s.mu.Unlock()
	if il, ok := s.limiters[ip]; ok {
		il.lastSeen = time.Now()
		return il.limiter
	}
	l := rate.NewLimiter(s.r, s.b)
	s.limiters[ip] = &ipLimiter{limiter: l, lastSeen: time.Now()}
	return l
}

func (s *rateLimiterStore) cleanup() {
	for range time.Tick(5 * time.Minute) {
		s.mu.Lock()
		for ip, il := range s.limiters {
			if time.Since(il.lastSeen) > 10*time.Minute {
				delete(s.limiters, ip)
			}
		}
		s.mu.Unlock()
	}
}

// RateLimitMiddleware limits to `rps` requests per second with a burst of `burst`.
func RateLimitMiddleware(rps float64, burst int) gin.HandlerFunc {
	store := newStore(rate.Limit(rps), burst)
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !store.get(ip).Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many requests"})
			return
		}
		c.Next()
	}
}
