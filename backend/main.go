package main

import (
	"log"
	"os"
	"strconv"

	"sample-qc-backend/database"
	"sample-qc-backend/handlers"
	"sample-qc-backend/routes"
	"sample-qc-backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Info: file .env tidak ditemukan, menggunakan environment system")
	}

	accessSecret := mustGetEnv("JWT_ACCESS_SECRET")
	refreshSecret := mustGetEnv("JWT_REFRESH_SECRET")
	utils.AccessTokenSecret = []byte(accessSecret)
	utils.RefreshTokenSecret = []byte(refreshSecret)

	dbConfig := database.Config{
		Host:     getEnv("DB_HOST", "localhost"),
		Port:     getEnvInt("DB_PORT", 5432),
		User:     mustGetEnv("DB_USER"),
		Password: mustGetEnv("DB_PASSWORD"),
		DBName:   mustGetEnv("DB_NAME"),
		SSLMode:  getEnv("DB_SSLMODE", "disable"),
	}

	db, err := database.Connect(dbConfig)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer db.Close()

	handlers.StartAutoCleanup(db)
	router := gin.Default()

	router.Use(func(c *gin.Context) {
		allowedOrigin := getEnv("CORS_ALLOWED_ORIGIN", "http://localhost:5173")
		c.Writer.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	routes.SetupAuthRoutes(router, db)
	routes.SetupUserRoutes(router, db)
	routes.SetupDiversifikasiRMRoutes(router, db)
	routes.SetupMasterItemRoutes(router, db)
	routes.SetupMasterProductRoutes(router, db)
	routes.SetupDiversifikasiPMRoutes(router, db)
	routes.SetupMasterItemPMRoutes(router, db)
	routes.SetupRecycleBinRoutes(router, db)
	routes.SetupActivityLogRoutes(router, db)
	routes.SetupDashboardRoutes(router, db)

	port := getEnv("PORT", "8080")
	log.Printf("Server running on http://localhost:%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func mustGetEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("FATAL: environment variable '%s' wajib diset dan tidak boleh kosong", key)
	}
	return value
}

func getEnvInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		log.Printf("Warning: nilai '%s' untuk env '%s' bukan integer valid, menggunakan default %d", value, key, fallback)
		return fallback
	}
	return parsed
}
