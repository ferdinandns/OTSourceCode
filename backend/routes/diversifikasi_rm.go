package routes

import (
	"database/sql"

	"sample-qc-backend/handlers"
	"sample-qc-backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupDiversifikasiRMRoutes(router *gin.Engine, db *sql.DB) {
	handler := &handlers.DiversifikasiRMHandler{DB: db}
	exportHandler := &handlers.ExportDiversifikasiRMHandler{DB: db}

	api := router.Group("/api/diversifikasi-rm")
	{
		api.GET("", handler.GetAllPaginated)
		api.GET("/export", exportHandler.Export)

		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware(db))
		{
			protected.POST("", handler.Create)
			protected.PUT("/:id", handler.Update)
			protected.DELETE("/:id", handler.Delete)
		}
	}
}
