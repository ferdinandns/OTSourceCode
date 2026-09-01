
package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// LoadEnv berfungsi untuk membaca .env
func LoadEnv() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: No .env file found, using system environment variables")
	}
}

// GetEnv berfungsi untuk mendapatkan nilai dari .env
func GetEnv(key string, defaultValue string) string {
	value, exists := os.LookupEnv(key)
	if !exists {
		return defaultValue
	}
	return value
}
