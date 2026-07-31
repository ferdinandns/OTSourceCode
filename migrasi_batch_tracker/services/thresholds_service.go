package services

import (
	"errors"
	"math"
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/models"

	"gorm.io/gorm"
)

// EditThresholdsService menangani pembaruan batasan batas waktu (threshold) secara global.
// Harus divalidasi dengan ulang sandi (password check).
func EditThresholdsService(db *gorm.DB, id int, req models.EditThresholdsRequest, alamatIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// Validasi username dan password
		var user models.User
		if err := tx.Where("username ILIKE ?", req.Username).First(&user).Error; err != nil {
			return errors.New("Username tidak ditemukan")
		}

		// Validasi password
		errPw := helpers.CheckPassword(req.Password, user.Password)
		if !errPw {
			return errors.New("Password tidak cocok")
		}

		// Gunakan variabel `id` langsung
		var threshold models.Thresholds
		if err := tx.Where("id = ?", id).First(&threshold).Error; err != nil {
			return errors.New("Data threshold tidak ditemukan")
		}

		updateData := map[string]interface{}{
			"batas_treshold":     req.BatasTreshold,
			"limit_bawah_pharma": math.Round(float64(req.LimitBawahPharma) * 1440),
			"limit_atas_pharma":  math.Round(float64(req.LimitAtasPharma) * 1440),
			"limit_bawah_herbal": math.Round(float64(req.LimitBawahHerbal) * 1440),
			"limit_atas_herbal":  math.Round(float64(req.LimitAtasHerbal) * 1440),
		}

		// Gunakan variabel `id` langsung untuk update
		if err := tx.Model(&models.Thresholds{}).Where("id = ?", id).Updates(updateData).Error; err != nil {
			return errors.New("Gagal memperbarui data threshold: " + err.Error())
		}

		return nil
	})
}

// Map untuk Whitelist Field agar pencarian lebih cepat O(1) dibanding looping Array
var allowedGroupFields = map[string]bool{
	"threshold_cwo_potong_stock":                  true,
	"threshold_potong_stock_validasi_1":           true,
	"threshold_validasi_1_validasi_2":             true,
	"threshold_validasi_2_start_compounding":      true,
	"threshold_start_compounding_end_compounding": true,
	"threshold_end_compounding_sampling_ruah":     true,
	"threshold_sampling_ruah_ruah_datang":         true,
	"threshold_ruah_datang_disposisi_ruah":        true,
	"threshold_disposisi_ruah_labeling_ruah":      true,
	"threshold_labeling_ruah_start_filling":       true,
	"threshold_start_filling_end_packaging":       true,
	"threshold_end_packaging_qa_rilis":            true,
	"threshold_end_packaging_setor_br":            true,
	"threshold_setor_br_qa_rilis":                 true,
	"threshold_end_packaging_setor_rap":           true,
	"threshold_setor_rap_qa_rilis":                true,
	"threshold_end_filling_qa_rilis":              true,
	"threshold_end_filling_setor_br":              true,
	"threshold_end_filling_setor_rap":             true,
	"threshold_qa_rilis_shipment":                 true,
}

// GetProductAlertsService mengambil seluruh data threshold peringatan khusus untuk setiap produk
// yang masih terdaftar aktif (status != "delisting").
func GetProductAlertsService(db *gorm.DB) ([]models.GetProductAlert, error) {
	var records []models.GetProductAlert

	// Eksekusi query dengan Table, Select, Joins, dan Where
	err := db.Table("tb_produk as p").
		Select(`
			p.id, p.kode_produk, p.nama_produk, p.kategori, p.sediaan,
			a.updated_by, a.update_time,
			a.threshold_cwo_potong_stock, a.threshold_potong_stock_validasi_1,
			a.threshold_validasi_1_validasi_2, a.threshold_validasi_2_start_compounding,
			a.threshold_start_compounding_end_compounding, a.threshold_end_compounding_sampling_ruah,
			a.threshold_sampling_ruah_ruah_datang, a.threshold_ruah_datang_disposisi_ruah,
			a.threshold_disposisi_ruah_labeling_ruah, a.threshold_labeling_ruah_start_filling,
			a.threshold_start_filling_end_packaging, a.threshold_end_packaging_qa_rilis,
			a.threshold_end_packaging_setor_br, a.threshold_setor_br_qa_rilis,
			a.threshold_end_packaging_setor_rap, a.threshold_setor_rap_qa_rilis,
			a.threshold_end_filling_qa_rilis, a.threshold_end_filling_setor_br,
			a.threshold_end_filling_setor_rap, a.threshold_qa_rilis_shipment
		`).
		Joins("LEFT JOIN tb_produk_alert as a ON a.produk_id = p.id").
		Where("p.status != ?", "delisting").
		Scan(&records).Error

	if err != nil {
		return nil, err
	}

	return records, nil
}

// EditAlertService memperbarui nilai threshold alert untuk sekelompok produk berdasarkan kategori & sediaan (mass update).
// Menggunakan transaksi atomic dan validasi keamanan dengan konfirmasi kredensial ganda (re-auth).
func EditAlertService(db *gorm.DB, req models.EditAlertRequest) error {
	// 1. Validasi Whitelist Field
	if !allowedGroupFields[req.Field] {
		return errors.New("Field threshold tidak valid atau tidak diizinkan")
	}

	// 2. Verifikasi User
	var user models.User
	if err := db.Where("username ILIKE ?", req.ConfirmUsername).First(&user).Error; err != nil {
		return errors.New("Username atau password salah")
	}

	if !helpers.CheckPassword(req.ConfirmPassword, user.Password) {
		return errors.New("Username atau password salah")
	}

	// 3. Transaction Update
	return db.Transaction(func(tx *gorm.DB) error {
		
		// Fungsi internal untuk menangani logika update tiap kategori secara modular
		executeUpdate := func(kategori string, sediaan string, inputValue *float64) error {
			// Cek apakah data dikirim dari frontend (mirip request->filled)
			if inputValue == nil {
				return nil
			}

			// Cari ID produk yang sesuai kategori & sediaan
			var productIDs []int
			if err := tx.Table("tb_produk").
				Where("kategori = ? AND sediaan = ?", kategori, sediaan).
				Pluck("id", &productIDs).Error; err != nil {
				return err
			}

			// Jika ada produk yang cocok, lakukan update massal ke tabel alert
			if len(productIDs) > 0 {
				updateData := map[string]interface{}{
					req.Field:    math.Round(*inputValue * 60), // Konversi dan bulatkan
					"updated_by": user.Nama,                    // Sesuaikan dengan kolom struct user kamu
				}

				if err := tx.Table("tb_produk_alert").
					Where("produk_id IN ?", productIDs).
					Updates(updateData).Error; err != nil {
					return err
				}
			}
			return nil
		}

		// Eksekusi untuk masing-masing kondisi
		if err := executeUpdate("Pharma", "Powder", req.PharmaPowder); err != nil {
			return errors.New("Gagal memperbarui grup Pharma Powder: " + err.Error())
		}

		if err := executeUpdate("Herbal", "Liquid", req.HerbalLiquid); err != nil {
			return errors.New("Gagal memperbarui grup Herbal Liquid: " + err.Error())
		}

		if err := executeUpdate("Pharma", "Liquid", req.PharmaLiquid); err != nil {
			return errors.New("Gagal memperbarui grup Pharma Liquid: " + err.Error())
		}

		return nil
	})
}