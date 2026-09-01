package routes

import (
	"lab-connect/backend-api/controllers"
	"lab-connect/backend-api/middlewares"
	"lab-connect/backend-api/services"

	"github.com/gin-gonic/gin"
)

// SetupProductRoutes expects rg to already have AuthMiddleware() applied.
func SetupProductRoutes(rg *gin.RouterGroup) {
	productService := services.NewProductService()
	productController := controllers.NewProductController(productService)

	products := rg.Group("/products")
	{
		// ── READ — all authenticated users ───────────────────────────────
		products.GET("", productController.GetAllProducts)
		products.GET("/search", productController.SearchProducts)
		products.GET("/categories", productController.GetCategories)
		products.GET("/stats", productController.GetProductStats)
		products.GET("/by-category/:category", productController.GetProductsByCategory)
		products.GET("/:id", productController.GetProductDetail)

		// ── WRITE — analyst and above (group <= 4) ────────────────────────
		products.POST("", middlewares.AnalystAndAbove(), productController.CreateProduct)
		products.PUT("/:id", middlewares.AnalystAndAbove(), productController.UpdateProduct)

		// ── DELETE — supervisor and above (group <= 3) ────────────────────
		products.DELETE("/:id", middlewares.SupervisorAndAbove(), productController.DeleteProduct)
	}
}
