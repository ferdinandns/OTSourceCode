package report

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"emertrack/internal/domain"
	"emertrack/pkg/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc domain.ReportService
}

func NewHandler(svc domain.ReportService) *Handler {
	return &Handler{svc: svc}
}

// GetReport returns the inspection report based on optional filters.
func (h *Handler) GetReport(c *gin.Context) {
	deptID := c.Query("department_id")
	status := c.Query("status")
	scheduleStatus := c.Query("schedule_status")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	data, err := h.svc.GetSarprasReport(c.Request.Context(), deptID, status, scheduleStatus, startDate, endDate)
	if err != nil {
		log.Printf("Error GetSarprasReport: %v", err)
		response.Error(c.Writer, http.StatusInternalServerError, "Gagal memuat report pemeriksaan")
		return
	}

	response.Success(c.Writer, data)
}

// ExportReport generates and downloads an Excel file containing the report data.
func (h *Handler) ExportReport(c *gin.Context) {
	deptID := c.Query("department_id")
	status := c.Query("status")
	scheduleStatus := c.Query("schedule_status")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	userName := c.GetString("full_name")

	file, err := h.svc.ExportExcel(c.Request.Context(), deptID, status, scheduleStatus, startDate, endDate, userName)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, "Gagal membuat file excel")
		return
	}

	filename := fmt.Sprintf("Report_Pemeriksaan_%s.xlsx", time.Now().Format("20060102"))
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	if err := file.Write(c.Writer); err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, "Gagal mengirim file excel")
	}
}
