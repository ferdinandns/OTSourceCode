package routes

import (
	"database/sql"

	"sample-qc-backend/handlers"

	"github.com/gin-gonic/gin"
)

func SetupMasterItemRoutes(router *gin.Engine, db *sql.DB) {
	handler := &handlers.MasterItemHandler{DB: db}

	api := router.Group("/api/master-items")
	{
		api.GET("", handler.GetAll)
		api.GET("/:id", handler.GetByID)
		api.POST("", handler.Create)
		api.PUT("/:id", handler.Update)
		api.DELETE("/:id", handler.Delete)
	}
}

func SetupMasterItemPMRoutes(router *gin.Engine, db *sql.DB) {
	handler := &handlers.MasterItemPMHandler{DB: db}

	api := router.Group("/api/master-items-pm")
	{
		api.GET("", handler.GetAll)
		api.GET("/:id", handler.GetByID)
		api.POST("", handler.Create)
		api.PUT("/:id", handler.Update)
		api.DELETE("/:id", handler.Delete)
	}
}
