package services

import (
	"math"
	"migrasi_batch_tracker/models"
	"strings"
	"time"

	"gorm.io/gorm"
)

// GetSheetPpic mengambil data awal dari tabel sheet PPIC yang belum diproses untuk ditampilkan di list PPIC.
func GetSheetPpic(db *gorm.DB) ([]models.PpicResponseStep, int64, error) {
	var results []models.PpicResponseStep

	err := db.Table("tb_sheet_ppic").
		Where("delete_status IS NULL").
		Order("tanggal_cwo ASC").
		Find(&results).Error

	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].TanggalCWO).Minutes()
		results[i].LeadTime = &durasi
	}
	total := int64(len(results))
	return results, total, err
}

// GetPotongStock mengambil batch yang siap dipotong stock dan menghitung lead time serta status threshold.
func GetPotongStock(db *gorm.DB) ([]models.ResponseStep, int64, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Select("tb_work_orders.*, tb_produk_alert.threshold_cwo_potong_stock AS threshold").
		Joins("LEFT JOIN tb_produk ON tb_produk.kode_produk = tb_work_orders.kode_produk").
		Joins("LEFT JOIN tb_produk_alert ON tb_produk_alert.produk_id = tb_produk.id").
		Where("ppic_submit_date IS NOT NULL").
		Where("tanggal_potong_stock IS NULL AND kirim_ke_filling IS NULL AND delete_status IS NULL").
		Order("ppic_submit_date ASC").
		Find(&results).Error

	var totalOver int64 = 0
	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].PpicSubmitDate).Minutes()
		durasiVal := durasi
		results[i].LeadTime = &durasiVal

		if results[i].Threshold != nil && durasi > *results[i].Threshold {
			results[i].StatusLead = "OVER"
			totalOver++
		} else {
			results[i].StatusLead = "OK"
		}
	}
	total := int64(len(results))
	return results, total, totalOver, err
}

// GetPreparasi mengambil data batch yang berada pada tahap preparasi bahan.
// Kriteria Filter: Batch sudah dipotong stock (`tanggal_potong_stock` NOT NULL), namun belum ditimbang (`tanggal_timbang` NULL) dan belum divalidasi 1.
func GetPreparasi(db *gorm.DB) ([]models.ResponseStep, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Where("tanggal_potong_stock IS NOT NULL").
		Where("kirim_ke_filling IS NULL AND tanggal_timbang IS NULL AND tanggal_terima_val1 IS NULL AND delete_status IS NULL").
		Order("tanggal_potong_stock ASC").
		Find(&results).Error

	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].TanggalPotongStock).Minutes()
		results[i].LeadTime = &durasi
	}
	total := int64(len(results))
	return results, total, err
}

