package routes

import (
	"database/sql"

	"sample-qc-backend/handlers"

	"github.com/gin-gonic/gin"
)

func SetupMasterProductRoutes(router *gin.Engine, db *sql.DB) {
	handler := &handlers.MasterProductHandler{DB: db}

	api := router.Group("/api/master-products")
	{
		api.GET("", handler.GetAll)
		api.GET("/:id", handler.GetByID)
		api.POST("", handler.Create)
		api.DELETE("/:id", handler.Delete)
	}
}
