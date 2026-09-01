package routes

import (
	"lab-connect/backend-api/controllers"
	"lab-connect/backend-api/middlewares"

	"github.com/gin-gonic/gin"
)

// SetupInstrumentRoutes expects rg to already have AuthMiddleware() applied.
// Do NOT add AuthMiddleware() again inside here.
func SetupInstrumentRoutes(rg *gin.RouterGroup, controller *controllers.InstrumentController) {
	instruments := rg.Group("/instruments")
	{
		// ── READ — all authenticated users (group 1–5) ────────────────────
		instruments.GET("", controller.GetAllInstruments)
		instruments.GET("/categories", controller.GetInstrumentCategories)
		instruments.GET("/by-type/:type", controller.GetInstrumentsByType)
		instruments.GET("/by-type/:type/names", controller.GetInstrumentNamesByType)
		instruments.GET("/by-type/:type/nama/:nama", controller.GetInstrumentsByName)
		instruments.GET("/usage/:usage_id", controller.GetUsageStatus)
		instruments.GET("/usage/:usage_id/results", controller.GetLiveData)
		instruments.GET("/usage/:usage_id/progress", controller.GetReadProgress)
		instruments.GET("/usage/:usage_id/download-pdf", controller.DownloadPDF)
		instruments.GET("/usage/:usage_id/bridge-readings", controller.GetBridgeReadingHistory)
		instruments.GET("/usage/:usage_id/after-reading", controller.GetAfterReadingData)
		instruments.GET("/usage/pending-reread-approvals",
			middlewares.SupervisorAndAbove(),
			controller.GetPendingRereadApprovals)

		// ── READ by :id — all authenticated users ─────────────────────────
		instruments.GET("/:id", controller.GetInstrumentDetail)
		instruments.GET("/:id/usage-history", controller.GetUsageHistory)
		instruments.GET("/:id/checklist", controller.GetChecklist)
		instruments.GET("/:id/checklist-config", controller.GetInstrumentChecklistConfig)
		instruments.GET("/:id/custom-commands", controller.GetCustomCommands)

		// ── WRITE — analyst and above (group <= 4) ────────────────────────
		instruments.POST("", middlewares.AnalystAndAbove(), controller.CreateInstrument)
		instruments.PUT("/:id", middlewares.AnalystAndAbove(), controller.UpdateInstrument)
		instruments.PATCH("/:id/status", controller.UpdateInstrumentStatus)
		// Reading actions — all authenticated users
		instruments.POST("/process-read", controller.ProcessReadInstrument)
		instruments.POST("/save-result", controller.SaveReadResult)
		instruments.POST("/uji-ulang", controller.UjiUlang)
		instruments.POST("/export-pdf", controller.ExportToPDF)
		instruments.POST("/usage/:usage_id/save-pdf", controller.SaveUsagePDF)
		instruments.POST("/save-file", controller.SaveToFileCapture)
		instruments.POST("/validate-checklist", controller.ValidateChecklist)
		instruments.POST("/:id/start-auto-read", controller.StartAutoReadLoopWithChecklist)
		instruments.POST("/:id/start-read", controller.StartReadProcess)
		instruments.POST("/:id/read-now", controller.ReadDataNow)
		instruments.POST("/:id/end-read", controller.EndReadProcess)
		instruments.POST("/:id/execute-command", controller.ExecuteCustomCommand)
		instruments.POST("/:id/test-connection", controller.TestConnection)
		instruments.POST("/usage/:usage_id/complete-reread", controller.CompleteReread)
		instruments.POST("/usage/:usage_id/save-result", controller.SaveReadingResult)
		instruments.POST("/usage/:usage_id/request-reread", controller.RequestReread)
		instruments.POST("/usage/:usage_id/export-pdf", controller.ExportReadingToPDF)
		instruments.POST("/usage/:usage_id/resume", controller.ResumeUsage)
		instruments.POST("/usage/:usage_id/retry-item", controller.RetryItem)

		// ── SUPERVISOR+ (group <= 3) ──────────────────────────────────────
		instruments.PUT("/:id/configuration",
			middlewares.SupervisorAndAbove(),
			controller.UpdateInstrumentConfiguration)
		instruments.PUT("/:id/checklist-config",
			middlewares.SupervisorAndAbove(),
			controller.UpdateChecklistConfig)
		instruments.POST("/approve-uji-ulang",
			middlewares.SupervisorAndAbove(),
			controller.ApproveUjiUlang)
		instruments.POST("/usage/:usage_id/approve-reread",
			middlewares.SupervisorAndAbove(),
			controller.ApproveReread)

		// ── DELETE — supervisor and above (group <= 3) ────────────────────
		instruments.DELETE("/:id",
			middlewares.SupervisorAndAbove(),
			controller.DeleteInstrument)
	}

	// ── Admin checklist management — manager+ (group <= 2) ───────────────
	admin := rg.Group("/admin")
	admin.Use(middlewares.ManagerAndAbove())
	{
		admin.GET("/checklist-by-name", controller.GetAllChecklistByName)
		admin.POST("/checklist-by-name", controller.CreateChecklistByName)
		admin.GET("/checklist-by-name/:id", controller.GetChecklistByNameDetail)
		admin.PUT("/checklist-by-name/:id", controller.UpdateChecklistByName)
		admin.DELETE("/checklist-by-name/:id", controller.DeleteChecklistByName)
		admin.GET("/instrument-names-checklist-status", controller.GetInstrumentNamesByTypeForChecklist)
		admin.GET("/instruments-checklist-status", controller.GetInstrumentsWithChecklistStatus)
	}
}
