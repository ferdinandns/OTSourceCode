package handlers

import (
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/models"
	"migrasi_batch_tracker/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// BatchReasonHandler menangani CRUD alasan batch yang dipakai dalam proses tracking dan report.
type BatchReasonHandler struct {
	reasonService *services.BatchReasonService
}

// NewBatchReasonHandler membuat handler dengan dependency service batch reason.
func NewBatchReasonHandler(s *services.BatchReasonService) *BatchReasonHandler {
	return &BatchReasonHandler{reasonService: s}
}

// Create menyimpan data alasan batch baru dari input frontend.
func (h *BatchReasonHandler) Create(c *gin.Context) {
	var req models.BatchReasons
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, helpers.APIResponse("Data tidak valid", http.StatusBadRequest, "error", nil))
		return
	}

	if err := h.reasonService.CreateReason(&req); err != nil {
		c.JSON(http.StatusInternalServerError, helpers.APIResponse("Gagal menyimpan reason", http.StatusInternalServerError, "error", nil))
		return
	}

	c.JSON(http.StatusCreated, helpers.APIResponse("Reason berhasil disimpan", http.StatusCreated, "success", req))
}

func (h *BatchReasonHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, helpers.APIResponse("ID tidak valid", http.StatusBadRequest, "error", nil))
		return
	}

	var updateData map[string]interface{}
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, helpers.APIResponse("Data update tidak valid", http.StatusBadRequest, "error", nil))
		return
	}

	updatedRecord, err := h.reasonService.UpdateReason(id, updateData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, helpers.APIResponse("Gagal update reason", http.StatusInternalServerError, "error", nil))
		return
	}

	c.JSON(http.StatusOK, helpers.APIResponse("Reason berhasil diupdate", http.StatusOK, "success", updatedRecord))
}

func (h *BatchReasonHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, helpers.APIResponse("ID tidak valid", http.StatusBadRequest, "error", nil))
		return
	}

	if err := h.reasonService.DeleteReason(id); err != nil {
		c.JSON(http.StatusInternalServerError, helpers.APIResponse("Gagal menghapus reason", http.StatusInternalServerError, "error", nil))
		return
	}

	c.JSON(http.StatusOK, helpers.APIResponse("Reason berhasil dihapus", http.StatusOK, "success", nil))
}

func (h *BatchReasonHandler) RegisterRoutes(router *gin.RouterGroup) {
	router.POST("/batch-reason", h.Create)
	router.PUT("/batch-reason/:id", h.Update)
	router.DELETE("/batch-reason/:id", h.Delete)
}
