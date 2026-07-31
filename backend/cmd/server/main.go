package main

import (
	"log"
	"os"
	"strconv"
	"time"

	"emertrack/config"
	"emertrack/internal/approval"
	"emertrack/internal/audit"
	"emertrack/internal/cron"
	"emertrack/internal/dashboard"
	"emertrack/internal/inspection"
	"emertrack/internal/master"
	"emertrack/internal/mytask"
	"emertrack/internal/notification"
	"emertrack/internal/refill"
	"emertrack/internal/repair"
	"emertrack/internal/report"
	"emertrack/internal/review"
	"emertrack/internal/router"
	"emertrack/internal/sarpras"
	"emertrack/internal/user"
	"emertrack/migrations"
	"emertrack/pkg/email"
	"emertrack/pkg/jwt"
	"emertrack/pkg/upload"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found. Falling back to system environment variables.")
	}
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		log.Fatal("Failed to load timezone:", err)
	}
	time.Local = loc
	cfg := config.Load()
	dsn := os.Getenv("DATABASE_URL")
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	rawDB, err := db.DB()
	if err != nil {
		log.Fatalf("Failed to get raw database instance: %v", err)
	}
	log.Println("Running database migration...")
	if err := migrations.AutoMigrate(db); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	if os.Getenv("RUN_SEEDER") == "true" {
		log.Println("Running seeder...")
		if err := migrations.RunSeeder(db); err != nil {
			log.Fatalf("Seeder failed: %v", err)
		}
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	jwtMgr := jwt.NewManager(jwtSecret, 1*time.Hour, 7*24*time.Hour)

	portStr := os.Getenv("SMTP_PORT")
	smtpPort, _ := strconv.Atoi(portStr)
	if smtpPort == 0 {
		smtpPort = 465
	}

	emailCfg := email.Config{
		Host:     os.Getenv("SMTP_HOST"),
		Port:     smtpPort,
		Username: os.Getenv("SMTP_USER"),
		Password: os.Getenv("SMTP_PASS"),
		From:     os.Getenv("SMTP_FROM"),
	}
	mailer := email.New(emailCfg)

	// Uploader (shared)
	uploaderCfg := upload.Config{
		S3Endpoint:  os.Getenv("S3_ENDPOINT"),
		S3AccessKey: os.Getenv("S3_ACCESS_KEY"),
		S3SecretKey: os.Getenv("S3_SECRET_KEY"),
		S3Bucket:    os.Getenv("S3_BUCKET"),
		S3Region:    os.Getenv("S3_REGION"),

		MaxInspectionMB: 1,
		MaxRepairMB:     10,
	}

	upl, err := upload.New(uploaderCfg)
	if err != nil {
		log.Fatal("Gagal inisialisasi Uploader S3:", err)
	}

	// Repositories
	auditRepo := audit.NewAuditRepository(db)
	userRepo := user.NewUserRepository(db)
	masterRepo := master.NewMasterRepository(db)
	stRepo := sarpras.NewSarprasTypeRepository(db)
	sarprasRepo := sarpras.NewSarprasRepository(db, rawDB)
	approvalRepo := approval.NewApprovalRepository(db)
	notifRepo := notification.NewRepository(db)
	inspRepo := inspection.NewRepository(db, rawDB)
	repairRepo := repair.NewRepository(db, rawDB)
	reviewRepo := review.NewRepository(db, rawDB)
	dashboardRep := dashboard.NewRepository(rawDB)
	myTaskRepo := mytask.NewRepository(rawDB)
	reportRepo := report.NewRepository(rawDB)
	refillRepo := refill.NewRefillRepository(db, rawDB)

	// Services
	auditSvc := audit.NewAuditService(auditRepo)
	userSvc := user.NewUserService(userRepo, stRepo, auditSvc)
	notifSvc := notification.NewService(notifRepo, userRepo, mailer)
	masterSvc := master.NewMasterService(masterRepo, notifSvc, db)
	sarprasSvc := sarpras.NewSarprasService(stRepo, sarprasRepo, masterRepo, approvalRepo, notifSvc, db)
	approvalSvc := approval.NewApprovalService(approvalRepo, stRepo, sarprasRepo, sarprasSvc, notifSvc, db)

	repairSvc := repair.NewService(repair.RepairServiceDeps{
		RepairRepo:  repairRepo,
		UserRepo:    userRepo,
		SarprasRepo: sarprasRepo,
		AuditSvc:    auditSvc,
		NotifSvc:    notifSvc,
		Mailer:      mailer,
		Config:      cfg,
		DB:          db,
	})

	// === REVIEW SERVICE (depend on repairSvc) ===
	reviewSvc := review.NewService(reviewRepo, sarprasRepo, repairSvc, upl)

	inspSvc := inspection.NewService(inspection.InspectionServiceDeps{
		InspRepo:    inspRepo,
		SarprasRepo: sarprasRepo,
		StRepo:      stRepo,
		RefillRepo:  refillRepo,
		NotifSvc:    notifSvc,
		AuditSvc:    auditSvc,
		UserRepo:    userRepo,
		DB:          db,
	})
	
	refillSvc  := refill.NewRefillService(refillRepo, db, auditSvc, mailer, notifSvc)
	dashSvc	   := dashboard.NewService(dashboardRep)
	myTaskSvc  := mytask.NewService(myTaskRepo)
	reportSvc  := report.NewService(reportRepo, sarprasRepo)

	// Handlers
	userH := user.NewHandler(userSvc, jwtMgr)
	masterH := master.NewHandler(masterSvc)
	sarprasH := sarpras.NewHandler(sarprasSvc)
	approvalH := approval.NewHandler(approvalSvc)
	auditH := audit.NewHandlerAudit(auditSvc)
	inspH := inspection.NewHandler(inspSvc, upl)
	repairH := repair.NewHandler(repairSvc, upl)
	reviewH := review.NewHandler(reviewSvc, upl)
	refillH := refill.NewRefillHandler(refillSvc, upl)
	dashboardH := dashboard.NewHandler(dashSvc)
	notifHandler := notification.NewHandler(notifSvc, jwtMgr)
	myTaskH := mytask.NewHandler(myTaskSvc)
	reportH := report.NewHandler(reportSvc)

	jobs := cron.NewJobs(sarprasSvc, inspSvc, notifSvc, repairSvc, refillSvc)

	cronManager := cron.NewManager()

	cronManager.RegisterJob(cron.Job{
		Name:     "daily_tasks",
		Schedule: "0 8 * * *",
		Task:     jobs.RunDailyTasks,
	})

	cronManager.Start()
	defer cronManager.Stop()

	app := router.Setup(router.SetupConfig{
		JWTMgr:        jwtMgr,
		UserH:         userH,
		MasterH:       masterH,
		SarprasH:      sarprasH,
		ApprovalH:     approvalH,
		AuditH:        auditH,
		InspH:         inspH,
		RepairH:       repairH,
		ReviewH:       reviewH,
		RefillH:       refillH,
		DashboardH:    dashboardH,
		NotificationH: notifHandler,
		MyTaskH:       myTaskH,
		ReportH:       reportH,
	})

	port := os.Getenv("BACKEND_PORT")
	log.Printf("Server Emertrack berjalan di port %s...", port)
	if err := app.Run(":" + port); err != nil {
		log.Fatalf("Gagal menjalankan server: %v", err)
	}
}
