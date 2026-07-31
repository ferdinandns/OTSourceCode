package config

import (
	"fmt"
	"os"

	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// DB menampung koneksi database aplikasi dan weightrack yang dipakai lintas service.
type DB struct {
	AppDB        *gorm.DB
	WeightrackDB *gorm.DB
}

// InitDB membuka koneksi ke database utama dan database weightrack saat aplikasi start.
func InitDB() *DB {
	// Koneksi utama untuk data batch tracker aplikasi.
	dsnApp := os.Getenv("DB_DSNAPP")

	dbApp, err := gorm.Open(postgres.Open(dsnApp), &gorm.Config{})
	if err != nil {
		panic("gagal koneksi ke db: " + err.Error())
	}
	fmt.Println("berhasil konek ke db app")

	// db weight track
	dsnWeightrack := os.Getenv("DB_WEIGHTRACK")

	dbWeightrack, err := gorm.Open(mysql.Open(dsnWeightrack), &gorm.Config{})
	if err != nil {
		panic("gagal koneksi ke db: " + err.Error())
	}
	fmt.Println("berhasil konek ke db weightrack")

	return &DB{
		AppDB:        dbApp,
		WeightrackDB: dbWeightrack,
	}
}
