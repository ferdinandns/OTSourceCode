package routes

import (
	"lab-connect/backend-api/controllers"

	"github.com/gin-gonic/gin"
)

func SetupAuditRoutes(r *gin.RouterGroup, auditController *controllers.AuditController) {
	audit := r.Group("/audit")
	{
		audit.GET("/logs", auditController.GetAuditLogs)
		audit.GET("/tables", auditController.GetDistinctTables)
	}
}
