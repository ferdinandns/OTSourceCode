package database

import (
	"fmt"
	"lab-connect/backend-api/config"
	"lab-connect/backend-api/models"
	"log"
	"sync"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

var (
	dbAvailable bool
	dbMu        sync.RWMutex

	healthSubs   []chan bool
	healthSubsMu sync.Mutex
)

func IsDBAvailable() bool {
	dbMu.RLock()
	defer dbMu.RUnlock()
	return dbAvailable
}

func SubscribeDBHealth() chan bool {
	ch := make(chan bool, 1)
	healthSubsMu.Lock()
	healthSubs = append(healthSubs, ch)
	healthSubsMu.Unlock()
	return ch
}

func setDBAvailable(ok bool) {
	dbMu.Lock()
	changed := dbAvailable != ok
	dbAvailable = ok
	dbMu.Unlock()

	if !changed {
		return
	}

	if ok {
		log.Println("[DB] ✅ Connection restored — broadcasting recovery")
	} else {
		log.Println("[DB] ❌ Connection lost — broadcasting offline")
	}

	healthSubsMu.Lock()
	defer healthSubsMu.Unlock()
	for _, ch := range healthSubs {
		select {
		case ch <- ok:
		default:
		}
	}
}

// startHealthMonitor pings PostgreSQL every 15 s and updates availability.
func startHealthMonitor() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		if DB == nil {
			setDBAvailable(false)
			continue
		}
		sqlDB, err := DB.DB()
		if err != nil {
			setDBAvailable(false)
			continue
		}
		if err := sqlDB.Ping(); err != nil {
			setDBAvailable(false)
		} else {
			setDBAvailable(true)
		}
	}
}

func InitDB() {
	dbUser := config.GetEnv("DB_USER", "postgres")
	dbPassword := config.GetEnv("DB_PASSWORD", "123")
	dbHost := config.GetEnv("DB_HOST", "localhost")
	dbPort := config.GetEnv("DB_PORT", "5432")
	dbName := config.GetEnv("DB_NAME", "lab_connect")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Jakarta",
		dbHost, dbUser, dbPassword, dbName, dbPort)

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Info),
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		log.Fatal("failed to connect database")
	}
	fmt.Println("Database connected successfully")

	fixVerificationTemplateConstraints()

	// Now run AutoMigrate
	log.Println("📦 Running database migration...")
	err = DB.AutoMigrate(
		&models.User{},
		&models.AuditLog{},
	)

	if err != nil {
		log.Printf("❌ Migration error: %v", err)
		log.Fatal("failed to migrate database")
	}

	fmt.Println("✅ Database migrated successfully")

	// Create proper indexes
	createVerificationIndexes()

	RunSeeder()

	setDBAvailable(true)

	// Start health monitor in a separate goroutine
	go startHealthMonitor()
}

func applySyncStatusColumns() {
	stmts := []string{
		`ALTER TABLE instrument_usages
		 ADD COLUMN IF NOT EXISTS sync_status VARCHAR(10) NOT NULL DEFAULT 'synced',
		 ADD COLUMN IF NOT EXISTS synced_at   TIMESTAMPTZ`,

		`ALTER TABLE instrument_verifications
		 ADD COLUMN IF NOT EXISTS sync_status VARCHAR(10) NOT NULL DEFAULT 'synced',
		 ADD COLUMN IF NOT EXISTS synced_at   TIMESTAMPTZ`,

		`CREATE INDEX IF NOT EXISTS idx_instrument_usages_sync_status
		 ON instrument_usages(sync_status)`,

		`CREATE INDEX IF NOT EXISTS idx_instrument_verifications_sync_status
		 ON instrument_verifications(sync_status)`,
	}
	for _, s := range stmts {
		if err := DB.Exec(s).Error; err != nil {
			log.Printf("⚠️  sync column migration warning: %v", err)
		}
	}
	log.Println("✅ Sync status columns ready")
}

