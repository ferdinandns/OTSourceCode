package routes

import (
	"database/sql"

	"sample-qc-backend/handlers"
	"sample-qc-backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupDashboardRoutes(router *gin.Engine, db *sql.DB) {
	h := handlers.NewDashboardHandler(db)

	api := router.Group("/api")
	api.Use(middleware.AuthMiddleware(db))

	{
		api.GET("/dashboard", h.GetDashboard)
	}
}
