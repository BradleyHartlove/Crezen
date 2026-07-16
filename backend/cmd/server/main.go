package main

import (
	"log"

	"github.com/crezen/backend/internal/config"
	"github.com/crezen/backend/internal/db"
	"github.com/crezen/backend/internal/router"
)

func main() {
	cfg := config.Load()

	if err := db.RunMigrations(cfg.DatabaseURL); err != nil {
		log.Fatalf("migrations failed: %v", err)
	}

	gormDB, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect failed: %v", err)
	}

	r := router.New(gormDB, cfg.JWTSecret, cfg.CORSOrigin)
	log.Printf("crezen backend listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
