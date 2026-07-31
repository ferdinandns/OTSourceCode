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

type productHandler struct {
	*BaseHandler[models.Product]
}

func NewProductHandler(db *gorm.DB) *productHandler {
	return &productHandler{
		BaseHandler: NewBaseHandler[models.Product](db),
	}
}

func (h *productHandler) GetProductDataHandler(c *gin.Context) {
	// Panggil service yang mengembalikan 2 data sekaligus
	produks, tanks, err := services.GetCompoundingDataService(h.db)

	if err != nil {
		response := helpers.APIResponse("Gagal memuat data compounding machine", http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	// Gabungkan data sesuai kebutuhan frontend NextJS
	data := map[string]any{
		"produk": produks,
		"tanks":  tanks,
	}

	response := helpers.APIResponse("Berhasil memuat data compounding machine", http.StatusOK, "success", data)
	c.JSON(http.StatusOK, response)
}

// SyncMixingTanksHandler mengelola update data checkbox jembatan produk & mesin
func (h *productHandler) SyncMixingTanksHandler(c *gin.Context) {
	idTarget, _ := strconv.Atoi(c.Param("id"))
	alamatIp := c.ClientIP()

	var req models.SyncTankRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Format input tidak valid: "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	err := services.SyncMixingTanksService(h.db, uint(idTarget), req, alamatIp)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err.Error() == "Username atau password salah." || err.Error() == "Data produk tidak ditemukan." {
			statusCode = http.StatusBadRequest
		}
		response := helpers.APIResponse(err.Error(), statusCode, "error", nil)
		c.JSON(statusCode, response)
		return
	}

	response := helpers.APIResponse("Mixing tank produk berhasil diupdate!", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

// UpdateAutoRilisHandler mengelola pengubahan status Auto Rilis produksi
func (h *productHandler) UpdateAutoRilisHandler(c *gin.Context) {
	idTarget, _ := strconv.Atoi(c.Param("id"))
	alamatIp := c.ClientIP()

	var req models.UpdateAutoRilisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Format input tidak valid: "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	err := services.UpdateAutoRilisService(h.db, uint(idTarget), req, alamatIp)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err.Error() == "Username atau password salah." || err.Error() == "Data produk tidak ditemukan." {
			statusCode = http.StatusBadRequest
		}
		response := helpers.APIResponse(err.Error(), statusCode, "error", nil)
		c.JSON(statusCode, response)
		return
	}

	response := helpers.APIResponse("Auto Rilis berhasil diperbarui.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

// UpdateStatusHandler mengelola pengubahan status Listing/Delisting produk
func (h *productHandler) UpdateStatusHandler(c *gin.Context) {
	idTarget, _ := strconv.Atoi(c.Param("id"))
	alamatIp := c.ClientIP()

	var req models.UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Format input tidak valid: "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	err := services.UpdateStatusService(h.db, uint(idTarget), req, alamatIp)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err.Error() == "Username atau password salah." || err.Error() == "Data produk tidak ditemukan." {
			statusCode = http.StatusBadRequest
		}
		response := helpers.APIResponse(err.Error(), statusCode, "error", nil)
		c.JSON(statusCode, response)
		return
	}

	response := helpers.APIResponse("Status produk berhasil diperbarui.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *productHandler) RegisterRoutes(rg *gin.RouterGroup) {
	route := rg.Group("/produk")
	{
		route.GET("/", h.GetProductDataHandler)
		route.POST("/", h.Create)
		route.PUT("/sync-tank/:id", h.SyncMixingTanksHandler)
		route.PUT("/auto-rilis/:id", h.UpdateAutoRilisHandler)
		route.PUT("/status/:id", h.UpdateStatusHandler)
		route.DELETE("/:id", h.Delete)
	}
}