// GetTimbang menggabungkan data work order dengan informasi label biru untuk menampilkan tahap timbang secara lengkap.
func GetTimbang(dbApp *gorm.DB, dbWeightrack *gorm.DB) ([]models.TimbangResponseStep, int64, error) {
	var results []models.ResponseStep

	err := dbApp.Debug().Table("tb_work_orders").
		Where("tanggal_potong_stock IS NOT NULL").
		Where("tanggal_terima_val1 IS NULL AND kirim_ke_filling IS NULL AND delete_status IS NULL").
		Order("tanggal_timbang ASC").
		Find(&results).Error
	if err != nil {
		return nil, 0, err
	}

	now := time.Now()
	for i := range results {
		if results[i].TanggalTimbang != nil {
			durasi := now.Sub(*results[i].TanggalTimbang).Minutes()

			durasiVal := durasi
			results[i].LeadTime = &durasiVal
		}
	}

	final := make([]models.TimbangResponseStep, len(results))
	for i, r := range results {
		final[i] = models.TimbangResponseStep{ResponseStep: r}
	}

	if len(results) == 0 {
		return final, 0, nil
	}

	kodeRuahSet := map[string]bool{}
	var kodeRuahList []string
	for _, r := range results {
		if r.KodeRuah != "" && !kodeRuahSet[r.KodeRuah] {
			kodeRuahSet[r.KodeRuah] = true
			kodeRuahList = append(kodeRuahList, r.KodeRuah)
		}
	}

	materialMap := make(map[string]int)
	if len(kodeRuahList) > 0 {
		var materials []models.JumlahJenisMaterial
		if err := dbApp.Debug().Table("jumlah_jenis_material").
			Where(`"Kode Produk" IN (?)`, kodeRuahList).
			Find(&materials).Error; err != nil {
			return nil, 0, err
		}
		for _, m := range materials {
			materialMap[m.KodeProduk] = m.JumlahMaterial
		}
	}

	// Total label CLOSED — ambil semua, cocokkan manual (handle batch gabungan "A-B")
	batchSet := map[string]bool{}
	var batchList []string
	for _, r := range results {
		nb := strings.TrimSpace(r.NoBatch)
		if nb != "" && !batchSet[nb] {
			batchSet[nb] = true
			batchList = append(batchList, nb)
		}
	}

	type labelCount struct {
		BatchNo    string `gorm:"column:batch_no"`
		TotalLabel int    `gorm:"column:total_label"`
	}

	labelMap := make(map[string]int)
	if len(batchList) > 0 {
		var labelCounts []labelCount
		if err := dbWeightrack.Debug().Table("tb_label_biru").
			Where("kondisi = ?", "CLOSED").
			Group("batch_no").
			Select("batch_no, COUNT(*) as total_label").
			Scan(&labelCounts).Error; err != nil {
			return nil, 0, err
		}

		for _, lc := range labelCounts {
			parts := strings.Split(lc.BatchNo, "-")
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if batchSet[p] {
					labelMap[p] += lc.TotalLabel
				}
			}
		}
	}

	for i := range final {
		final[i].JumlahMaterial = materialMap[final[i].KodeRuah]
		final[i].TotalLabelClosed = labelMap[final[i].NoBatch]
	}

	total := int64(len(final))
	return final, total, nil
}

// GetValidasi1 mengambil batch yang sudah ditimbang dan siap untuk divalidasi tahap 1 oleh Warehouse.
// Kriteria Filter: Sudah ditimbang, tapi `tanggal_kirim_val1` masih kosong.
func GetValidasi1(db *gorm.DB) ([]models.ResponseStep, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Where("tanggal_timbang IS NOT NULL AND tanggal_terima_val1 IS NOT NULL").
		Where("tanggal_kirim_val1 IS NULL AND delete_status IS NULL").
		Order("tanggal_terima_val1 ASC").
		Find(&results).Error

	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].TanggalTerimaVal1).Minutes()
		results[i].LeadTime = &durasi
	}

	total := int64(len(results))
	return results, total, err
}

// GetValidasi2 mengambil batch yang menunggu validasi tahap 2 oleh Produksi setelah dikirim dari Warehouse.
// Menghitung status lead time berdasarkan threshold dari `tb_produk_alert`.
func GetValidasi2(db *gorm.DB) ([]models.ResponseStep, int64, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Select("tb_work_orders.*, tb_produk_alert.threshold_validasi_1_validasi_2 AS threshold").
		Joins("LEFT JOIN tb_produk ON tb_produk.kode_produk = tb_work_orders.kode_produk").
		Joins("LEFT JOIN tb_produk_alert ON tb_produk_alert.produk_id = tb_produk.id").
		Where("tanggal_kirim_val1 IS NOT NULL").
		Where("tanggal_terima_val2 IS NULL AND delete_status IS NULL").
		Order("tanggal_kirim_val1 ASC").
		Find(&results).Error

	var totalOver int64 = 0
	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].TanggalKirimVal1).Minutes()
		results[i].LeadTime = &durasi

		if results[i].Threshold != nil && durasi > *results[i].Threshold {
			results[i].StatusLead = "OVER"
			totalOver++
		} else {
			results[i].StatusLead = "OK"
		}
	}

	total := int64(len(results))
	return results, total, totalOver, err
}

// GetMixingTankCompounding mengambil batch yang siap untuk proses pencampuran (compounding).
// Kriteria Filter: Sudah divalidasi 2, namun belum dikirim ke proses compounding (`tanggal_kirim_compounding` NULL).
func GetMixingTankCompounding(db *gorm.DB) ([]models.ResponseStep, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Where("tanggal_terima_val2 IS NOT NULL").
		Where("tanggal_kirim_compounding IS NULL AND delete_status IS NULL").
		Order("tanggal_terima_val2 DESC").
		Find(&results).Error

	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].TanggalTerimaVal2).Minutes()
		results[i].LeadTime = &durasi
	}
	total := int64(len(results))
	return results, total, err

}

