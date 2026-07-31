package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	App    AppConfig
	DB     DBConfig
	JWT    JWTConfig
	SMTP   SMTPConfig
	Upload UploadConfig
}

type AppConfig struct {
	Port            string
	Env             string
	BaseURL         string
	FrontendBaseURL string
	SessionTTL      time.Duration
}

type DBConfig struct {
	DSN          string
	MaxOpenConns int
	MaxIdleConns int
}

type JWTConfig struct {
	Secret          string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
}

type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
}

type UploadConfig struct {
	BasePath  string
	MaxSizeMB int64
	BaseURL   string
}

func Load() *Config {
	smtpPort, _ := strconv.Atoi(getEnv("SMTP_PORT", "587"))
	return &Config{
		App: AppConfig{
			Port:            getEnv("APP_PORT", "8080"),
			Env:             getEnv("APP_ENV", "development"),
			BaseURL:         getEnv("APP_BASE_URL", "http://localhost:8080"),
			FrontendBaseURL: getEnv("FRONTEND_BASE_URL", "http://localhost:3000"),
			SessionTTL:      30 * time.Minute,
		},

		DB: DBConfig{
			DSN:          getEnv("DATABASE_URL", "host=localhost user=postgres password=adhan27 dbname=emertrack port=5432 sslmode=disable"),
			MaxOpenConns: 25,
			MaxIdleConns: 10,
		},
		JWT: JWTConfig{
			Secret:          getEnv("JWT_SECRET", "kimi-dake-o-mamoritai"),
			AccessTokenTTL:  30 * time.Minute,
			RefreshTokenTTL: 7 * 24 * time.Hour,
		},
		SMTP: SMTPConfig{
			Host:     getEnv("SMTP_HOST", "smtp.example.com"),
			Port:     smtpPort,
			Username: getEnv("SMTP_USER", ""),
			Password: getEnv("SMTP_PASSWORD", ""),
			From:     getEnv("SMTP_FROM", "emertrack@company.com"),
		},
		Upload: UploadConfig{
			BasePath:  getEnv("UPLOAD_PATH", "./uploads"),
			MaxSizeMB: 1,
			BaseURL:   getEnv("UPLOAD_BASE_URL", "http://localhost:8080/uploads"),
		},
	}
}

func getEnv(key, def string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return def
}
