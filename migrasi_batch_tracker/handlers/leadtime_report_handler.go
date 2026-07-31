package handlers

import (
	"migrasi_batch_tracker/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ReportHandler menangani endpoint laporan batch, produk, dan group.
type ReportHandler struct {
	ReportService *services.ReportService
}

func NewReportHandler(s *services.ReportService) *ReportHandler {
	return &ReportHandler{ReportService: s}
}

// GetBatchReport mengembalikan data laporan berdasarkan filter batch.
func (h *ReportHandler) GetBatchReport(c *gin.Context) {
	var req services.ReportFilterRequest

	// Bind query parameter URL ke dalam struct
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Parameter tidak valid",
			"error":   err.Error(),
		})
		return
	}

	// Panggil service
	data, err := h.ReportService.GetBatchReportData(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil data laporan batch",
		})
		return
	}

	// Kembalikan respons sukses
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   data,
		"count":  len(data),
	})
}

// GetProductReport mengembalikan laporan data leadtime per produk.
func (h *ReportHandler) GetProductReport(c *gin.Context) {
	var req services.ReportFilterRequest

	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Parameter tidak valid",
		})
		return
	}

	data, err := h.ReportService.GetProductReportData(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil data laporan produk",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   data,
		"count":  len(data),
	})
}

// GetGroupReport mengembalikan laporan leadtime yang dikelompokkan menurut kriteria tertentu.
func (h *ReportHandler) GetGroupReport(c *gin.Context) {
	var req services.ReportFilterRequest

	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Parameter tidak valid",
		})
		return
	}

	data, err := h.ReportService.GetGroupReportData(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Gagal mengambil data laporan group",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   data,
		"count":  len(data),
	})
}

func (h *ReportHandler) RegisterRoutes(router *gin.RouterGroup) {
	router.GET("/batch", h.GetBatchReport)
	router.GET("/product", h.GetProductReport)
	router.GET("/group", h.GetGroupReport)
}