// GetTransferStorage menampilkan batch yang telah selesai compounding dan perlu ditransfer ke Storage Tank.
func GetTransferStorage(db *gorm.DB) ([]models.ResponseStep, int64, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Select("tb_work_orders.*, tb_produk_alert.threshold_validasi_2_start_compounding AS threshold").
		Joins("LEFT JOIN tb_produk ON tb_produk.kode_produk = tb_work_orders.kode_produk").
		Joins("LEFT JOIN tb_produk_alert ON tb_produk_alert.produk_id = tb_produk.id").
		Where("tanggal_kirim_compounding IS NOT NULL").
		Where("tanggal_kirim_ke_qc IS NULL AND delete_status IS NULL").
		Order("id DESC").
		Find(&results).Error

	var totalOver int64 = 0
	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].TanggalKirimCompounding).Minutes()
		results[i].LeadTime = &durasi

		if results[i].Threshold != nil && durasi > *results[i].Threshold {
			results[i].StatusLead = "OVER"
			totalOver++
		} else {
			results[i].StatusLead = "OK"
		}
	}
	total := int64(len(results))
	return results, total, totalOver, err
}

// GetQcTerimaSample digunakan untuk memonitor batch yang menunggu pengambilan/penerimaan sampel oleh QC.
// Kriteria Filter: Batch sudah dikirim ke QC atau sudah masuk storage tank, tetapi proses analisa QC belum dimulai.
func GetQcTerimaSample(db *gorm.DB) ([]models.ResponseStep, int64, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Select("tb_work_orders.*, tb_produk_alert.threshold_end_compounding_sampling_ruah").
		Joins("LEFT JOIN tb_produk ON tb_produk.kode_produk = tb_work_orders.kode_produk").
		Joins("LEFT JOIN tb_produk_alert ON tb_produk_alert.produk_id = tb_produk.id").
		Where("tanggal_kirim_ke_qc IS NOT NULL OR (storage_tank IS NOT NULL AND storage_tank != '')").
		Where("tanggal_qc_analisa IS NULL AND delete_status IS NULL").
		Order("tanggal_timbang ASC").
		Find(&results).Error

	var totalOver int64 = 0
	now := time.Now()
	for i := range results {
		if results[i].TanggalKirimKeQC != nil {
			durasi := now.Sub(*results[i].TanggalKirimKeQC).Minutes()
			results[i].LeadTime = &durasi

			if results[i].Threshold != nil && durasi > *results[i].Threshold {
				results[i].StatusLead = "OVER"
				totalOver++
			} else {
				results[i].StatusLead = "OK"
			}
		} else {
			results[i].StatusLead = "OK" // Adjust this string to match your business logic (e.g., "N/A", "WAITING")
		}
	}

	total := int64(len(results))
	return results, total, totalOver, err
}

// GetQcAnalisaComplete memonitor batch yang sedang dalam proses analisa QC.
// Filter: Analisa sudah dimulai (`tanggal_qc_analisa` NOT NULL), tapi belum selesai (`analisa_complete_date` NULL).
func GetQcAnalisaComplete(db *gorm.DB) ([]models.ResponseStep, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Where("tanggal_qc_analisa IS NOT NULL").
		Where("analisa_complete_date IS NULL AND delete_status IS NULL").
		Order("id DESC").
		Find(&results).Error

	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].TanggalQcAnalisa).Minutes()
		results[i].LeadTime = &durasi
	}
	total := int64(len(results))
	return results, total, err
}

// GetQcRelease memonitor batch yang analisanya sudah lengkap dan tinggal menunggu persetujuan (Release) QC.
func GetQcRelease(db *gorm.DB) ([]models.ResponseStep, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Where("analisa_complete_date IS NOT NULL").
		Where("qc_release_date IS NULL AND delete_status IS NULL").
		Order("updated_at DESC").
		Find(&results).Error

	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].AnalisaCompleteDate).Minutes()
		results[i].LeadTime = &durasi
	}
	total := int64(len(results))
	return results, total, err
}

