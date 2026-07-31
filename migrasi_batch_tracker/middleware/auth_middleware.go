package middleware

import (
	"fmt"
	"migrasi_batch_tracker/helpers"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// RequireAuth memastikan setiap request yang memerlukan akses privat memiliki token JWT yang valid.
// Arsitektur Keamanan:
// 1. Mengekstrak header 'Authorization' dengan skema 'Bearer'.
// 2. Mem-parsing dan memvalidasi struktur serta signature JWT menggunakan HMAC (secret dari env `JWTSECRET`).
// 3. Mengekstrak claims payload (seperti user_id, level, area) dan menyimpannya di gin.Context (`c.Set`) agar bisa diakses oleh layer Handler dan Service.
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response := helpers.APIResponse("Akses ditolak. Token tidak ada", http.StatusUnauthorized, "error", nil)
			c.AbortWithStatusJSON(http.StatusUnauthorized, response)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			response := helpers.APIResponse("Format token salah. Gunakan Bearer <token>", http.StatusUnauthorized, "error", nil)
			c.AbortWithStatusJSON(http.StatusUnauthorized, response)
			return
		}

		tokenString := parts[1]

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("Metode signing tidak valid: %v", token.Header["alg"])
			}
			return []byte(os.Getenv("JWTSECRET")), nil
		})

		errMsg := "unknown"
		if err != nil {
			errMsg = err.Error()
		}

		if err != nil || !token.Valid {
			response := helpers.APIResponse("Token tidak valid/ kadaluarsa, error: "+errMsg, http.StatusUnauthorized, "error", nil)
			c.AbortWithStatusJSON(http.StatusUnauthorized, response)
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("user_id", claims["user_id"])
			c.Set("username", claims["username"])
			c.Set("nama", claims["nama"])
			c.Set("level", claims["level"])
			c.Set("area", claims["area"])
			c.Set("detail_area", claims["detail_area"])
		} else {
			response := helpers.APIResponse("Gagal membaca isi token", http.StatusUnauthorized, "error", nil)
			c.AbortWithStatusJSON(http.StatusUnauthorized, response)
			return
		}
		c.Next()
	}
}
