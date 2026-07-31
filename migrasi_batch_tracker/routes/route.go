package routes

import (
	"migrasi_batch_tracker/config"
	"migrasi_batch_tracker/handlers"
	"migrasi_batch_tracker/middleware"
	"migrasi_batch_tracker/services"

	"github.com/gin-gonic/gin"
)

// SetupRoutes mendaftarkan seluruh rute API dan menghubungkan handler ke dependency yang dibutuhkan.
// Arsitektur Perutean:
// - Mendaftarkan middleware global (seperti CORS).
// - Membagi rute berdasarkan modul bisnis utama: Auth, Master, Produksi, dan Reports.
// - Membagi akses menjadi grup `Public` (tanpa otentikasi) dan `Private` (dilindungi `middleware.RequireAuth()`).
func SetupRoutes(r *gin.Engine, db *config.DB) {
	r.Use(middleware.SetupCORS())
	v1 := r.Group("api/v1")
	// 1. Route Auth (Login dsb, biasanya tidak perlu middleware)
	authHandler := handlers.NewAuthHandler(db.AppDB)
	authHandler.RegisterPublicRoutes(v1)

	privateAuth := v1.Group("/")
	privateAuth.Use(middleware.RequireAuth())
	authHandler.RegisterPrivateRoutes(privateAuth)

	// ==========================================
	// GRUP MASTER
	// ==========================================

	// Grup Public (Guest bisa akses, contoh untuk lihat data/GET)
	// publicMaster := v1.Group("/master")

	// Grup Private (Wajib Login, contoh untuk POST/PUT/DELETE)
	privateMaster := v1.Group("/master")
	privateMaster.Use(middleware.RequireAuth())

	// -- CONTOH PENERAPAN PUBLIC & PRIVATE PADA SATU HANDLER --
	// productHandler := handlers.NewProductHandler(db.AppDB)
	// // Memisahkan method di dalam handler-nya nanti:
	// productHandler.RegisterPublicRoutes(publicMaster)   // <-- Method baru (opsional)
	// productHandler.RegisterPrivateRoutes(privateMaster) // <-- Method baru (opsional)

	// -- HANDLER LAMA YANG FULL PRIVATE --
	adminAuditTrailHandler := handlers.NewAdminAuditTrailHandler(db.AppDB)
	adminAuditTrailHandler.RegisterRoutes(privateMaster)

	leadtimeSummaryHandler := handlers.NewLeadtimeSummaryHandler(db.AppDB)
	leadtimeSummaryHandler.RegisterRoutes(privateMaster)

	productHandler := handlers.NewProductHandler(db.AppDB)
	productHandler.RegisterRoutes(privateMaster)

	thresholdsHandler := handlers.NewThresholdsHandler(db.AppDB)
	thresholdsHandler.RegisterRoutes(privateMaster)

	thresholdsEditHandler := handlers.NewThresholdsHandlerEdit(db.AppDB)
	thresholdsEditHandler.RegisterRoutes(privateMaster)

	thresholdsAlertHandler := handlers.NewProductAlertHandler(db.AppDB)
	thresholdsAlertHandler.RegisterRoutes(privateMaster)

	workOrdersHandler := handlers.NewWorkOrdersHandler(db.AppDB)
	workOrdersHandler.RegisterPrivateRoutes(privateMaster)

	labelBiruHandler := handlers.NewLabelBiruHandler(db.WeightrackDB)
	labelBiruHandler.RegisterRoutes(privateMaster)

	userListHandler := handlers.NewGetUserList(db.AppDB)
	userListHandler.UserRoutes(privateMaster)

	// ... (Tambahkan handler master lainnya di sini mengarah ke privateMaster) ...

	// ==========================================
	// GRUP PRODUKSI
	// ==========================================
	produksiPublic := v1.Group("/produksi")

	produksiPrivate := v1.Group("/produksi")
	produksiPrivate.Use(middleware.RequireAuth())

	produksiHandler := handlers.NewBatchTrack(db.AppDB, db.WeightrackDB)

	produksiHandler.RegisterPublicRoutes(produksiPublic)
	produksiHandler.RegisterPrivateRoutes(produksiPrivate)

	// ==========================================
	// GRUP REPORT
	// ==========================================
	reportPrivate := v1.Group("/reports")
	reportPrivate.Use(middleware.RequireAuth())

	// 1. Buat atau ambil instance LeadtimeService (Bisa jadi kamu sudah mendeklarasikannya di atas untuk LeadtimeSummaryHandler)
	leadtimeService := services.NewLeadtimeService(db.AppDB)
	batchReasonService := services.NewBatchReasonService(db.AppDB)

	batchReasonsHandler := handlers.NewBatchReasonHandler(batchReasonService)
	batchReasonsHandler.RegisterRoutes(privateMaster)

	// 2. Injeksi ke ReportService
	reportService := services.NewReportService(db.AppDB, leadtimeService, batchReasonService)
	// 3. Injeksi ke Handler
	reportHandler := handlers.NewReportHandler(reportService)

	reportHandler.RegisterRoutes(reportPrivate)
}
