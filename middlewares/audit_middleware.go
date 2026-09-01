package middlewares

import (
	"fmt"
	"lab-connect/backend-api/services"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuditMiddleware logs SELECT (GET) requests via Gin middleware.
// INSERT/UPDATE/DELETE are handled by GORM hooks in each service.
func AuditMiddleware(auditService *services.AuditService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		method := ctx.Request.Method

		// Only intercept mutating requests
		if method == "GET" || method == "OPTIONS" {
			ctx.Next()
			return
		}

		ctx.Next() // let request complete first

		// After request completes, log it
		userID, _ := GetUserID(ctx)
		username, _ := GetUserName(ctx)
		path := ctx.Request.URL.Path

		action := map[string]string{
			"POST":   "INSERT",
			"PUT":    "UPDATE",
			"PATCH":  "UPDATE",
			"DELETE": "DELETE",
		}[method]

		var userIDPtr *uint
		if userID > 0 {
			uid := userID
			userIDPtr = &uid
		}

		auditService.LogAsync(services.AuditEntry{
			UserID:      userIDPtr,
			Username:    username,
			Action:      action,
			TargetTable: inferTableFromPath(path),
			RecordID:    inferRecordIDFromPath(path),
			Endpoint:    fmt.Sprintf("%s %s", method, path),
			IPAddress:   ctx.ClientIP(),
		})
	}
}

// inferTableFromPath tries to determine which table a GET request targets
func inferTableFromPath(path string) string {
	segments := strings.Split(strings.Trim(path, "/"), "/")
	// /api/instruments/... → instruments
	// /api/products/... → products
	if len(segments) >= 2 {
		return segments[1] // e.g. "instruments", "products", "users"
	}
	return "unknown"
}

// inferRecordIDFromPath tries to extract a record ID from the path
func inferRecordIDFromPath(path string) string {
	segments := strings.Split(strings.Trim(path, "/"), "/")
	// /api/instruments/42 → "42"
	// /api/instruments/usage/257/after-reading → "257"
	for i := len(segments) - 1; i >= 0; i-- {
		seg := segments[i]
		if seg == "" {
			continue
		}
		// If it looks numeric, it's likely an ID
		isNumeric := true
		for _, c := range seg {
			if c < '0' || c > '9' {
				isNumeric = false
				break
			}
		}
		if isNumeric {
			return seg
		}
	}
	return ""
}
