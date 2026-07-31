package handlers

import (
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/models"
	"migrasi_batch_tracker/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ThresholdsHandler struct {
	db *gorm.DB
}

func NewThresholdsHandlerEdit(db *gorm.DB) *ThresholdsHandler {
	return &ThresholdsHandler{
		db: db,
	}
}

func (h *ThresholdsHandler) EditThresholds(c *gin.Context) {
	// 1. Tangkap ID dari parameter URL dan ubah ke tipe int
	id, errId := strconv.Atoi(c.Param("id"))
	if errId != nil {
		response := helpers.APIResponse("ID tidak valid", http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	var req models.EditThresholdsRequest

	// Validasi request body
	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Data tidak valid" + err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	// 2. Call service, sertakan variabel `id` sebagai parameter tambahan
	if err := services.EditThresholdsService(h.db, id, req, c.ClientIP()); err != nil {
		response := helpers.APIResponse(err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Berhasil memperbarui threshold", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *ThresholdsHandler) RegisterRoutes(rg *gin.RouterGroup) {
	route := rg.Group("/thresholds")
	{
		route.PUT("/:id", h.EditThresholds)
	}
}
