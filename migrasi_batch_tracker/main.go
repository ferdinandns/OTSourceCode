package main

import (
	"log"
	"os" // 1. Import package os

	_ "time/tzdata"

	"migrasi_batch_tracker/config"
	"migrasi_batch_tracker/routes"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Muat konfigurasi lingkungan sebelum inisialisasi layanan agar nilai database,
	// JWT, dan port tersedia saat aplikasi berjalan.
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	// Buat koneksi database aplikasi dan weightrack yang dipakai oleh handler dan service.
	db := config.InitDB()

	// Siapkan server HTTP Gin dan daftarkan seluruh route API.
	r := gin.Default()
	routes.SetupRoutes(r, db)

	// Ambil port dari environment variable agar deployment lebih fleksibel.
	port := os.Getenv("APP_PORT")

	// Jalankan server pada port yang telah ditentukan.
	r.Run(":" + port)
}
