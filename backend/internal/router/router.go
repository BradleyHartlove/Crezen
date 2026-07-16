package router

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/crezen/backend/internal/handlers"
	"github.com/crezen/backend/internal/middleware"
)

func New(db *gorm.DB, jwtSecret, corsOrigin string) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{corsOrigin},
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	authH := &handlers.AuthHandler{DB: db, JWTSecret: jwtSecret}
	vaultH := &handlers.VaultHandler{DB: db, JWTSecret: jwtSecret}
	usersH := &handlers.UsersHandler{DB: db}
	nsH := &handlers.NamespacesHandler{DB: db}
	credH := &handlers.CredentialsHandler{DB: db}
	auditH := &handlers.AuditHandler{DB: db}

	v1 := r.Group("/api/v1")

	// public
	authRL := middleware.RateLimitMiddleware(10.0/60, 5)
	auth := v1.Group("/auth")
	auth.GET("/status", authH.Status)
	auth.POST("/setup", authRL, authH.Setup)
	auth.POST("/register", authRL, authH.Register)
	auth.POST("/login", authRL, authH.Login)
	auth.POST("/refresh", authH.Refresh)

	// protected base
	authMW := middleware.AuthMiddleware(jwtSecret)
	activeMW := middleware.IsActiveMiddleware(db)
	protected := v1.Group("/")
	protected.Use(authMW, activeMW)

	protected.POST("/auth/logout", authH.Logout)

	protected.GET("/vault/config", vaultH.GetConfig)
	protected.POST("/vault/verify-mvk", vaultH.VerifyMVK)

	protected.GET("/namespaces", nsH.List)
	protected.GET("/credentials", credH.List)
	protected.GET("/credentials/:id", credH.Get)
	protected.POST("/credentials", credH.Create)
	protected.PATCH("/credentials/:id", credH.Update)
	protected.DELETE("/credentials/:id", credH.Delete)
	protected.GET("/audit", auditH.List)

	protected.GET("/users/:id", usersH.Get)
	protected.PATCH("/users/:id/password", usersH.ResetPassword)
	protected.DELETE("/users/:id", usersH.Delete)

	// admin-only
	adminMW := middleware.AdminMiddleware()
	admin := protected.Group("/")
	admin.Use(adminMW)

	admin.POST("/vault/rotate", vaultH.Rotate)
	admin.GET("/users", usersH.List)
	admin.PATCH("/users/:id/activate", usersH.Activate)
	admin.PATCH("/users/:id/role", usersH.SetRole)
	admin.POST("/namespaces", nsH.Create)
	admin.PATCH("/namespaces/:id", nsH.Update)
	admin.DELETE("/namespaces/:id", nsH.Delete)

	return r
}
