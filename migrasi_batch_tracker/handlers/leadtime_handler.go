package handlers

import (
	"migrasi_batch_tracker/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// LeadtimeSummaryHandler menangani endpoint yang menampilkan ringkasan leadtime.
type LeadtimeSummaryHandler struct {
	service *services.LeadtimeService
}

func NewLeadtimeSummaryHandler(db *gorm.DB) *LeadtimeSummaryHandler {
	svc := services.NewLeadtimeService(db)
	return &LeadtimeSummaryHandler{service: svc}
}

func (h *LeadtimeSummaryHandler) RegisterRoutes(r *gin.RouterGroup) {
	r.GET("/leadtime-summary", h.GetLeadtimeSummary)
}

// GetLeadtimeSummary mengirim data leadtime yang sudah di-cache ke frontend.
func (h *LeadtimeSummaryHandler) GetLeadtimeSummary(c *gin.Context) {
	data := h.service.GetSummaryData()

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    data,
	})
}
