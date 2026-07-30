package routes

import (
	"database/sql"

	"sample-qc-backend/handlers"
	"sample-qc-backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupAuthRoutes(router *gin.Engine, db *sql.DB) {
	handler := handlers.NewAuthHandler(db)

	api := router.Group("/api")
	{
		api.POST("/login", handler.Login)
		api.POST("/refresh-token", handler.RefreshToken)
		api.POST("/logout", middleware.AuthMiddleware(db), handler.Logout)
	}
}