// GetScanBarcodeStorage menampilkan batch yang sudah di-release QC dan menunggu pemindaian barcode fisik di tangki penyimpanan.
func GetScanBarcodeStorage(db *gorm.DB) ([]models.ResponseStep, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Where("qc_release_date IS NOT NULL").
		Where("tempel_label_release_date IS NULL AND kirim_ke_sample_fg IS NULL AND delete_status IS NULL").
		Order("id DESC").
		Find(&results).Error

	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].QcReleaseDate).Minutes()
		results[i].LeadTime = &durasi
	}

	total := int64(len(results))
	return results, total, err
}

// GetProduksiFilling mengambil data batch yang sedang dalam proses pengisian (filling).
// Arsitektur: Data dibagi menjadi dua kategori (Powder dan Liquid) dengan query terpisah berdasarkan `kode_produk` khusus.
func GetProduksiFilling(db *gorm.DB) (any, []int64, error) {
	var resultsPowder []models.ResponseStep
	var resultsLiquid []models.ResponseStep

	// 1. Tarik Data POWDER
	// Persis Laravel: kode produk spesifik, delete_status IS NULL, filling NOT NULL, sample_fg IS NULL, Order DESC
	err := db.Table("tb_work_orders").
		Where("kode_produk IN ?", []string{"PWSNH", "POSNA", "LEJOD", "LEJSE", "LEJOB", "LEJSD"}).
		Where("delete_status IS NULL").
		Where("kirim_ke_filling IS NOT NULL").
		Where("kirim_ke_sample_fg IS NULL").
		Order("kirim_ke_filling DESC").
		Find(&resultsPowder).Error
	if err != nil {
		return nil, nil, err
	}

	// 2. Tarik Data LIQUID
	// Persis Laravel: sample_fg NOT NULL, end_packaging IS NULL (Tanpa filter delete_status & tanpa Order By)
	err = db.Table("tb_work_orders").
		Where("kirim_ke_filling IS NOT NULL").
		Where("kirim_ke_sample_fg IS NULL").
		Order("kirim_ke_filling DESC").
		Limit(50).
		Find(&resultsLiquid).Error
	if err != nil {
		return nil, nil, err
	}

	now := time.Now()

	for i := range resultsPowder {
		if resultsPowder[i].KirimKeFilling != nil {
			durasi := now.Sub(*resultsPowder[i].KirimKeFilling).Minutes()
			resultsPowder[i].LeadTime = &durasi
		}
	}
	for i := range resultsLiquid {
		if resultsLiquid[i].KirimKeFilling != nil {
			durasi := now.Sub(*resultsLiquid[i].KirimKeFilling).Minutes()
			resultsLiquid[i].LeadTime = &durasi
		}
	}

	finalResults := map[string]any{
		"table_powder": resultsPowder,
		"table_liquid": resultsLiquid,
	}

	total := []int64{int64(len(resultsLiquid)), int64(len(resultsPowder))}

	return finalResults, total, nil
}

// GetSampleFG mengambil batch yang sedang menunggu proses pengambilan sampel Finish Good (FG).
func GetSampleFG(db *gorm.DB) ([]models.ResponseStep, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Where("kirim_ke_sample_fg IS NOT NULL").
		Where("kirim_ke_end_packaging IS NULL AND delete_status IS NULL").
		Find(&results).Error

	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].KirimKeSampleFG).Minutes()
		results[i].LeadTime = &durasi
	}
	total := int64(len(results))
	return results, total, err
}

// GetEndPackaging menampilkan daftar batch yang berada pada proses akhir pengemasan (End Packaging).
func GetEndPackaging(db *gorm.DB) ([]models.ResponseStep, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Where("kirim_ke_sample_fg IS NOT NULL AND kirim_ke_end_packaging IS NOT NULL").
		Where("(kirim_ke_serah_terima_bpp IS NULL) AND delete_status IS NULL").
		Order("kirim_ke_end_packaging DESC").
		Find(&results).Error

	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].KirimKeEndPackaging).Minutes()
		results[i].LeadTime = &durasi
	}
	total := int64(len(results))
	return results, total, err
}

