package routes

import (
	"database/sql"

	"sample-qc-backend/handlers"

	"github.com/gin-gonic/gin"
)

func SetupVideotronRoutes(router *gin.Engine, db *sql.DB) {
	h := handlers.NewVideotronHandler(db)

	api := router.Group("/api")
	{
		api.GET("/videotron", h.GetVideotron)
	}
}