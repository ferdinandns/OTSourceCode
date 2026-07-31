package handlers

import (
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/models"
	"migrasi_batch_tracker/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type workOrdersStruct struct {
	*BaseHandler[models.WorkOrders]
}

func NewWorkOrdersHandler(db *gorm.DB) *workOrdersStruct {
	return &workOrdersStruct{
		BaseHandler: NewBaseHandler[models.WorkOrders](db),
	}
}

func (h *workOrdersStruct) RegisterPrivateRoutes(rg *gin.RouterGroup) {
	route := rg.Group("/work-orders")
	{
		route.GET("/", h.GetByDateRange)
		route.POST("/", h.Create)
		route.PUT("/:id", h.Update)
		route.DELETE("/:id", h.Delete)
	}
}

// GetByDateRange mengambil data work orders berdasarkan range tanggal tanggal_wo
func (h *workOrdersStruct) GetByDateRange(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	// Panggil fungsi Service BARU
	resultData, total, err := services.GetWorkOrdersService(h.BaseHandler.db, startDate, endDate)

	if err != nil {
		statusCode := http.StatusInternalServerError
		if err.Error() == "tanggal pencarian hanya boleh dalam rentang sebulan" || err.Error() == "format tanggal tidak valid, gunakan YYYY-MM-DD" {
			statusCode = http.StatusBadRequest
		}

		response := helpers.APIResponse(err.Error(), statusCode, "error", nil)
		c.JSON(statusCode, response)
		return
	}

	// Kembalikan response sukses.
	// resultData adalah struct yang berisi {timestamps: [...], durations: [...]}
	response := helpers.APIResponseList("Berhasil memuat data raw data leadtime", http.StatusOK, "success", total, resultData)
	c.JSON(http.StatusOK, response)
}
