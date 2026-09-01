package routes

import (
	"lab-connect/backend-api/controllers"
	"lab-connect/backend-api/middlewares"
	"lab-connect/backend-api/services"

	"github.com/gin-gonic/gin"
)

func SetupVerificationRoutes(router *gin.RouterGroup) {
	// Initialize services
	verificationService := services.NewVerificationService()

	// Initialize controllers
	verificationController := controllers.NewVerificationController(verificationService)

	// Verification routes - require authentication
	verifications := router.Group("/verifications")
	verifications.Use(middlewares.AuthMiddleware())
	{
		// List instruments for verification
		verifications.GET("/instruments", verificationController.GetInstrumentsForVerification)

		// Verification history (MUST be before /:id route)
		verifications.GET("/history", verificationController.GetVerificationHistory)

		// Batch operations (MUST be before /:id route)
		verifications.POST("/batch-execute", verificationController.BatchExecuteSteps)

		// Start verification process
		verifications.POST("/start", verificationController.StartVerification)

		// Execute step
		verifications.POST("/execute-step", verificationController.ExecuteStep)

		// Get verification detail
		verifications.GET("/:id", verificationController.GetVerificationDetail)

		// Get verification progress
		verifications.GET("/:id/progress", verificationController.GetVerificationProgress)

		// Complete verification
		verifications.POST("/:id/complete", verificationController.CompleteVerification)

		// Cancel verification
		verifications.POST("/:id/cancel", verificationController.CancelVerification)

		// Supervisor approval (supervisor/admin only)
		verifications.POST("/:id/approve", middlewares.SupervisorAndAbove(), verificationController.ApproveVerification)

		// Download verification PDF
		verifications.GET("/:id/download-pdf", verificationController.DownloadVerificationPDF)
		verifications.POST("/api/verifications/readings/fulfill",
			verificationController.FulfillReadRequest)
	}

	// Template Management Routes
	templates := router.Group("/verification-templates")
	templates.Use(middlewares.AuthMiddleware())
	{
		// List templates
		templates.GET("", verificationController.GetTemplates)

		// Create template (Admin only)
		templates.POST("", middlewares.RoleMiddleware("administrator", "superadmin"), verificationController.CreateTemplate)

		// Get template detail
		templates.GET("/:id", verificationController.GetTemplateDetail)

		// Update template (Admin only)
		templates.PUT("/:id", middlewares.RoleMiddleware("administrator", "superadmin"), verificationController.UpdateTemplate)

		// Delete template (Admin only)
		templates.DELETE("/:id", middlewares.RoleMiddleware("administrator", "superadmin"), verificationController.DeleteTemplate)

		// Clone template
		templates.POST("/:id/clone", middlewares.RoleMiddleware("administrator", "superadmin"), verificationController.CloneTemplate)
	}

	// Instrument Template Assignment Routes
	instruments := router.Group("/instruments")
	instruments.Use(middlewares.AuthMiddleware())
	{
		// Assign template to instrument (Admin only)
		instruments.POST("/:id/assign-template", middlewares.RoleMiddleware("administrator", "superadmin"), verificationController.AssignTemplateToInstrument)

		// Get instrument's assigned template
		instruments.GET("/:id/template", verificationController.GetInstrumentTemplate)

		// Get references for instrument
		instruments.GET("/:id/references", verificationController.GetReferencesForInstrument)
	}

	// Reference Management Routes
	references := router.Group("/verification-references")
	references.Use(middlewares.AuthMiddleware())
	{
		// Create reference (Admin only)
		references.POST("", middlewares.RoleMiddleware("administrator", "superadmin"), verificationController.CreateReference)
	}

	// In your routes setup, after existing verification routes:
	configSvc := services.NewVerificationConfigService()
	configCtrl := controllers.NewVerificationConfigController(configSvc)

	// Instrument verification config
	instruments.GET("/:id/verification-config", configCtrl.GetConfig)
	instruments.PUT("/:id/verification-config", configCtrl.UpdateConfig)
}
