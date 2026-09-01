package middlewares

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ============================================
// ROLE-BASED MIDDLEWARE
// ============================================

// RoleMiddleware checks if the user's role is in the allowed roles list
func RoleMiddleware(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := GetUserRole(c)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"status":  "error",
				"message": "User role not found",
			})
			c.Abort()
			return
		}

		isAllowed := false
		for _, role := range allowedRoles {
			if userRole == role {
				isAllowed = true
				break
			}
		}

		if !isAllowed {
			c.JSON(http.StatusForbidden, gin.H{
				"status":  "error",
				"message": "You don't have permission to access this resource",
				"details": "Required role: " + joinRoles(allowedRoles),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// ============================================
// GROUP-BASED MIDDLEWARE (RECOMMENDED)
// ============================================

// GroupMiddleware allows access if user's group number <= maxGroup
// Lower group number = higher privilege (1 = Superadmin, 5 = User)
// GroupMiddleware(3) allows groups 1, 2, and 3
func GroupMiddleware(maxGroup int) gin.HandlerFunc {
	return func(c *gin.Context) {
		userGroup, exists := GetUserGroup(c)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"status":  "error",
				"message": "User group not found",
			})
			c.Abort()
			return
		}

		if userGroup > maxGroup {
			c.JSON(http.StatusForbidden, gin.H{
				"status":  "error",
				"message": "You don't have permission to access this resource",
				"details": "Minimum required group level: " + groupName(maxGroup),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// SuperadminOnly - Only Group 1
func SuperadminOnly() gin.HandlerFunc {
	return GroupMiddleware(1)
}

// ManagerAndAbove - Group 1 and 2
func ManagerAndAbove() gin.HandlerFunc {
	return GroupMiddleware(2)
}

// SupervisorAndAbove - Group 1, 2, and 3
func SupervisorAndAbove() gin.HandlerFunc {
	return GroupMiddleware(3)
}

// AnalystAndAbove - Group 1, 2, 3, and 4
func AnalystAndAbove() gin.HandlerFunc {
	return GroupMiddleware(4)
}

// AllAuthenticated - Any authenticated user (Group 1-5)
func AllAuthenticated() gin.HandlerFunc {
	return GroupMiddleware(5)
}

// CanWrite - Users who can add/edit data (Group 1-4, excludes read-only Group 5)
func CanWrite() gin.HandlerFunc {
	return GroupMiddleware(4)
}

// CanDelete - Only Superadmin and Administrator can delete
func CanDelete() gin.HandlerFunc {
	return GroupMiddleware(2)
}

// ============================================
// PERMISSION HELPERS (use in controllers)
// ============================================

// HasMinGroup returns true if user's group is at or above the required level
func HasMinGroup(c *gin.Context, minGroup int) bool {
	userGroup, exists := GetUserGroup(c)
	if !exists {
		return false
	}
	return userGroup <= minGroup
}

// IsSuperadmin returns true if user is in group 1
func IsSuperadmin(c *gin.Context) bool {
	return HasMinGroup(c, 1)
}

// IsManagerOrAbove returns true if user is in group 1 or 2
func IsManagerOrAbove(c *gin.Context) bool {
	return HasMinGroup(c, 2)
}

// IsSupervisorOrAbove returns true if user is in group 1, 2, or 3
func IsSupervisorOrAbove(c *gin.Context) bool {
	return HasMinGroup(c, 3)
}

// IsAnalystOrAbove returns true if user is in group 1, 2, 3, or 4
func IsAnalystOrAbove(c *gin.Context) bool {
	return HasMinGroup(c, 4)
}

// CanEditData returns true if user can add/edit (groups 1-4)
func CanEditData(c *gin.Context) bool {
	return HasMinGroup(c, 4)
}

// IsReadOnly returns true if user is group 5 (read-only)
func IsReadOnly(c *gin.Context) bool {
	group, exists := GetUserGroup(c)
	if !exists {
		return true
	}
	return group == 5
}

// ============================================
// SITE ACCESS HELPER
// ============================================

// CanAccessSite checks if user can access a given site (PLG or CKR)
// Superadmin (group 1) can access all sites
// Others can only access their own site
func CanAccessSite(c *gin.Context, targetSite string) bool {
	userGroup, _ := GetUserGroup(c)
	if userGroup == 1 {
		return true // Superadmin accesses all sites
	}

	userSite, exists := GetUserSite(c)
	if !exists {
		return false
	}

	return strings.EqualFold(userSite, targetSite)
}

// ============================================
// HELPERS
// ============================================

func groupName(group int) string {
	switch group {
	case 1:
		return "Superadmin"
	case 2:
		return "Manager"
	case 3:
		return "Supervisor"
	case 4:
		return "Analyst/Staff"
	case 5:
		return "User (Read-only)"
	default:
		return "Unknown"
	}
}

func joinRoles(roles []string) string {
	if len(roles) == 0 {
		return ""
	}
	if len(roles) == 1 {
		return roles[0]
	}
	result := roles[0]
	for i := 1; i < len(roles); i++ {
		result += " or " + roles[i]
	}
	return result
}