// GetSerahTerimaBpp menampilkan batch yang dokumen fisiknya (BR/RAP) sedang diserahterimakan ke BPP.
func GetSerahTerimaBpp(db *gorm.DB) ([]models.ResponseStep, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Where("kirim_ke_serah_terima_bpp IS NOT NULL").
		Where("(setor_br_date IS NULL) AND terima_br_date IS NULL AND delete_status IS NULL").
		Order("kirim_ke_serah_terima_bpp ASC").
		Find(&results).Error

	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].KirimKeSerahTerimaBPP).Minutes()
		results[i].LeadTime = &durasi
	}
	total := int64(len(results))
	return results, total, err
}

// GetTerimaBR mengambil batch yang dokumen Batch Record (BR)-nya menunggu persetujuan (belum disetor sepenuhnya).
func GetTerimaBR(db *gorm.DB) ([]models.ResponseStep, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Where("setor_br_date IS NOT NULL").
		Where("terima_br_date IS NULL AND (status_setor_br IS NULL OR status_setor_br != 'done') AND delete_status IS NULL").
		Order("setor_br_date ASC").
		Find(&results).Error

	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].SetorBrDate).Minutes()
		results[i].LeadTime = &durasi
	}
	total := int64(len(results))
	return results, total, err
}

// GetTerimaRAP mengambil batch yang dokumen RAP-nya menunggu persetujuan.
func GetTerimaRAP(db *gorm.DB) ([]models.ResponseStep, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Where("setor_br_date IS NOT NULL").
		Where("terima_rap_date IS NULL AND (status_setor_rap IS NULL OR status_setor_rap != 'done') AND delete_status IS NULL").
		Order("setor_br_date ASC").
		Find(&results).Error

	now := time.Now()
	for i := range results {
		if results[i].SetorRapDate != nil {
			durasi := now.Sub(*results[i].SetorRapDate).Minutes()

			durasiVal := durasi
			results[i].LeadTime = &durasiVal
		}
	}
	total := int64(len(results))
	return results, total, err
}

// GetQaRilis memonitor batch yang menunggu QA Release sebelum bisa dikirim.
// Menghitung status apakah "approve" atau masih "waiting" berdasarkan penyelesaian BR dan RAP.
func GetQaRilis(db *gorm.DB) ([]models.ResponseStep, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Where("terima_br_date IS NOT NULL OR terima_rap_date IS NOT NULL").
		Where("qa_release_date IS NULL AND delete_status IS NULL").
		Select("tb_work_orders.*, CASE WHEN terima_br_date IS NOT NULL AND terima_rap_date IS NOT NULL THEN 'approve' ELSE 'waiting' END as status_qc_release").
		Order("updated_at DESC").
		Find(&results).Error

	now := time.Now()
	for i := range results {
		var durasiBr, durasiRap float64
		if results[i].TerimaBrDate != nil {
			durasiBr = now.Sub(*results[i].TerimaBrDate).Minutes()
		}

		if results[i].TerimaRapDate != nil {
			durasiRap = now.Sub(*results[i].TerimaRapDate).Minutes()
		}

		durasi := math.Max(durasiBr, durasiRap)
		results[i].LeadTime = &durasi
	}
	total := int64(len(results))
	return results, total, err
}

// GetShipment memonitor status batch yang siap dikirim atau sudah dikirim (shipment).
// Filter: Hanya batch yang sudah di-release oleh QA.
// Urutan data memisahkan yang sudah diterima dan yang masih dalam perjalanan.
func GetShipment(db *gorm.DB) ([]models.ResponseStep, int64, error) {
	var results []models.ResponseStep

	err := db.Table("tb_work_orders").
		Where("qa_release_date IS NOT NULL").
		Where("delete_status IS NULL").
		Order("CASE WHEN shipment_received_at IS NULL THEN 0 ELSE 1 END ASC").
		Order("CASE WHEN shipment_received_at IS NULL THEN qa_release_date END ASC").
		Order("CASE WHEN shipment_received_at IS NOT NULL THEN qa_release_date END DESC").Find(&results).Error

	now := time.Now()
	for i := range results {
		durasi := now.Sub(*results[i].QaReleaseDate).Minutes()
		results[i].LeadTime = &durasi

		if results[i].Threshold != nil && durasi > *results[i].Threshold {
			results[i].StatusLead = "OVER"
		} else {
			results[i].StatusLead = "OK"
		}
	}
	total := int64(len(results))
	return results, total, err
}
