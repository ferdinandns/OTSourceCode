package routes

import (
	"database/sql"

	"sample-qc-backend/handlers"
	"sample-qc-backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupDiversifikasiPMRoutes(router *gin.Engine, db *sql.DB) {
	handler := handlers.NewDiversifikasiPMHandler(db)
	exportHandler := &handlers.ExportDiversifikasiPMHandler{DB: db}

	api := router.Group("/api/diversifikasi-pm")
	{
		api.GET("", handler.GetAll)
		api.GET("/export", exportHandler.Export)

		api.GET("/:id/products", handler.GetProducts)

		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware(db))
		{
			protected.POST("", handler.Create)
			protected.PUT("/:id", handler.Update)
			protected.DELETE("/:id", handler.Delete)
		}
	}
}
