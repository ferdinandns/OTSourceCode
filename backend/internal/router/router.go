package router

import (
	"emertrack/internal/approval"
	"emertrack/internal/audit"
	"emertrack/internal/dashboard"
	"emertrack/internal/domain"
	"emertrack/internal/inspection"
	"emertrack/internal/master"
	"emertrack/internal/middleware"
	"emertrack/internal/mytask"
	"emertrack/internal/notification"
	"emertrack/internal/refill"
	"emertrack/internal/repair"
	"emertrack/internal/report"
	"emertrack/internal/review"
	"emertrack/internal/sarpras"
	"emertrack/internal/user"
	"emertrack/pkg/jwt"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type SetupConfig struct {
	JWTMgr        *jwt.Manager
	UserH         *user.Handler
	MasterH       *master.Handler
	SarprasH      *sarpras.Handler
	ApprovalH     *approval.Handler
	AuditH        *audit.AuditHandler
	InspH         *inspection.Handler
	RepairH       *repair.Handler
	ReviewH       *review.Handler
	DashboardH    *dashboard.Handler
	NotificationH *notification.Handler
	MyTaskH       *mytask.Handler
	RefillH       *refill.RefillHandler
	ReportH       *report.Handler
}

func Setup(
	cfg SetupConfig,
) *gin.Engine {
	r := gin.Default()

	https := os.Getenv("NGINX_HTTPS_PORT")
	address := os.Getenv("NGINX_SERVER_NAME")
	allowedOrigin := "https://" + address + ":" + https

	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			allowed := []string{
				"https://127.0.0.1:8443",
				"https://localhost:8443",
				allowedOrigin,
			}
			for _, o := range allowed {
				if o == origin {
					return true
				}
			}
			// Allow semua ngrok domain
			return strings.HasSuffix(origin, ".ngrok-free.app")
		},
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{
			"Origin",
			"Content-Type",
			"Accept",
			"Authorization",
			"X-Requested-With",
			"ngrok-skip-browser-warning",
		},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/ws", cfg.NotificationH.WSConnect)

	api := r.Group("/api/v1")

	api.POST("/login", cfg.UserH.Login)
	api.POST("/logout", cfg.UserH.Logout)

	api.POST("/forgot-password", cfg.UserH.ForgotPassword)
	api.POST("/reset-password", cfg.UserH.ResetPassword)

	// ws
	api.GET("/ws-token", middleware.RequireAuth(cfg.JWTMgr), cfg.NotificationH.GetWSToken)
	api.GET("/approvers-emails",cfg.UserH.GetApproverEmails)
	protected := api.Group("/")
	protected.Use(middleware.RequireAuth(cfg.JWTMgr))
	{
		protected.POST(PathUsers+"/change-password", cfg.UserH.ChangePassword)
		protected.GET("/me", cfg.UserH.Me)
		strict := protected.Group("/")
		strict.Use(middleware.RequireChangePassword(cfg.UserH.GetUserService()))

		reqPerm := middleware.RequirePermission
		strict.GET(PathMyTasks, cfg.MyTaskH.GetMyTasks)

		dashboardGroup := strict.Group(PathDashboard)
		{
			dashboardGroup.GET("/summary", cfg.DashboardH.GetSummary)
			dashboardGroup.GET("/table", cfg.DashboardH.GetTable)
		}
		// User
		users := strict.Group(PathUsers)
		{
			adminUsers := users.Group("", reqPerm(domain.PermManageUser))
			{
				adminUsers.POST("", cfg.UserH.Create)
				adminUsers.PUT(PathID, cfg.UserH.Update)
				adminUsers.DELETE(PathID, cfg.UserH.Delete)
			}
			viewUsers := users.Group("", reqPerm(domain.PermViewUser))
			{
				viewUsers.GET("", cfg.UserH.List)
				viewUsers.GET(PathID, cfg.UserH.GetUserDetail)
			}
		}

		// Sites & Department
		masterGroup := strict.Group("/")
		{
			masterAdmin := masterGroup.Group("", reqPerm(domain.PermManageMaster))
			masterView := masterGroup.Group("", reqPerm(domain.PermViewMaster))

			masterView.GET(PathSites, cfg.MasterH.ListSites)
			sites := masterAdmin.Group(PathSites)
			{
				sites.POST("", cfg.MasterH.RequestCreateSite)
				sites.PUT(PathID, cfg.MasterH.RequestEditSite)
				sites.DELETE(PathID, cfg.MasterH.RequestDeleteSite)
			}

			masterView.GET(PathDepts, cfg.MasterH.ListDepartments)
			depts := masterAdmin.Group(PathDepts)
			{
				depts.POST("", cfg.MasterH.RequestCreateDepartment)
				depts.PUT(PathID, cfg.MasterH.RequestEditDepartment)
				depts.DELETE(PathID, cfg.MasterH.RequestDeleteDepartment)
			}
		}

		// Sarpras
		sarprasRoot := strict.Group("/")
		{
			sarprasAdmin := sarprasRoot.Group("", reqPerm(domain.PermManageSarpras))
			sarprasView := sarprasRoot.Group("", reqPerm(domain.PermViewSarpras))

			typesView := sarprasView.Group(PathSarprasTypes)
			{
				typesView.GET("", cfg.SarprasH.ListSarprasTypes)
				detail := typesView.Group("/detail")
				detail.GET(PathID, cfg.SarprasH.GetSarprasTypeDetail)
			}

			typesAdmin := sarprasAdmin.Group(PathSarprasTypes)
			{
				typesAdmin.POST("", cfg.SarprasH.RequestCreateSarprasType)
				typesAdmin.PUT(PathID, cfg.SarprasH.RequestEditSarprasType)
				typesAdmin.DELETE(PathID, cfg.SarprasH.RequestDeleteSarprasType)
			}

			itemsView := sarprasView.Group(PathSarpras)
			{
				itemsView.GET("", cfg.SarprasH.ListSarpras)

				detail := itemsView.Group("/detail")
				detail.GET(PathCode, cfg.SarprasH.GetDetail)
				detail.GET(PathCode+"/checker-eligibility", cfg.SarprasH.CheckEligibility)
				export := itemsView.Group("/export")
				export.GET("", cfg.SarprasH.ExportPDF)
				qr := itemsView.Group("/qr")
				qr.GET(PathCode, cfg.SarprasH.GetByQRCode)
				itemsView.GET(PathID+"/qr", cfg.SarprasH.GenerateQRCode)

			}

			itemsAdmin := sarprasAdmin.Group(PathSarpras)
			{
				itemsAdmin.POST("", cfg.SarprasH.RequestCreateSarpras)
				itemsAdmin.PUT(PathID, cfg.SarprasH.RequestEditSarpras)
				itemsAdmin.DELETE(PathID, cfg.SarprasH.RequestDeleteSarpras)

				// Import Via Excel
				itemsAdmin.GET("/template", cfg.SarprasH.DownloadTemplateExcel)
				itemsAdmin.POST("/parse", cfg.SarprasH.BulkImportParse)
				itemsAdmin.POST("/export-errors", cfg.SarprasH.BulkImportExportErrors)
				itemsAdmin.POST("/validate", cfg.SarprasH.BulkImportValidate)
				itemsAdmin.POST("/import/request", cfg.SarprasH.BulkImportExecute)
				itemsAdmin.POST("/trigger", cfg.SarprasH.TriggerExpireApbr)
			}
		}

		// Inspection
		inspGroup := strict.Group(PathInspections, reqPerm(domain.PermViewSarpras))
		{
			// Menu Operasional (Tabel dengan semua Sarpras)
			inspGroup.GET("/active", cfg.InspH.ListActive)
			inspGroup.GET("/history", cfg.InspH.ListHistory)
			inspGroup.GET("/monitoring", cfg.InspH.ListMonitoring)

			inspGroup.GET(PathID, cfg.InspH.GetDetail)
			inspGroup.GET("/form/:sarpras_id", cfg.InspH.GetForm)

			inspGroup.POST("/submit", reqPerm(domain.PermManageInspection), cfg.InspH.Submit)
			inspGroup.POST(PathID+"/claim", reqPerm(domain.PermManageInspection), cfg.InspH.Claim)
			inspGroup.POST(PathID+"/cancel", reqPerm(domain.PermManageInspection), cfg.InspH.Cancel)

			inspGroup.POST("/upload", reqPerm(domain.PermManageInspection), cfg.InspH.UploadImage)
		}

		report := strict.Group(PathReportInspectoin, reqPerm(domain.PermViewReportInsp))
		{
			report.GET("", cfg.ReportH.GetReport)
			report.GET("/export", cfg.ReportH.ExportReport)
		}

		// Repair
		repairGroup := strict.Group(PathRepairs, reqPerm(domain.PermViewSarpras))
		{
			repairGroup.GET("", cfg.RepairH.List)
			repairGroup.GET("/history/pic", cfg.RepairH.ListPICHistory)
			repairGroup.GET("/monitoring", cfg.RepairH.ListMonitoring)
			repairGroup.GET("/history/all", cfg.RepairH.ListAllHistory)
			repairGroup.GET(PathID, cfg.RepairH.GetDetail)
			repairGroup.GET(PathID+"/reviews", cfg.ReviewH.GetRepairReviews)
			repairGroup.POST(PathID+"/action-plan", cfg.RepairH.FillActionPlan)
			repairGroup.POST(PathID+"/evidence", cfg.RepairH.SubmitEvidence)
		}

		// Refill
		refillGroup := strict.Group(PathRefill)
		{
			refillGroup.GET("", cfg.RefillH.GetAparList)
			refillGroup.GET("/:id", cfg.RefillH.GetAparDetail)
			refillGroup.POST("/validate", cfg.RefillH.ValidateApar)
			refillGroup.POST("/submit-po", cfg.RefillH.PostPO)
			refillGroup.POST("/evidence", cfg.RefillH.PostEvidence)
			refillGroup.GET("/verify/:item_id", cfg.RefillH.GetVerifyDetail)
			refillGroup.POST("/verify", cfg.RefillH.PostVerify)
			refillGroup.POST("/mark-used", cfg.RefillH.MarkAsUsed)
		}

		// Approval
		approvals := strict.Group(PathApprovals)
		{
			viewApp := approvals.Group("", reqPerm(domain.PermViewApproval))
			{
				viewApp.GET("", cfg.ApprovalH.List)
				viewApp.GET(PathID, cfg.ApprovalH.GetDetail)
			}
			actionApp := approvals.Group(PathID, reqPerm(domain.PermApproveRequest))
			{
				actionApp.POST("/approve", cfg.ApprovalH.Approve)
				actionApp.POST("/reject", cfg.ApprovalH.Reject)
			}
		}

		// Review (Verifikasi Perbaikan) - QS only
		reviewGroup := strict.Group(PathReviews, reqPerm(domain.PermManageReview))
		{
			reviewGroup.GET("", cfg.ReviewH.List)
			reviewGroup.GET("/history/qs", cfg.ReviewH.ListQSHistory)
			reviewGroup.GET(PathID+"/history", cfg.ReviewH.GetHistoryDetail)
			reviewGroup.GET(PathID, cfg.ReviewH.GetDetail)
			reviewGroup.POST(PathID+"/claim", cfg.ReviewH.Claim)
			reviewGroup.POST(PathID+"/cancel", cfg.ReviewH.CancelClaim)
			reviewGroup.POST(PathID+"/submit", cfg.ReviewH.Submit)
			reviewGroup.GET("/history/export-pdf", cfg.ReviewH.ExportHistoryPDF)
		}

		// Audit
		auditGroup := strict.Group(PathAudit, reqPerm(domain.PermViewAuditLog)) 
		{
			auditGroup.GET("", cfg.AuditH.List)
			auditGroup.GET("/export", cfg.AuditH.ExportExcel)
		}

		// Notification
		notifGroup := strict.Group(PathNotifications, reqPerm(domain.PermViewNotification))
		{
			notifGroup.GET("", cfg.NotificationH.GetMyNotifications)
			notifGroup.PUT(PathID+"/read", cfg.NotificationH.MarkAsRead)
			notifGroup.PUT("/read-all", cfg.NotificationH.MarkAllAsRead)
			notifGroup.DELETE("/:id", cfg.NotificationH.DeleteNotification)
			notifGroup.DELETE("/delete-all-notifications", cfg.NotificationH.DeleteAllnotifications)
		}
	}

	return r
}
