package handlers

import (
	"migrasi_batch_tracker/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type labelBiruStruct struct {
	*BaseHandler[models.LabelBiru]
}

func NewLabelBiruHandler(db *gorm.DB) *labelBiruStruct {
	return &labelBiruStruct{
		BaseHandler: NewBaseHandler[models.LabelBiru](db),
	}
}

func (h *labelBiruStruct) RegisterRoutes(rg *gin.RouterGroup) {
	route:= rg.Group("/label-biru")
	{
		route.GET("", h.Index)
		route.POST("", h.Create)
		route.PUT("/:id", h.Update)
		route.DELETE("/:id", h.Delete)
	}
}