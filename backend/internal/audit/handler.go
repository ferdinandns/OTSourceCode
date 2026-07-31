package audit

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	response "emertrack/pkg/response"
	"emertrack/internal/domain"
)

type AuditHandler struct {
	svc domain.AuditService
}

func NewHandlerAudit(s domain.AuditService) *AuditHandler {
	return &AuditHandler{svc: s}
}

func (h *AuditHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	var entityID *uint
	if idStr := c.Query("entity_id"); idStr != "" {
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err == nil {
			tmp := uint(id)
			entityID = &tmp
		}
	}

	result, err := h.svc.List(c.Request.Context(), startDate, endDate, entityID, page, pageSize)
	if err != nil {
		response.InternalError(c.Writer)
		return
	}

	response.Success(c.Writer, result)
}

func (h *AuditHandler) ExportExcel(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	var entityID *uint
	if idStr := c.Query("entity_id"); idStr != "" {
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err == nil {
			tmp := uint(id)
			entityID = &tmp
		}
	}

	file, err := h.svc.ExportExcel(c.Request.Context(), startDate, endDate, entityID)
	if err != nil {
		response.InternalError(c.Writer)
		return
	}

	fileName := "audit_trail_" + time.Now().Format("20060102_150405") + ".xlsx"
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename=\""+fileName+"\"")
	c.Header("Content-Transfer-Encoding", "binary")

	if err := file.Write(c.Writer); err != nil {
		c.Writer.WriteHeader(http.StatusInternalServerError)
	}
}
