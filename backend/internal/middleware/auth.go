package middleware

import (
	"emertrack/internal/domain"
	"emertrack/pkg/jwt"
	"emertrack/pkg/response"

	"github.com/gin-gonic/gin"
)

func RequireAuth(jwtMgr *jwt.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, err := c.Cookie("access_token")
		if err != nil || tokenString == "" {
			response.Unauthorized(c.Writer)
			c.Abort()
			return
		}

		// Decode JWT Claims
		claims, err := jwtMgr.Validate(tokenString)
		if err != nil {
			response.Unauthorized(c.Writer)
			c.Abort()
			return
		}

		var userRoles []domain.Role
		for _, r := range claims.Roles {
			userRoles = append(userRoles, domain.Role(r))
		}

		// Set semua data kritikal ke dalam Context
		c.Set("user_id", claims.UserID)
		c.Set("user_roles", userRoles)
		c.Set("is_supervisor", claims.IsSupervisor)
		c.Set("department_name", claims.DepartmetName)
		c.Set("full_name", claims.FullName)

		c.Next()
	}
}

// ClaimsData holds extracted JWT claims for handler use
type ClaimsData struct {
	UserID         uint
	Roles          []string
	IsSupervisor   bool
	FullName       string
	DepartmentName string
}

// GetClaims extracts claims stored by RequireAuth middleware
func GetClaims(c *gin.Context) (ClaimsData, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return ClaimsData{}, false
	}
	roles, _ := c.Get("user_roles")
	isSup, _ := c.Get("is_supervisor")
	fullName, _ := c.Get("full_name")
	deptName, _ := c.Get("department_name")

	var roleStrs []string
	if domainRoles, ok := roles.([]domain.Role); ok {
		for _, r := range domainRoles {
			roleStrs = append(roleStrs, string(r))
		}
	}

	nameStr := ""
	if n, ok := fullName.(string); ok {
		nameStr = n
	}

	deptStr := ""
	if d, ok := deptName.(string); ok {
		deptStr = d
	}

	return ClaimsData{
		UserID:         userID.(uint),
		Roles:          roleStrs,
		IsSupervisor:   isSup.(bool),
		FullName:       nameStr,
		DepartmentName: deptStr,
	}, true
}

func RequireChangePassword(userSvc domain.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Dapatkan User ID dari Context (sudah di-set oleh RequireAuth)
		userIDRaw, exists := c.Get("user_id")
		if !exists {
			response.Unauthorized(c.Writer)
			c.Abort()
			return
		}

		userID := userIDRaw.(uint)

		// Ambil data user dari database untuk cek status MustChangePassword terbaru
		user, err := userSvc.GetUser(c.Request.Context(), userID)
		if err != nil {
			response.Unauthorized(c.Writer)
			c.Abort()
			return
		}

		// Jika user wajib ganti password, blokir akses dengan status 403 Forbidden
		if user.MustChangePassword {
			response.Error(c.Writer, 403, "Anda wajib mengganti password terlebih dahulu")
			c.Abort()
			return
		}

		// Lanjutkan ke handler berikutnya jika aman
		c.Next()
	}
}
