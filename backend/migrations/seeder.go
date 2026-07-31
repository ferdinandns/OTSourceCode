package migrations

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"

	"emertrack/internal/domain"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// SeedConfig membaca konfigurasi seed dari environment variable.
// Semua nilai punya default supaya tidak perlu set kalau tidak mau custom.
type SeedConfig struct {
	// Site
	SiteCode string
	SiteName string

	// Department
	DeptCode string
	DeptName string

	// Admin user
	AdminNIK      string
	AdminName     string
	AdminEmail    string
	AdminPassword string
}

func loadSeedConfig() SeedConfig {
	cfg := SeedConfig{
		SiteCode:      getEnvOrDefault("SEED_SITE_CODE", "SITE-01"),
		SiteName:      getEnvOrDefault("SEED_SITE_NAME", "Site Utama"),
		DeptCode:      getEnvOrDefault("SEED_DEPT_CODE", "DEPT-01"),
		DeptName:      getEnvOrDefault("SEED_DEPT_NAME", "Department Utama"),
		AdminNIK:      getEnvOrDefault("SEED_ADMIN_NIK", "0000000001"),
		AdminName:     getEnvOrDefault("SEED_ADMIN_NAME", "Super Admin"),
		AdminEmail:    getEnvOrDefault("SEED_ADMIN_EMAIL", "admin@emertrack.com"),
		AdminPassword: getEnvOrDefault("SEED_ADMIN_PASSWORD", "Admin@12345"),
	}
	return cfg
}

func getEnvOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

// RunSeeder dipanggil setelah AutoMigrate.
// Idempotent — aman dijalankan berulang kali, tidak akan duplikat data.
func RunSeeder(db *gorm.DB) error {
	cfg := loadSeedConfig()
	ctx := context.Background()

	log.Println("[Seeder] Memulai seeding data awal...")

	// ── 1. Site ───────────────────────────────────────────────────────────────
	var site domain.Site
	result := db.WithContext(ctx).Where("code = ?", cfg.SiteCode).First(&site)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		site = domain.Site{
			Code: cfg.SiteCode,
			Name: cfg.SiteName,
		}
		if err := db.WithContext(ctx).Create(&site).Error; err != nil {
			return fmt.Errorf("[Seeder] Gagal buat site: %w", err)
		}
		log.Printf("[Seeder] Site '%s' berhasil dibuat (ID: %d)", site.Name, site.ID)
	} else if result.Error != nil {
		return fmt.Errorf("[Seeder] Gagal cek site: %w", result.Error)
	} else {
		log.Printf("[Seeder] Site '%s' sudah ada, skip", site.Name)
	}

	// ── 2. Department ─────────────────────────────────────────────────────────
	var dept domain.Department
	result = db.WithContext(ctx).Where("code = ?", cfg.DeptCode).First(&dept)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		dept = domain.Department{
			Code:   cfg.DeptCode,
			Name:   cfg.DeptName,
			SiteID: site.ID,
			IsQs:   false,
		}
		if err := db.WithContext(ctx).Create(&dept).Error; err != nil {
			return fmt.Errorf("[Seeder] Gagal buat department: %w", err)
		}
		log.Printf("[Seeder] Department '%s' berhasil dibuat (ID: %d)", dept.Name, dept.ID)
	} else if result.Error != nil {
		return fmt.Errorf("[Seeder] Gagal cek department: %w", result.Error)
	} else {
		log.Printf("[Seeder] Department '%s' sudah ada, skip", dept.Name)
	}

	// ── 3. Admin User ─────────────────────────────────────────────────────────
	var adminUser domain.User
	result = db.WithContext(ctx).Where("nik = ?", cfg.AdminNIK).First(&adminUser)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		hash, err := bcrypt.GenerateFromPassword([]byte(cfg.AdminPassword), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("[Seeder] Gagal hash password: %w", err)
		}

		adminUser = domain.User{
			NIK:                cfg.AdminNIK,
			Name:               cfg.AdminName,
			Email:              cfg.AdminEmail,
			PasswordHash:       string(hash),
			MustChangePassword: false,
			SiteID:             site.ID,
			DepartmentID:       dept.ID,
			IsActive:           true,
			IsSupervisor:       false,
		}
		if err := db.WithContext(ctx).Create(&adminUser).Error; err != nil {
			return fmt.Errorf("[Seeder] Gagal buat admin user: %w", err)
		}
		log.Printf("[Seeder] Admin user '%s' berhasil dibuat (ID: %d)", adminUser.Name, adminUser.ID)

		adminRole := domain.UserRole{
			UserID:    adminUser.ID,
			Role:      domain.RoleAdmin,
			CreatedBy: adminUser.ID,
		}
		if err := db.WithContext(ctx).Create(&adminRole).Error; err != nil {
			return fmt.Errorf("[Seeder] Gagal assign role admin: %w", err)
		}
		log.Printf("[Seeder] Role 'admin' berhasil di-assign ke '%s'", adminUser.Name)

	} else if result.Error != nil {
		return fmt.Errorf("[Seeder] Gagal cek admin user: %w", result.Error)
	} else {
		log.Printf("[Seeder] Admin user '%s' sudah ada, skip", adminUser.Name)
	}

	log.Println("[Seeder] Seeding selesai.")
	return nil
}
