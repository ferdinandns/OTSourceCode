package middleware

import (
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AccessLevel merupakan middleware Role-Based Access Control (RBAC).
// Memeriksa level user (diambil dari JWT context) agar hanya role tertentu yang boleh mengakses endpoint.
// Jika level user adalah "administrator", bypass akan selalu diizinkan.
func AccessLevel(allowedLevels ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userLevel := c.MustGet("level").(string)

		if userLevel == "administrator" {
			c.Next()
			return
		}

		isAllowed := false
		for _, role := range allowedLevels {
			if userLevel == role {
				isAllowed = true
				break
			}
		}

		if !isAllowed {
			response := helpers.APIResponse("Akses ditolak! Level anda tidak diizinkan.", http.StatusForbidden, "error", nil)
			c.AbortWithStatusJSON(http.StatusForbidden, response)
			return
		}

		c.Next()
	}
}

// AccessArea membatasi akses berdasarkan area kerja user, misalnya PPIC, QA, atau Administrator.
func AccessArea(allowedAreas ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userArea := c.MustGet("area").(string)

		if userArea == "Administrator" {
			c.Next()
			return
		}

		isAllowed := false
		for _, role := range allowedAreas {
			if userArea == role {
				isAllowed = true
				break
			}
		}

		if !isAllowed {
			response := helpers.APIResponse("Akses ditolak! Area anda tidak diizinkan.", http.StatusForbidden, "error", nil)
			c.AbortWithStatusJSON(http.StatusForbidden, response)
			return
		}

		c.Next()
	}
}

// AccessDetailArea memeriksa hak akses detail area user terhadap data yang lebih spesifik.
func AccessDetailArea(db *gorm.DB, accessDetailArea ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Assert the interface from Gin context to a float64
		userIDFloat := c.MustGet("user_id").(float64)

		// 2. Explicitly cast the float64 into an int
		userID := int(userIDFloat)

		userArea := c.MustGet("area").(string)

		userLevelRaw, exists := c.Get("level")
		if exists {
			userLevel := userLevelRaw.(string)
			if userLevel == "administrator" || userArea == "Administrator" {
				c.Next() // Bypass berhasil, keluar dari middleware dan lanjut ke handler
				return
			}
		}

		// Now userID is a standard integer, which DetailAreaService expects
		if services.DetailAreaService(db, userID, userArea, accessDetailArea...) {
			c.Next()
			return
		}

		response := helpers.APIResponse("Akses ditolak!", http.StatusForbidden, "error", nil)
		c.JSON(http.StatusForbidden, response)
		c.Abort()
	}
}
