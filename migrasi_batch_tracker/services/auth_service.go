package services

import (
	"errors"
	"fmt"
	"migrasi_batch_tracker/models"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// LoginService memvalidasi kredensial user (menggunakan Bcrypt), menyiapkan detail area untuk JWT claims, 
// dan mencatat aktivitas login secara asynchronous (goroutine) agar tidak memperlambat response HTTP.
func LoginService(db *gorm.DB, username, password, ipAddress string) (models.User, error) {
	var user models.User

	// Cek apakah user ada
	if err := db.Where("Username ILIKE ?", username).First(&user).Error; err != nil {
		return user, errors.New("Username tidak ditemukan!")
	}

	// Validasi Password
	errPw := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if errPw != nil {
		return user, errors.New("Password tidak cocok!")
	}

	// Lengkapi detail_area user, dipakai oleh service untuk dimasukkan ke
	// dalam JWT claims sehingga fitur lain bisa cek akses berdasarkan detail_area.
	user.Detail_area = GetDetailAreaForUser(db, user.Area, user.ID)

	// Catat Audit Trail secara asynchronous agar tidak memblokir proses login
	go func(u models.User, ip string) {
		auditLog := models.AuditTrail{
			Id:       u.ID,
			Tanggal:  time.Now().Truncate(time.Second),
			Jam:      time.Now().Format("15:04:05"),
			AlamatIP: ip,
			Nama:     u.Nama,
			Area:     u.Area,
			Kegiatan: u.Nama + " berhasil login",
		}
		if err := db.Create(&auditLog).Error; err != nil {
			fmt.Println("Gagal catat audit login:", err)
		}
	}(user, ipAddress)

	return user, nil
}

// GetDetailAreaForUser mengambil detail area user dari tabel master terkait sesuai area kerjanya.
func GetDetailAreaForUser(db *gorm.DB, area string, userID uint) string {
	tableName, found := mapTableName[area]
	if !found || userID == 0 {
		return ""
	}

	var detail struct {
		DetailArea string `gorm:"column:detail_area"`
	}

	if err := db.Table(tableName).
		Select("detail_area").
		Where("id = ?", userID).
		First(&detail).Error; err != nil {
		return ""
	}

	return detail.DetailArea
}

// LogoutService mencatat aktivitas logout ke audit trail agar riwayat user dapat dilacak.
func LogoutService(db *gorm.DB, userID uint, nama, area, ipAddress string) error {
	auditLog := models.AuditTrail{
		Id:       userID,
		Tanggal:  time.Now().Truncate(time.Second),
		Jam:      time.Now().Format("15:04:05"),
		AlamatIP: ipAddress,
		Nama:     nama,
		Area:     area,
		Kegiatan: nama + " berhasil logout",
	}

	if err := db.Create(&auditLog).Error; err != nil {
		return errors.New("gagal mencatat log aktivitas logout")
	}

	return nil
}
