package middlewares

import (
	"lab-connect/backend-api/config"
	"lab-connect/backend-api/database"
	"lab-connect/backend-api/models"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var jwtKey = []byte(config.GetEnv("JWT_SECRET", "secret_key"))

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")

		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Token is required",
			})
			c.Abort()
			return
		}

		tokenString = strings.TrimPrefix(tokenString, "Bearer ")

		claims := &jwt.RegisteredClaims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid token",
			})
			c.Abort()
			return
		}

		c.Set("username", claims.Subject)

		var user models.User
		if err := database.DB.Preload("LokasiAktif").Where("username = ?", claims.Subject).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "User not found",
			})
			c.Abort()
			return
		}

		// Store user info in context
		c.Set("userID", user.Id)
		c.Set("userGroup", user.UserGroup) // ← NEW: store group level
		c.Set("userRole", user.Role)
		c.Set("userName", user.Name)

		// Resolve active site
		if user.LokasiAktifId != nil && user.LokasiAktif != nil {
			c.Set("userSite", user.LokasiAktif.Kode)
		} else if user.LokasiUtamaId != nil {
			var lokasi models.Lokasi
			if err := database.DB.First(&lokasi, *user.LokasiUtamaId).Error; err == nil {
				c.Set("userSite", lokasi.Kode)
			}
		}

		c.Next()
	}
}

// ============================================
// CONTEXT HELPERS
// ============================================

func GetUserID(ctx *gin.Context) (uint, bool) {
	userID, exists := ctx.Get("userID")
	if !exists {
		return 0, false
	}
	switch v := userID.(type) {
	case uint:
		return v, true
	case float64:
		return uint(v), true
	case int:
		return uint(v), true
	default:
		return 0, false
	}
}

// GetUserGroup returns the user's group number (1-5)
func GetUserGroup(ctx *gin.Context) (int, bool) {
	group, exists := ctx.Get("userGroup")
	if !exists {
		return 0, false
	}
	switch v := group.(type) {
	case int:
		return v, true
	case float64:
		return int(v), true
	default:
		return 0, false
	}
}

func GetUserRole(ctx *gin.Context) (string, bool) {
	role, exists := ctx.Get("userRole")
	if !exists {
		return "", false
	}
	roleStr, ok := role.(string)
	return roleStr, ok
}

func GetUserSite(ctx *gin.Context) (string, bool) {
	site, exists := ctx.Get("userSite")
	if !exists {
		return "", false
	}
	siteStr, ok := site.(string)
	return siteStr, ok
}

func GetUserName(ctx *gin.Context) (string, bool) {
	name, exists := ctx.Get("userName")
	if !exists {
		return "", false
	}
	nameStr, ok := name.(string)
	return nameStr, ok
}
