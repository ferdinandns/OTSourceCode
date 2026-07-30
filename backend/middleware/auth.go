package middleware

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"sample-qc-backend/utils"

	"github.com/gin-gonic/gin"
)

const IdleTimeout = 24 * time.Hour

func AuthMiddleware(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Token tidak ditemukan",
				"code":  "TOKEN_MISSING",
			})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		claims, err := utils.ParseAccessToken(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Token expired atau tidak valid",
				"code":  "TOKEN_EXPIRED",
			})
			return
		}

		var lastActivity sql.NullTime
		err = db.QueryRow(
			`SELECT last_activity FROM users WHERE id = $1`,
			claims.UserID,
		).Scan(&lastActivity)

		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "Gagal memverifikasi sesi",
			})
			return
		}

		if lastActivity.Valid && time.Since(lastActivity.Time) > IdleTimeout {
			_, _ = db.Exec(
				`UPDATE users SET refresh_token = NULL, refresh_token_expiry = NULL WHERE id = $1`,
				claims.UserID,
			)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Sesi habis karena tidak aktif selama 24 jam",
				"code":  "IDLE_TIMEOUT",
			})
			return
		}

		_, _ = db.Exec(
			`UPDATE users SET last_activity = NOW() WHERE id = $1`,
			claims.UserID,
		)

		c.Set("userID", claims.UserID)
		c.Set("userName", claims.Name)
		c.Set("userDivision", claims.Division)

		c.Next()
	}
}
