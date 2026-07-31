package middleware

import (
	"emertrack/internal/domain"
	"emertrack/pkg/response"

	"github.com/gin-gonic/gin"
)

func RequirePermission(requiredPerm domain.Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		rolesRaw, existsRoles := c.Get("user_roles")
		spvRaw, existsSpv := c.Get("is_supervisor")

		if !existsRoles || !existsSpv {
			response.Forbidden(c.Writer)
			c.Abort()
			return
		}

		userRoles := rolesRaw.([]domain.Role)
		isSupervisor := spvRaw.(bool)

		effectivePerms := domain.GetEffectivePermissions(userRoles, isSupervisor)

		hasAccess := false
		for _, perm := range effectivePerms {
			if perm == requiredPerm {
				hasAccess = true
				break
			}
		}

		if !hasAccess {
			response.Forbidden(c.Writer)
			c.Abort()
			return
		}

		c.Next()
	}
}