// fixVerificationTemplateConstraints - Nuclear fix for the constraint issue
func fixVerificationTemplateConstraints() {
	log.Println("🔧 Fixing verification template constraints...")

	// Step 1: Check if table exists
	var tableExists bool
	DB.Raw(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_name = 'verification_templates'
		)
	`).Scan(&tableExists)

	if !tableExists {
		log.Println("ℹ️  Table doesn't exist yet, will be created fresh")
		return
	}

	log.Println("📋 Table exists, checking constraints and indexes...")

	// Step 2: Drop ALL constraints related to template_name
	var constraints []string
	DB.Raw(`
		SELECT conname
		FROM pg_constraint
		WHERE conrelid = 'verification_templates'::regclass
		AND conname LIKE '%template_name%'
	`).Scan(&constraints)

	for _, constraint := range constraints {
		log.Printf("🗑️  Dropping constraint: %s", constraint)
		DB.Exec(fmt.Sprintf(`ALTER TABLE verification_templates DROP CONSTRAINT IF EXISTS "%s"`, constraint))
	}

	// Step 3: Drop ALL indexes related to template_name
	var indexes []string
	DB.Raw(`
		SELECT indexname
		FROM pg_indexes
		WHERE tablename = 'verification_templates'
		AND indexname LIKE '%template_name%'
	`).Scan(&indexes)

	for _, index := range indexes {
		log.Printf("🗑️  Dropping index: %s", index)
		DB.Exec(fmt.Sprintf(`DROP INDEX IF EXISTS "%s"`, index))
	}

	log.Println("✅ Cleaned up old constraints and indexes")
}

// createVerificationIndexes - Create proper indexes after migration
func createVerificationIndexes() {
	log.Println("📊 Creating verification indexes...")

	// Check if table exists
	var tableExists bool
	DB.Raw(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_name = 'verification_templates'
		)
	`).Scan(&tableExists)

	if !tableExists {
		log.Println("⚠️  Table doesn't exist, skipping index creation")
		return
	}

	// Check if deleted_at column exists
	var hasDeletedAt bool
	DB.Raw(`
		SELECT EXISTS (
			SELECT FROM information_schema.columns 
			WHERE table_name = 'verification_templates' 
			AND column_name = 'deleted_at'
		)
	`).Scan(&hasDeletedAt)

	// Create unique index based on whether deleted_at exists
	var uniqueIndexSQL string
	if hasDeletedAt {
		uniqueIndexSQL = `
			CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_templates_template_name 
			ON verification_templates(template_name) 
			WHERE deleted_at IS NULL
		`
		log.Println("📝 Creating partial unique index (with soft delete support)...")
	} else {
		uniqueIndexSQL = `
			CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_templates_template_name 
			ON verification_templates(template_name)
		`
		log.Println("📝 Creating regular unique index (no soft deletes yet)...")
	}

	if err := DB.Exec(uniqueIndexSQL).Error; err != nil {
		log.Printf("⚠️  Warning creating unique index: %v", err)
	} else {
		log.Println("✅ Unique index created")
	}

	// Create other indexes
	otherIndexes := []struct {
		name string
		sql  string
	}{
		{
			"Instrument type index",
			`CREATE INDEX IF NOT EXISTS idx_verification_templates_instrument_type 
			 ON verification_templates(instrument_type)`,
		},
		{
			"Is active index",
			`CREATE INDEX IF NOT EXISTS idx_verification_templates_is_active 
			 ON verification_templates(is_active)`,
		},
		{
			"Is default index",
			`CREATE INDEX IF NOT EXISTS idx_verification_templates_is_default 
			 ON verification_templates(is_default)`,
		},
	}

	for _, idx := range otherIndexes {
		if err := DB.Exec(idx.sql).Error; err != nil {
			log.Printf("⚠️  Warning creating %s: %v", idx.name, err)
		} else {
			log.Printf("✅ Created %s", idx.name)
		}
	}

	log.Println("✅ All indexes created successfully")
}
