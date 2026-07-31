package middleware

import (
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// SetupCORS mengatur kebijakan CORS agar frontend bisa mengakses API dari origin yang diizinkan.
func SetupCORS() gin.HandlerFunc {
	// Ambil string dari .env, default ke ["*"] jika kosong
	originsEnv := os.Getenv("ALLOWED_ORIGINS")
	var allowOrigins []string

	if originsEnv == "" {
		allowOrigins = []string{"*"}
	} else {
		allowOrigins = strings.Split(originsEnv, ",")
	}

	return cors.New(cors.Config{
		AllowOrigins:     allowOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
		MaxAge:           1 * time.Hour,
	})
}
