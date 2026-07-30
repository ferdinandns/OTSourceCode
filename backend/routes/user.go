package routes

import (
	"database/sql"

	"sample-qc-backend/handlers"
	"sample-qc-backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupUserRoutes(router *gin.Engine, db *sql.DB) {
	handler := handlers.NewUserHandler(db)

	api := router.Group("/api")

	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware(db))
	{
		protected.GET("/users", handler.GetUsers)
		protected.POST("/users", handler.CreateUser)
		protected.PUT("/users/:id", handler.UpdateUser)
		protected.DELETE("/users/:id", handler.DeleteUser)
	}
}
