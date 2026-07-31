package handlers

import (
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/models"
	"migrasi_batch_tracker/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ProductAlertHandler struct {
	db *gorm.DB
}

func NewProductAlertHandler(db *gorm.DB) *ProductAlertHandler {
	return &ProductAlertHandler{db: db}
}

func (h *ProductAlertHandler) Index(c *gin.Context) {
	records, err := services.GetProductAlertsService(h.db)
	if err != nil {
		response := helpers.APIResponse("Gagal mengambil data alert produk: " + err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	// Gunakan APIResponse biasa atau APIResponseList kalau kamu buat format khusus untuk array
	response := helpers.APIResponse("Berhasil mengambil data alert produk", http.StatusOK, "success", records)
	c.JSON(http.StatusOK, response)
}

func (h *ProductAlertHandler) Update(c *gin.Context) {
	var req models.EditAlertRequest

	// Validasi input JSON
	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Data tidak valid: " + err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	// Panggil Service
	if err := services.EditAlertService(h.db, req); err != nil {
		// Menggunakan StatusForbidden (403) jika errornya terkait otorisasi/field
		statusCode := http.StatusInternalServerError
		if err.Error() == "Username atau password salah" || err.Error() == "Field threshold tidak valid atau tidak diizinkan" {
			statusCode = http.StatusForbidden
		}

		response := helpers.APIResponse(err.Error(), statusCode, "error", nil)
		c.JSON(statusCode, response)
		return
	}

	response := helpers.APIResponse("Threshold grup berhasil diperbarui", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

// Tambahkan ke router utama
func (h *ProductAlertHandler) RegisterRoutes(rg *gin.RouterGroup) {
	route := rg.Group("/product-alerts")
	{
		route.GET("/", h.Index) 
		route.PUT("/group", h.Update) 
	}
}