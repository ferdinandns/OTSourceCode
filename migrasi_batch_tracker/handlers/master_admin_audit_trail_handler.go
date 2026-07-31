package handlers

import (
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/models"
	"migrasi_batch_tracker/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type adminAuditTrailStruct struct {
	*BaseHandler[models.AuditTrail]
}

func NewAdminAuditTrailHandler(db *gorm.DB) *adminAuditTrailStruct {
	return &adminAuditTrailStruct{
		BaseHandler: NewBaseHandler[models.AuditTrail](db),
	}
}

func (h *adminAuditTrailStruct) RegisterRoutes(rg *gin.RouterGroup) {
	route := rg.Group("/admin-audit-trail")
	{
		route.GET("/", h.Index)
		route.POST("/", h.Create)
		route.PUT("/:id", h.Update)
		route.DELETE("/:id", h.Delete)
	}
}

func (h *adminAuditTrailStruct) Index(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	records, total, err := services.GetAuditTrailService(h.db, startDate, endDate)

	if err != nil {
		// Menentukan HTTP Status Code berdasarkan jenis error
		statusCode := http.StatusInternalServerError
		if err.Error() == "tanggal pencarian hanya boleh dalam rentang sebulan" || err.Error() == "format tanggal tidak valid, gunakan YYYY-MM-DD" {
			statusCode = http.StatusBadRequest 
		}

		response := helpers.APIResponse(err.Error(), statusCode, "error", nil)
		c.JSON(statusCode, response)
		return
	}

	// Kembalikan response sukses menggunakan APIResponseList (karena ada count 'total')
	response := helpers.APIResponseList("Berhasil memuat data audit trail", http.StatusOK, "success", total, records)
	c.JSON(http.StatusOK, response)
}