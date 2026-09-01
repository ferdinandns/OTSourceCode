package controllers

import (
	"lab-connect/backend-api/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type AuditController struct {
	auditService *services.AuditService
}

func NewAuditController(auditService *services.AuditService) *AuditController {
	return &AuditController{auditService: auditService}
}

// GetAuditLogs - GET /api/audit/logs
func (c *AuditController) GetAuditLogs(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "20"))

	filter := services.AuditFilter{
		UserID:    ctx.Query("user_id"),
		Action:    ctx.Query("action"),
		TableName: ctx.Query("table_name"),
		DateFrom:  ctx.Query("date_from"),
		DateTo:    ctx.Query("date_to"),
		Search:    ctx.Query("search"),
		Page:      page,
		Limit:     limit,
	}

	result, err := c.auditService.GetAuditLogs(filter)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to fetch audit logs",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Audit logs retrieved successfully",
		"data":    result,
	})
}

// GetDistinctTables - GET /api/audit/tables (for filter dropdown)
func (c *AuditController) GetDistinctTables(ctx *gin.Context) {
	tables, err := c.auditService.GetDistinctTables()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to fetch table list",
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   tables,
	})
}
