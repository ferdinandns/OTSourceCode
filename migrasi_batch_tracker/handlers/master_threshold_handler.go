package handlers

import (
	"migrasi_batch_tracker/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type thresholdsStruct struct {
	*BaseHandler[models.Thresholds]
}

func NewThresholdsHandler(db *gorm.DB) *thresholdsStruct {
	return &thresholdsStruct{
		BaseHandler: NewBaseHandler[models.Thresholds](db),
	}
}

func (h *thresholdsStruct) RegisterRoutes(rg *gin.RouterGroup) {
	route:= rg.Group("/thresholds")
	{
		route.GET("", h.Index)
		route.POST("", h.Create)
		route.DELETE("/:id", h.Delete)
	}
}