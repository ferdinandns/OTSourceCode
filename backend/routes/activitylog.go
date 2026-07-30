package routes

import (
	"database/sql"

	"sample-qc-backend/handlers"
	"sample-qc-backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupActivityLogRoutes(router *gin.Engine, db *sql.DB) {
	handler := handlers.NewActivityLogHandler(db)

	api := router.Group("/api")

	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware(db))
	{
		protected.GET("/activity-logs", handler.GetAll)
	}
}
