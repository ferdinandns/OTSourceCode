package routes

import (
	"lab-connect/backend-api/controllers"
	"lab-connect/backend-api/middlewares"
	"lab-connect/backend-api/services"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(instrumentController *controllers.InstrumentController, auditController *controllers.AuditController, auditService *services.AuditService) *gin.Engine {
	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type", "Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	router.GET("/ws", controllers.WebSocketController)

	api := router.Group("/api")
	{
		// ── Public routes (no auth required) ──────────────────────────────
		api.POST("/register", controllers.Register)
		api.POST("/login", controllers.Login)
		api.GET("/lokasi", controllers.GetAllLokasi)

		// Password reset — public (no auth needed)
		api.POST("/forgot-password", controllers.ForgotPassword)
		api.POST("/reset-password", controllers.ResetPassword)

		// ── Bridge routes ─────────────────────────────────────────────────
		bridgeController := controllers.NewBridgeController()
		bridge := api.Group("/bridge")
		{
			bridge.POST("/data", bridgeController.ReceiveBridgeData)
			bridge.POST("/register", bridgeController.RegisterBridge)
			bridge.GET("/pcs", bridgeController.GetAllBridgePCs)
			bridge.GET("/readings", bridgeController.GetBridgeReadings)
			bridge.POST("/verification-data", bridgeController.ReceiveVerificationData)
			// Untuk Bridge bisa polling apakah ada pending request
			bridge.GET("/verification-pending/:pc_id", bridgeController.GetPendingVerificationReads)

			bridge.POST("/:pc_id/instrument/:inst_id/start", bridgeController.StartInstrument)
			bridge.POST("/:pc_id/instrument/:inst_id/stop", bridgeController.StopInstrument)
			bridge.POST("/:pc_id/instrument/:inst_id/restart", bridgeController.RestartInstrument)
			bridge.GET("/:pc_id/instrument/:inst_id/status", bridgeController.GetInstrumentStatus)

			bridge.POST("/:pc_id/start", bridgeController.StartBridge)
			bridge.POST("/:pc_id/stop", bridgeController.StopBridge)
			bridge.POST("/:pc_id/restart", bridgeController.RestartBridge)

			bridge.GET("/status/:pc_id", bridgeController.GetBridgeStatus)
			bridge.GET("/config/:pc_id", bridgeController.GetBridgeConfig)
		}

		// ── Authenticated routes ───────────────────────────────────────────
		auth := api.Group("")
		auth.Use(middlewares.AuthMiddleware())
		auth.Use(middlewares.AuditMiddleware(auditService))
		{
			// Lokasi
			auth.POST("/lokasi", middlewares.ManagerAndAbove(), controllers.CreateLokasi)

			// User management
			auth.GET("/users", middlewares.SupervisorAndAbove(), controllers.FindUsers)
			auth.GET("/users/supervisors", middlewares.AllAuthenticated(), controllers.GetSupervisorsByLocation)
			auth.GET("/profile", middlewares.AllAuthenticated(), controllers.GetProfile)
			auth.PUT("/profile", middlewares.AllAuthenticated(), controllers.UpdateProfile)
			auth.GET("/users/:id", middlewares.SupervisorAndAbove(), controllers.FindUserById)
			auth.POST("/users", middlewares.SupervisorAndAbove(), controllers.CreateUser)
			auth.PUT("/users/:id", middlewares.SupervisorAndAbove(), controllers.UpdateUser)

			// Status management — supervisor and above
			auth.PATCH("/users/:id/status", middlewares.SupervisorAndAbove(), controllers.UpdateUserStatus)

			// Delete — superadmin only
			auth.DELETE("/users/:id", middlewares.SuperadminOnly(), controllers.DeleteUser)

			// Instrument, Verification, Product, Audit
			if instrumentController != nil {
				SetupInstrumentRoutes(auth, instrumentController)
			}
			SetupVerificationRoutes(auth)
			SetupProductRoutes(auth)
			SetupAuditRoutes(auth, auditController)
		}
	}

	router.Static("/exports", "./exports")

	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "Lab Connect API is running",
		})
	})

	return router
}
