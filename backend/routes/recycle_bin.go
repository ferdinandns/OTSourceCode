package routes

import (
	"database/sql"

	"sample-qc-backend/handlers"
	"sample-qc-backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupRecycleBinRoutes(router *gin.Engine, db *sql.DB) {
	handler := handlers.NewRecycleBinHandler(db)

	api := router.Group("/api/recycle-bin")

	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware(db))

	{
		protected.GET("", handler.GetAll)
		protected.PUT("/:type/:id/restore", handler.Restore)
		protected.DELETE("/:type/:id", handler.ForceDelete)
	}
}
