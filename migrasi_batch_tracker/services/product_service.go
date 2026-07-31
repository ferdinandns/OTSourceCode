package services

import (
	"errors"
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/models"
	"time"

	"gorm.io/gorm"
)

// GetCompoundingDataService mengambil data produk lengkap beserta relasi mixing tank dan master tank.
func GetCompoundingDataService(db *gorm.DB) ([]models.Product, []models.MixingTank, error) {
	var products []models.Product
	var tanks []models.MixingTank

	// 1. Ambil data produk berserta relasinya (Equivalent dengan: Produk::with('mixingTanks')->get())
	if err := db.Preload("MixingTanksProduct.MixingTank").Order("Id asc").Find(&products).Error; err != nil {
		return nil, nil, err
	}

	// 2. Ambil master data semua tangki (Equivalent dengan: MixingTank::all())
	if err := db.Find(&tanks).Error; err != nil {
		return nil, nil, err
	}

	return products, tanks, nil
}

// SyncMixingTanksService menyinkronkan relasi produk dengan mixing tank dan mencatat audit trail.
func SyncMixingTanksService(db *gorm.DB, productID uint, req models.SyncTankRequest, ipAddress string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// 1. Verifikasi akun konfirmasi secara manual (sesuai SOP ketat)
		var verifier models.User
		if err := tx.Table("tb_admin_user").Where("username ILIKE ?", req.ConfirmUsername).First(&verifier).Error; err != nil {
			return errors.New("Username atau password salah.")
		}
		if !helpers.CheckPassword(req.ConfirmPassword, verifier.Password) {
			return errors.New("Username atau password salah.")
		}

		// 2. Cek apakah produknya valid ada di DB
		var produk models.Product
		if err := tx.First(&produk, productID).Error; err != nil {
			return errors.New("Data produk tidak ditemukan.")
		}

		// 3. Proses Sinkronisasi (Sync) tabel Pivot Many-to-Many
		if err := tx.Table("tb_mixing_tank_produk").Where("produk_id = ?", productID).Delete(nil).Error; err != nil {
			return err
		}

		// Daftarkan relasi tangki yang baru dicentang beserta data info update-nya
		nowTime := time.Now()
		for _, tankID := range req.MixingTankIDs {
			pivotData := map[string]any{
				"produk_id":      productID,
				"mixing_tank_id": tankID,
				"update_by":      req.ConfirmUsername,
				"update_time":    nowTime,
			}
			if err := tx.Table("tb_mixing_tank_produk").Create(&pivotData).Error; err != nil {
				return err
			}
		}

		// 4. Catat riwayat aksi ke Audit Trail
		kegiatan := verifier.Nama + " melakukan perubahan data Mixing Tank."
		errAudit := tx.Table("tb_admin_audit_trail").Create(map[string]interface{}{
			"tanggal":   nowTime.Format("2006-01-02"),
			"jam":       nowTime.Format("15:04:05"),
			"alamat_ip": ipAddress,
			"nama":      verifier.Nama,
			"area":      verifier.Area,
			"kegiatan":  kegiatan,
		}).Error

		return errAudit
	})
}

// UpdateAutoRilisService mengubah status auto rilis produk dan mencatat perubahan untuk audit.
func UpdateAutoRilisService(db *gorm.DB, productID uint, req models.UpdateAutoRilisRequest, ipAddress string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// 1. Verifikasi User
		var verifier models.User
		if err := tx.Table("tb_admin_user").Where("username ILIKE ?", req.ConfirmUsername).First(&verifier).Error; err != nil {
			return errors.New("Username atau password salah.")
		}
		if !helpers.CheckPassword(req.ConfirmPassword, verifier.Password) {
			return errors.New("Username atau password salah.")
		}

		// 2. Ambil data kondisi awal produk (untuk kebutuhan riwayat audit log sebelum vs sesudah)
		var awal models.Product
		if err := tx.First(&awal, productID).Error; err != nil {
			return errors.New("Data produk tidak ditemukan.")
		}

		// 3. Update data tabel produk
		nowTime := time.Now()
		updateData := map[string]any{
			"produksi_auto_rilis": req.ProduksiAutoRilis,
			"update_time":         nowTime,
			"updated_by":          req.ConfirmUsername,
		}
		if err := tx.Model(&models.Product{}).Where("id = ?", productID).Updates(updateData).Error; err != nil {
			return err
		}

		// 4. Catat ke Audit Trail dengan format log sebelum -> sesudah
		kegiatan := verifier.Nama + " melakukan perubahan data auto rilis. [1] Kode Produk : " + awal.KodeProduk + " [2] Perubahan : " + awal.ProduksiAutoRilis + " -> " + req.ProduksiAutoRilis
		errAudit := tx.Table("tb_admin_audit_trail").Create(map[string]interface{}{
			"tanggal":   nowTime.Format("2006-01-02"),
			"jam":       nowTime.Format("15:04:05"),
			"alamat_ip": ipAddress,
			"nama":      verifier.Nama,
			"area":      verifier.Area,
			"kegiatan":  kegiatan,
		}).Error

		return errAudit
	})
}

// UpdateStatusService mengubah status produk menjadi listing atau delisting dengan pencatatan audit.
func UpdateStatusService(db *gorm.DB, productID uint, req models.UpdateStatusRequest, ipAddress string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// 1. Verifikasi User
		var verifier models.User
		if err := tx.Table("tb_admin_user").Where("username ILIKE ?", req.ConfirmUsernameStatus).First(&verifier).Error; err != nil {
			return errors.New("Username atau password salah.")
		}
		if !helpers.CheckPassword(req.ConfirmPasswordStatus, verifier.Password) {
			return errors.New("Username atau password salah.")
		}

		// 2. Ambil data kondisi awal produk
		var awal models.Product
		if err := tx.First(&awal, productID).Error; err != nil {
			return errors.New("Data produk tidak ditemukan.")
		}

		// 3. Update status ketersediaan produk
		nowTime := time.Now()
		updateData := map[string]any{
			"status":      req.Status,
			"update_time": nowTime,
			"updated_by":  req.ConfirmUsernameStatus,
		}
		if err := tx.Model(&models.Product{}).Where("id = ?", productID).Updates(updateData).Error; err != nil {
			return err
		}

		// 4. Catat ke Audit Trail
		kegiatan := verifier.Nama + " melakukan perubahan data status. [1] Kode Produk : " + awal.KodeProduk + " [2] Perubahan : " + awal.Status + " -> " + req.Status
		errAudit := tx.Table("tb_admin_audit_trail").Create(map[string]interface{}{
			"tanggal":   nowTime.Format("2006-01-02"),
			"jam":       nowTime.Format("15:04:05"),
			"alamat_ip": ipAddress,
			"nama":      verifier.Nama,
			"area":      verifier.Area,
			"kegiatan":  kegiatan,
		}).Error

		return errAudit
	})
}
