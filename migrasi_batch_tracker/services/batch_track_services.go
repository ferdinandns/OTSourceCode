package services

import (
	"errors"
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/models"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// KirimPpicService memindahkan data batch dari status PPIC ke Produksi (aktif di Work Order).
// Fungsi ini menandai dimulainya cycle time untuk sebuah batch.
// Arsitektur:
// - Menggunakan transaksi database (tx) untuk menjaga konsistensi data antara tabel SheetPPIC, WorkOrders, AuditTrail, CreatedBy, dan Keterangan.
// - Jika satu operasi gagal (misal gagal insert ke AuditTrail), seluruh proses akan di-rollback.
func KirimPpicService(db *gorm.DB, req models.Request, userID uint, userNama string, userArea string, userIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var dataPpic []models.SheetPPIC

		var nowTime = time.Now().Truncate(time.Second)

		if err := tx.Where("id IN (?)", req.Id).Find(&dataPpic).Error; err != nil {
			return err
		}

		if len(dataPpic) == 0 {
			return errors.New("Tidak ada WO yang dipilih.")
		}

		var workOrder []models.WorkOrders
		var auditLog []models.AuditTrail

		for _, ppic := range dataPpic {
			workOrder = append(workOrder, models.WorkOrders{
				PpicSubmitDate:  &nowTime,
				NoBatch:         ppic.NoBatch,
				NoWoRuah:        ppic.NoWoRuah,
				NoWoKemas:       ppic.NoWoKemas,
				KodeProduk:      ppic.KodeProduk,
				KodeRuah:        ppic.RecipeRuah[:5],
				TanggalWO:       ppic.TanggalCWO,
				StorageTank:     nil,
				MixingTank:      nil,
				MesinFilling:    nil,
				NoBatchSetorBR:  nil,
				NoBatchSetorRAP: nil,
				StatusSetorBR:   nil,
				StatusSetorRAP:  nil,
				DeleteStatus:    nil,
			})
		}

		if err := tx.Create(&workOrder).Error; err != nil {
			return err
		}

		err := tx.Model(&models.SheetPPIC{}).
			Where("id IN (?)", req.Id).
			Update("delete_status", "has submit").Error
		if err != nil {
			return err
		}

		var listCreatedBy []models.CreatedBy
		var listKeterangan []models.Keterangan

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		for _, batch := range workOrder {
			auditLog = append(auditLog, models.AuditTrail{
				Id:       userID,
				Tanggal:  nowTime,
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: userIP,
				Nama:     userNama,
				Area:     userArea,
				Kegiatan: userNama + " mengirim Batch dan memulai Cycle Time. " +
					"[1] Kode Ruah : " + batch.KodeRuah +
					" [2] Kode Produk : " + batch.KodeProduk +
					" [3] No Batch : " + batch.NoBatch,
			})

			woID := batch.Id
			uID := userID
			ket := teksKet

			listCreatedBy = append(listCreatedBy, models.CreatedBy{
				Id:      &woID,
				KirimBy: &uID,
			})

			listKeterangan = append(listKeterangan, models.Keterangan{
				Wo_id:    int(woID),
				Ppic_ket: &ket,
			})
		}

		if err := tx.Create(&auditLog).Error; err != nil {
			return err
		}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"kirim_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"ppic_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// PotongStockService menandai batch yang materialnya sudah dipotong stoknya di sistem (misal SAP/ERP).
// Fungsi ini memperbarui tabel WorkOrders dan mencatat aksi user ke dalam AuditTrail.
// Arsitektur:
// - Beroperasi dalam block transaksi DB.
// - Menangani multiple batch ID sekaligus (bulk update) menggunakan operasi klausa IN pada SQL.
// - Menggunakan on-conflict/upsert klausa untuk tabel CreatedBy dan Keterangan guna menghindari duplikasi log.
func PotongStockService(db *gorm.DB, req models.NextRequest, userID uint, userNama string, userArea string, userIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var nowTime = time.Now().Truncate(time.Second)

		var dataBatch []models.WorkOrders
		if err := tx.Where("id IN (?)", req.Id).Find(&dataBatch).Error; err != nil {
			return err
		}

		var batchID []uint
		var audit []models.AuditTrail
		for _, batch := range dataBatch {
			batchID = append(batchID, batch.Id)

			audit = append(audit, models.AuditTrail{
				Id:       userID,
				Tanggal:  nowTime,
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: userIP,
				Nama:     userNama,
				Area:     userArea,
				Kegiatan: userNama + " melakukan Potong Stock." +
					" [1] Kode Ruah : " + batch.KodeRuah +
					" [2] Kode Produk : " + batch.KodeProduk +
					" [3] No Batch : " + batch.NoBatch,
			})
		}

		if err := tx.Create(&audit).Error; err != nil {
			return err
		}

		result := tx.Model(&models.WorkOrders{}).
			Where("id IN (?)", batchID).
			Updates(map[string]any{
				"tanggal_potong_stock": nowTime,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		var listCreatedBy []models.CreatedBy
		var listKeterangan []models.Keterangan

		for _, id := range batchID {
			woID := id
			uID := userID
			ket := teksKet

			listCreatedBy = append(listCreatedBy, models.CreatedBy{
				Id:            &woID,
				PotongStockBy: &uID,
			})

			listKeterangan = append(listKeterangan, models.Keterangan{
				Wo_id:            int(woID),
				Potong_stock_ket: &ket,
			})
		}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"potong_stock_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"potong_stock_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// TimbangService mensinkronisasi data dari sistem timbangan (weightrack) dengan aplikasi batch tracker.
// Arsitektur:
// - Berinteraksi dengan dua instance database yang berbeda: dbWeightrack (sumber data eksternal) dan dbApp (database lokal aplikasi).
// - Membaca "label biru" dari weightrack, mencocokkan nomor batch (termasuk ekspansi sub-batch jika ada).
// - Melakukan update massal pada WorkOrders yang cocok dan mencatat batch yang tidak ditemukan (NotFoundBatches).
func TimbangService(dbWeightrack *gorm.DB, dbApp *gorm.DB) (models.TimbangResponse, error) {
	var response models.TimbangResponse
	var labels []models.LabelBiruResult

	err := dbWeightrack.Table("tb_label_biru").
		Select("kode_produk, batch_no, MIN(CONCAT(tanggal, ' ', waktu)) as first_time").
		Group("kode_produk, batch_no").
		Scan(&labels).Error

	if err != nil {
		return response, err
	}

	response.TotalLabels = len(labels)

	err = dbApp.Transaction(func(tx *gorm.DB) error {
		for _, lb := range labels {
			batches := helpers.ExpandBatch(lb.BatchNo)
			if len(batches) == 0 {
				continue
			}

			var foundBatches []string
			tx.Table("tb_work_orders").
				Where("kode_ruah = ? AND no_batch IN (?)", lb.KodeProduk, batches).
				Pluck("no_batch", &foundBatches)

			missing := helpers.FindMissingBatches(batches, foundBatches)
			if len(missing) > 0 {
				response.NotFoundBatches = append(response.NotFoundBatches, models.NotFoundBatch{
					KodeProduk: lb.KodeProduk,
					BatchNo:    lb.BatchNo,
					Expanded:   batches,
					Missing:    missing,
				})
			}

			if len(foundBatches) > 0 {
				parsedTime, parseErr := time.Parse("2006-01-02 15:04:05", lb.FirstTime)
				if parseErr != nil {
					parsedTime = time.Now().Truncate(time.Second)
				}

				tx.Table("tb_work_orders").
					Where("kode_ruah = ? AND no_batch IN (?)", lb.KodeProduk, foundBatches).
					Where("tanggal_timbang IS NULL").
					Updates(map[string]interface{}{
						"tanggal_timbang": parsedTime,
						"updated_at":      time.Now().Truncate(time.Second),
					})
			}
		}
		return nil
	})

	return response, err
}

// WhValidasi1Service digunakan oleh tim Warehouse (WH) untuk memvalidasi bahwa bahan baku siap dan telah ditimbang.
// Status batch maju ke tahap validasi pertama.
// Proses mencakup pembaruan tanggal validasi di tb_work_orders, penambahan audit trail, dan log aktor di tabel created_by.
func WhValidasi1Service(db *gorm.DB, id []uint, userID uint, userNama string, userArea string, userIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var dataBatch []models.WorkOrders
		if err := tx.Where("id IN (?)", id).Find(&dataBatch).Error; err != nil {
			return err
		}
		var nowTime = time.Now().Truncate(time.Second)

		var batchID []uint
		var audit []models.AuditTrail
		for _, batch := range dataBatch {
			batchID = append(batchID, batch.Id)

			audit = append(audit, models.AuditTrail{
				Id:       userID,
				Tanggal:  nowTime,
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: userIP,
				Nama:     userNama,
				Area:     userArea,
				Kegiatan: userNama + " melakukan Validasi." +
					" [1] Kode Ruah : " + batch.KodeRuah +
					" [2] Kode Produk : " + batch.KodeProduk +
					" [3] No Batch : " + batch.NoBatch,
			})
		}

		if err := tx.Create(&audit).Error; err != nil {
			return err
		}

		result := tx.Model(&models.WorkOrders{}).
			Where("id IN (?)", batchID).
			Updates(map[string]any{
				"tanggal_kirim_val1": nowTime,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		var listCreatedBy []models.CreatedBy
		for _, bID := range batchID {
			woID := bID
			uID := userID
			listCreatedBy = append(listCreatedBy, models.CreatedBy{
				Id:        &woID,
				TimbangBy: &uID,
			})
		}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"timbang_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		return nil
	})
}

// PrValidasi2Service digunakan oleh tim Produksi (PR) untuk menerima bahan baku dari Warehouse.
// Merupakan validasi kedua sebelum proses compounding dimulai.
// Pembaruan dilakukan secara massal pada tb_work_orders berdasarkan array ID yang diberikan.
func PrValidasi2Service(db *gorm.DB, req models.NextRequest) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var dataBatch []models.WorkOrders
		var nowTime = time.Now().Truncate(time.Second)

		if err := tx.Where("id IN (?)", req.Id).Find(&dataBatch).Error; err != nil {
			return err
		}

		var batchID []uint
		for _, batch := range dataBatch {
			batchID = append(batchID, batch.Id)
		}

		result := tx.Model(&models.WorkOrders{}).
			Where("id IN (?)", batchID).
			Updates(map[string]any{
				"tanggal_terima_val2": nowTime,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		var listKeterangan []models.Keterangan
		for _, bID := range batchID {
			ket := teksKet
			listKeterangan = append(listKeterangan, models.Keterangan{
				Wo_id:                  int(bID),
				Produksi_validasi2_ket: &ket,
			})
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"produksi_validasi2_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// PrCompoundingService menandai dimulainya proses pencampuran (compounding) oleh Produksi.
// Mengubah status batch dan mengalokasikannya ke Mixing Tank tertentu.
// Arsitektur:
// - Mengecek eksistensi Mixing Tank yang dipilih.
// - Menulis log aktivitas lengkap termasuk nama tank ke dalam AuditTrail.
func PrCompoundingService(db *gorm.DB, req models.TankRequest, userID uint, userNama string, userArea string, userIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var mixingTank models.MixingTank
		if err := tx.First(&mixingTank, req.TankID).Error; err != nil {
			return err
		}

		var dataBatch models.WorkOrders
		if err := tx.First(&dataBatch, req.Id).Error; err != nil {
			return err
		}

		var nowTime = time.Now().Truncate(time.Second)

		audit := models.AuditTrail{
			Id:       userID,
			Tanggal:  nowTime,
			Jam:      time.Now().Format("15:04:05"),
			AlamatIP: userIP,
			Nama:     userNama,
			Area:     userArea,
			Kegiatan: userNama + " memilih Mixing Tank dan melakukan Compounding." +
				" [1] Kode Ruah : " + dataBatch.KodeRuah +
				" [2] Kode Produk : " + dataBatch.KodeProduk +
				" [3] No Batch : " + dataBatch.NoBatch +
				" [4] Mixing Tank : " + mixingTank.Nama,
		}
		result := tx.Model(&dataBatch).
			Updates(map[string]any{
				"tanggal_kirim_compounding": nowTime,
				"mixing_tank":               mixingTank.Nama,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		if err := tx.Create(&audit).Error; err != nil {
			return err
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		woID := dataBatch.Id
		uID := userID
		ket := teksKet

		listCreatedBy := []models.CreatedBy{{
			Id:            &woID,
			CompoundingBy: &uID,
		}}

		listKeterangan := []models.Keterangan{{
			Wo_id:                       int(woID),
			Compounding_mixing_tank_ket: &ket,
		}}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"compounding_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"compounding_mixing_tank_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// TftoStorageService menangani transisi transfer hasil compounding ke Storage Tank.
// Setelah ditransfer, status batch berubah menjadi menunggu pemeriksaan QC (Kirim ke QC).
// Arsitektur:
// - Memastikan Storage Tank yang diminta tersedia.
// - Update tb_work_orders, tb_audit_trail, tb_created_by, tb_keterangan secara atomic (transaksional).
func TftoStorageService(db *gorm.DB, req models.TankRequest, userID uint, userNama string, userArea string, userIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var storageTank models.StorageTank
		if err := tx.First(&storageTank, req.TankID).Error; err != nil {
			return err
		}

		var dataBatch models.WorkOrders
		if err := tx.First(&dataBatch, req.Id).Error; err != nil {
			return err
		}

		var nowTime = time.Now().Truncate(time.Second)

		audit := models.AuditTrail{
			Id:       userID,
			Tanggal:  nowTime,
			Jam:      time.Now().Format("15:04:05"),
			AlamatIP: userIP,
			Nama:     userNama,
			Area:     userArea,
			Kegiatan: userNama + " melakukan Transfer ke Storage Tank." +
				" [1] Kode Ruah : " + dataBatch.KodeRuah +
				" [2] Kode Produk : " + dataBatch.KodeProduk +
				" [3] No Batch : " + dataBatch.NoBatch +
				" [4] Storage Tank : " + storageTank.KodeTank,
		}
		if err := tx.Create(&audit).Error; err != nil {
			return err
		}

		result := tx.Model(&dataBatch).
			Updates(map[string]any{
				"tanggal_kirim_ke_qc": nowTime,
				"storage_tank":        storageTank.KodeTank,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		woID := dataBatch.Id
		uID := userID
		ket := teksKet

		listCreatedBy := []models.CreatedBy{{
			Id:          &woID,
			KirimKeQCBy: &uID,
		}}

		listKeterangan := []models.Keterangan{{
			Wo_id:          int(woID),
			Tf_storage_ket: &ket,
		}}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"kirim_ke_qc_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"tf_storage_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// QcAnalisaService mencatat kapan tim QC mulai melakukan analisis sampel dari batch.
// Menambahkan sample number dari request text ke tabel QcData dan memperbarui tb_work_orders.
func QcAnalisaService(db *gorm.DB, req models.TextInputRequest, userID uint, userNama string, userArea string, userIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var dataBatch []models.WorkOrders
		if err := tx.Where("id IN (?)", req.Id).Find(&dataBatch).Error; err != nil {
			return err
		}

		var nowTime = time.Now().Truncate(time.Second)

		var batchID []uint
		var audit []models.AuditTrail
		for _, batch := range dataBatch {
			batchID = append(batchID, batch.Id)

			audit = append(audit, models.AuditTrail{
				Id:       userID,
				Tanggal:  nowTime,
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: userIP,
				Nama:     userNama,
				Area:     userArea,
				Kegiatan: userNama + " melakukan Analisa." +
					" [1] Kode Ruah : " + batch.KodeRuah +
					" [2] Kode Produk : " + batch.KodeProduk +
					" [3] No Batch : " + batch.NoBatch,
			})
		}

		if err := tx.Create(&audit).Error; err != nil {
			return err
		}

		result := tx.Model(&models.WorkOrders{}).
			Where("id IN (?)", batchID).
			Updates(map[string]any{
				"tanggal_qc_analisa": nowTime,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		qcData := tx.Model(&models.QcData{}).
			Where("id_wo IN (?)", batchID).
			Updates(map[string]any{
				"sample_number": req.Text,
			})
		if qcData.RowsAffected == 0 {
			return qcData.Error
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		var listCreatedBy []models.CreatedBy
		var listKeterangan []models.Keterangan

		for _, id := range batchID {
			woID := id
			uID := userID
			ket := teksKet

			listCreatedBy = append(listCreatedBy, models.CreatedBy{
				Id:          &woID,
				QcAnalisaBy: &uID,
			})

			listKeterangan = append(listKeterangan, models.Keterangan{
				Wo_id:                int(woID),
				Qc_terima_sample_ket: &ket,
			})
		}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"qc_analisa_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"qc_terima_sample_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// QcReleaseKirimService dipanggil ketika QC telah selesai menganalisa sampel dan meloloskan (release) produk ruah.
// Kondisi pengamanan: batch hanya diproses jika `tanggal_qc_analisa` tidak null dan `analisa_complete_date` masih null.
func QcReleaseKirimService(db *gorm.DB, req models.NextRequest, userID uint, userNama string, userArea string, userIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var dataBatch []models.WorkOrders
		if err := tx.Where("id IN (?) AND tanggal_qc_analisa IS NOT NULL AND analisa_complete_date IS NULL", req.Id).
			Find(&dataBatch).Error; err != nil {
			return err
		}

		var nowTime = time.Now().Truncate(time.Second)
		var nowString = time.Now().Format("02-01-2006 15:04:05")

		var batchID []uint
		var audit []models.AuditTrail
		for _, batch := range dataBatch {
			batchID = append(batchID, batch.Id)

			audit = append(audit, models.AuditTrail{
				Id:       userID,
				Tanggal:  nowTime,
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: userIP,
				Nama:     userNama,
				Area:     userArea,
				Kegiatan: userNama + " selesai melakukan Analisa. Analisa Complete" +
					" [1] Kode Ruah : " + batch.KodeRuah +
					" [2] Kode Produk : " + batch.KodeProduk +
					" [3] No Batch : " + batch.NoBatch +
					" [4] Tanggal Release : " + nowString,
			})
		}

		if err := tx.Create(&audit).Error; err != nil {
			return err
		}

		result := tx.Model(&models.WorkOrders{}).
			Where("id IN (?)", batchID).
			Updates(map[string]any{
				"analisa_complete_date": nowTime,
				"updated_at":            nowTime,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		var listCreatedBy []models.CreatedBy
		var listKeterangan []models.Keterangan

		for _, id := range batchID {
			woID := id
			uID := userID
			ket := teksKet

			listCreatedBy = append(listCreatedBy, models.CreatedBy{
				Id:                 &woID,
				QcAnalisCompleteBy: &uID,
			})

			listKeterangan = append(listKeterangan, models.Keterangan{
				Wo_id:                   int(woID),
				Qc_analisa_complete_ket: &ket,
			})
		}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"qc_analis_complete_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"qc_analisa_complete_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// KirimKeScanBarcodeService mengatur pergerakan status produk dari QC Release menuju proses scanning barcode dan filling mesin.
// Tahapan ini krusial untuk melacak perpindahan barang fisik ke area pengemasan.
func KirimKeScanBarcodeService(db *gorm.DB, req models.NextRequest, userID uint, userNama string, userArea string, userIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var dataBatch []models.WorkOrders
		if err := tx.Where("id IN (?)", req.Id).
			Find(&dataBatch).Error; err != nil {
			return err
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		var nowTime = time.Now().Truncate(time.Second)

		result := tx.Model(&dataBatch).
			Updates(map[string]any{
				"qc_release_date": nowTime,
				"updated_at":      nowTime,
				"keterangan_qc":   teksKet,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		var listCreatedBy []models.CreatedBy
		var listKeterangan []models.Keterangan

		for _, batch := range dataBatch {
			audit := models.AuditTrail{
				Id:       userID,
				Tanggal:  nowTime,
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: userIP,
				Nama:     userNama,
				Area:     userArea,
				Kegiatan: userNama + " melakukan QC Release." +
					" [1] Kode Ruah : " + batch.KodeRuah +
					" [2] Kode Produk : " + batch.KodeProduk +
					" [3] No Batch : " + batch.NoBatch +
					" [4] Keterangan : " + teksKet,
			}
			if err := tx.Create(&audit).Error; err != nil {
				return err
			}

			woID := batch.Id
			uID := userID
			ket := teksKet

			listCreatedBy = append(listCreatedBy, models.CreatedBy{
				Id:          &woID,
				QcReleaseBy: &uID,
			})

			listKeterangan = append(listKeterangan, models.Keterangan{
				Wo_id:          int(woID),
				Qc_release_ket: &ket,
			})
		}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"qc_release_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"qc_release_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// ScanStorageService digunakan saat batch akan meninggalkan area penyimpanan sementara (Storage Tank).
// Validasi ketat dilakukan dengan mencocokkan input barcode terhadap data `storage_tank` di tb_work_orders.
func ScanStorageService(db *gorm.DB, req models.TextInputRequest, userID uint, userNama string, userArea string, userIP string) error {
	if len(req.Text) == 0 || strings.TrimSpace(req.Text) == "" {
		return errors.New("Kolom barcode kosong.")
	}
	barcode := strings.TrimSpace(req.Text)

	return db.Transaction(func(tx *gorm.DB) error {
		var dataBatch models.WorkOrders
		if err := tx.First(&dataBatch, req.Id).Error; err != nil {
			return err
		}

		if dataBatch.AnalisaCompleteDate == nil {
			return errors.New("Batch belum di-release dari QC.")
		}

		storageTank := strings.TrimSpace(*dataBatch.StorageTank)
		if !strings.EqualFold(barcode, storageTank) {
			return errors.New("Scan tidak cocok dengan Storage Tank.")
		}

		var nowTime = time.Now().Truncate(time.Second)

		result := tx.Model(&dataBatch).
			Updates(map[string]any{
				"tempel_label_release_date": nowTime,
				"kirim_ke_filling":          nowTime,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		audit := models.AuditTrail{
			Id:       userID,
			Tanggal:  nowTime,
			Jam:      time.Now().Format("15:04:05"),
			AlamatIP: userIP,
			Nama:     userNama,
			Area:     userArea,
			Kegiatan: userNama + " melakukan Scan Storage." +
				" [1] Kode Ruah : " + dataBatch.KodeRuah +
				" [2] Kode Produk : " + dataBatch.KodeProduk +
				" [3] No Batch : " + dataBatch.NoBatch +
				" [4] Storage Tank : " + storageTank,
		}
		if err := tx.Create(&audit).Error; err != nil {
			return err
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		woID := dataBatch.Id
		uID := userID
		ket := teksKet

		listCreatedBy := []models.CreatedBy{{
			Id:               &woID,
			ScanStorageBy:    &uID,
			KirimKeFillingBy: &uID,
		}}

		listKeterangan := []models.Keterangan{{
			Wo_id:                    int(woID),
			Scan_barcode_storage_ket: &ket,
		}}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"scan_storage_by", "kirim_ke_filling_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"scan_barcode_storage_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// KirimKeSampleFGService mengalokasikan batch ke Mesin Filling tertentu.
// Status batch berubah menjadi menunggu proses pengambilan sampel Finish Good (Sample FG).
func KirimKeSampleFGService(db *gorm.DB, req models.TextInputRequest) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var dataBatch models.WorkOrders
		if err := tx.First(&dataBatch, req.Id).Error; err != nil {
			return err
		}

		if len(req.Text) == 0 || strings.TrimSpace(req.Text) == "" {
			return errors.New("Mesin filling belum dipilih")
		}

		var nowTime = time.Now().Truncate(time.Second)

		result := tx.Model(&dataBatch).
			Updates(map[string]any{
				"mesin_filling":      req.Text,
				"kirim_ke_sample_fg": nowTime,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		woID := dataBatch.Id
		ket := teksKet

		listKeterangan := []models.Keterangan{{
			Wo_id:                       int(woID),
			Produksi_filling_powder_ket: &ket,
		}}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"produksi_filling_powder_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// KirimKeEndPackagingDariSampleFGService mengarahkan batch dari area sampel FG ke proses akhir pengemasan (End Packaging).
// Arsitektur: Melibatkan update pada entitas WorkOrders, AuditTrail, CreatedBy, dan Keterangan.
func KirimKeEndPackagingDariSampleFGService(db *gorm.DB, req models.NextRequest, userID uint, userNama string, userArea string, userIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var dataBatch []models.WorkOrders
		if err := tx.Where("id IN (?)", req.Id).
			Find(&dataBatch).Error; err != nil {
			return err
		}

		var nowTime = time.Now().Truncate(time.Second)

		var batchID []uint
		var audit []models.AuditTrail
		for _, batch := range dataBatch {
			batchID = append(batchID, batch.Id)

			audit = append(audit, models.AuditTrail{
				Id:       userID,
				Tanggal:  nowTime,
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: userIP,
				Nama:     userNama,
				Area:     userArea,
				Kegiatan: userNama + " mengirim Batch ke End Packaging." +
					" [1] Kode Ruah : " + batch.KodeRuah +
					" [2] Kode Produk : " + batch.KodeProduk +
					" [3] No Batch : " + batch.NoBatch,
			})
		}

		if err := tx.Create(&audit).Error; err != nil {
			return err
		}

		result := tx.Model(&models.WorkOrders{}).
			Where("id IN (?)", batchID).
			Updates(map[string]any{
				"kirim_ke_end_packaging": nowTime,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		var listCreatedBy []models.CreatedBy
		var listKeterangan []models.Keterangan

		for _, id := range batchID {
			woID := id
			uID := userID
			ket := teksKet

			listCreatedBy = append(listCreatedBy, models.CreatedBy{
				Id:          &woID,
				PackagingBy: &uID,
			})

			listKeterangan = append(listKeterangan, models.Keterangan{
				Wo_id:         int(woID),
				Sample_fg_ket: &ket,
			})
		}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"packaging_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"sample_fg_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// ScanEndPackagingService adalah validasi dengan memindai barcode fisik WO Ruah sebelum dikirim untuk serah terima BPP.
// Arsitektur:
// - Menggunakan regex untuk mengekstrak nomor WO Ruah dari format barcode penuh (misalnya `PP-0000000000-`).
// - Menyimpan `barcode_full` dan men-trigger status pindah ke serah terima BPP.
func ScanEndPackagingService(db *gorm.DB, req models.TextInputRequest, userID uint, userNama string, userArea string, userIP string) error {
	if len(req.Text) == 0 || strings.TrimSpace(req.Text) == "" {
		return errors.New("Kolom barcode kosong.")
	}
	barcode := strings.TrimSpace(req.Text)

	return db.Transaction(func(tx *gorm.DB) error {
		var dataBatch models.WorkOrders
		if err := tx.Where("id = ? AND kirim_ke_end_packaging IS NOT NULL AND kirim_ke_serah_terima_bpp IS NULL", req.Id).
			First(&dataBatch, req.Id).Error; err != nil {
			return err
		}

		var woRuahScan string
		if regexp.MustCompile(`^\d+$`).MatchString(barcode) {
			woRuahScan = barcode
		} else if regexp.MustCompile(`^PP-\d{10}$-`).MatchString(barcode) {
			matches := regexp.MustCompile(`^PP-\d{10}$-`).FindStringSubmatch(barcode)
			woRuahScan = matches[1]
		}

		if woRuahScan == "" || len(woRuahScan) == 0 || strings.TrimSpace(woRuahScan) == "" {
			return errors.New("Format barcode tidak valid")
		}

		if !strings.EqualFold(woRuahScan, dataBatch.NoWoRuah) {
			return errors.New("Barcode tidak cocok dengan No WO Ruah.")
		}

		var nowTime = time.Now().Truncate(time.Second)

		result := tx.Model(&dataBatch).
			Updates(map[string]any{
				"kirim_ke_serah_terima_bpp": nowTime,
				"barcode_full":              barcode,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		var nowString = time.Now().Format("02-01-2006 15:04:05")

		audit := models.AuditTrail{
			Id:       userID,
			Tanggal:  nowTime,
			Jam:      time.Now().Format("15:04:05"),
			AlamatIP: userIP,
			Nama:     userNama,
			Area:     userArea,
			Kegiatan: userNama + " melakukan Scan Storage." +
				" [1] Kode Ruah : " + dataBatch.KodeRuah +
				" [2] Kode Produk : " + dataBatch.KodeProduk +
				" [3] No Batch : " + dataBatch.NoBatch +
				" [4] No WO Ruah : " + dataBatch.NoWoRuah +
				" [5] Barcode Full : " + barcode +
				" [6] Tanggal Scan : " + nowString,
		}
		if err := tx.Create(&audit).Error; err != nil {
			return err
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		woID := dataBatch.Id
		uID := userID
		ket := teksKet

		listCreatedBy := []models.CreatedBy{{
			Id:               &woID,
			SerahTerimaBppBy: &uID,
		}}

		listKeterangan := []models.Keterangan{{
			Wo_id:             int(woID),
			End_packaging_ket: &ket,
		}}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"serah_terima_bpp_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"end_packaging_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// ScanSerahTerimaBppService menandakan dimulainya serah terima dokumen Batch Record (BR) ke BPP.
func ScanSerahTerimaBppService(db *gorm.DB, req models.NextRequest, userID uint, userNama string, userArea string, userIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var dataBatch models.WorkOrders
		if err := tx.Find(&dataBatch, req.Id).Error; err != nil {
			return err
		}

		var nowTime = time.Now().Truncate(time.Second)

		result := tx.Model(&dataBatch).
			Updates(map[string]any{
				"setor_br_date": nowTime,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		audit := models.AuditTrail{
			Id:       userID,
			Tanggal:  nowTime,
			Jam:      time.Now().Format("15:04:05"),
			AlamatIP: userIP,
			Nama:     userNama,
			Area:     userArea,
			Kegiatan: userNama + " melakukan Scan Serah Terima BPP." +
				" [1] Kode Ruah : " + dataBatch.KodeRuah +
				" [2] Kode Produk : " + dataBatch.KodeProduk +
				" [3] No Batch : " + dataBatch.NoBatch +
				" [4] No WO Ruah : " + dataBatch.NoWoRuah,
		}
		if err := tx.Create(&audit).Error; err != nil {
			return err
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		woID := dataBatch.Id
		uID := userID
		ket := teksKet

		listCreatedBy := []models.CreatedBy{{
			Id:        &woID,
			SetorBrBy: &uID,
		}}

		listKeterangan := []models.Keterangan{{
			Wo_id:                int(woID),
			Serah_terima_bpp_ket: &ket,
		}}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"setor_br_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"serah_terima_bpp_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// SetorBrCompleteService mengkonfirmasi bahwa dokumen Batch Record (BR) telah selesai disetor.
// Status pada tb_work_orders untuk BR diubah menjadi "done". Tanggal setor RAP juga dimulai pada tahap ini.
func SetorBrCompleteService(db *gorm.DB, req models.NextRequest, userID uint, userNama string, userArea string, userIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var dataBatch []models.WorkOrders
		if err := tx.Where("id IN (?)", req.Id).
			Find(&dataBatch).Error; err != nil {
			return err
		}

		var nowTime = time.Now().Truncate(time.Second)

		var batchID []uint
		var audit []models.AuditTrail
		for _, batch := range dataBatch {
			batchID = append(batchID, batch.Id)

			audit = append(audit, models.AuditTrail{
				Id:       userID,
				Tanggal:  nowTime,
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: userIP,
				Nama:     userNama,
				Area:     userArea,
				Kegiatan: userNama + " Terima BR Complete." +
					" [1] Kode Ruah : " + batch.KodeRuah +
					" [2] Kode Produk : " + batch.KodeProduk +
					" [3] No Batch : " + batch.NoBatch +
					" [4] No WO Ruah : " + batch.NoWoRuah,
			})
		}

		if err := tx.Create(&audit).Error; err != nil {
			return err
		}

		result := tx.Model(&models.WorkOrders{}).
			Where("id IN (?)", batchID).
			Updates(map[string]any{
				"terima_br_date":    nowTime,
				"setor_rap_date":    nowTime,
				"updated_at":        nowTime,
				"no_batch_setor_br": gorm.Expr("no_batch"),
				"status_setor_br":   "done",
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		var listCreatedBy []models.CreatedBy
		var listKeterangan []models.Keterangan

		for _, id := range batchID {
			woID := id
			uID := userID
			ket := teksKet

			listCreatedBy = append(listCreatedBy, models.CreatedBy{
				Id:         &woID,
				TerimaBrBy: &uID,
				SetorRapBy: &uID,
			})

			listKeterangan = append(listKeterangan, models.Keterangan{
				Wo_id:         int(woID),
				Terima_br_ket: &ket,
			})
		}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"terima_br_by", "setor_rap_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"terima_br_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// SetorRapCompleteService mengkonfirmasi penyetoran dokumen RAP.
// Pada titik ini, dokumen BR dan RAP telah diselesaikan.
func SetorRapCompleteService(db *gorm.DB, req models.NextRequest, userID uint, userNama string, userArea string, userIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var dataBatch []models.WorkOrders
		if err := tx.Where("id IN (?)", req.Id).
			Find(&dataBatch).Error; err != nil {
			return err
		}

		var nowTime = time.Now().Truncate(time.Second)

		var batchID []uint
		var audit []models.AuditTrail
		for _, batch := range dataBatch {
			batchID = append(batchID, batch.Id)

			audit = append(audit, models.AuditTrail{
				Id:       userID,
				Tanggal:  nowTime,
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: userIP,
				Nama:     userNama,
				Area:     userArea,
				Kegiatan: userNama + " menyelesaikan Terima RAP." +
					" [1] Kode Ruah : " + batch.KodeRuah +
					" [2] Kode Produk : " + batch.KodeProduk +
					" [3] No Batch : " + batch.NoBatch +
					" [4] No WO Ruah : " + batch.NoWoRuah +
					" [5] Status RAP : " + "done ",
			})
		}

		if err := tx.Create(&audit).Error; err != nil {
			return err
		}

		result := tx.Model(&models.WorkOrders{}).
			Where("id IN (?)", batchID).
			Updates(map[string]any{
				"terima_rap_date":    nowTime,
				"no_batch_setor_rap": gorm.Expr("no_batch"),
				"status_setor_rap":   "done",
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		var listCreatedBy []models.CreatedBy
		var listKeterangan []models.Keterangan

		for _, id := range batchID {
			woID := id
			uID := userID
			ket := teksKet

			listCreatedBy = append(listCreatedBy, models.CreatedBy{
				Id:          &woID,
				TerimaRapBy: &uID,
			})

			listKeterangan = append(listKeterangan, models.Keterangan{
				Wo_id:          int(woID),
				Terima_rap_ket: &ket,
			})
		}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"terima_rap_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"terima_rap_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// SendToShipmentService adalah tahap akhir persetujuan QA (QA Release) sebelum produk dikirim.
// Fungsi memvalidasi bahwa BR dan RAP sudah disetujui (`status_setor_br` dan `status_setor_rap` tidak null).
// Jika lolos, status QC Release diubah menjadi "released".
func SendToShipmentService(db *gorm.DB, req models.NextRequest, userID uint, userNama string, userArea string, userIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var dataBatch []models.WorkOrders
		if err := tx.Where("status_setor_br IS NOT NULL AND status_setor_rap IS NOT NULL AND id IN (?)", req.Id).
			Find(&dataBatch).Error; err != nil {
			return errors.New("Batch belum di approve BR dan RAP.")
		}

		var nowTime = time.Now().Truncate(time.Second)

		var batchID []uint
		var audit []models.AuditTrail
		for _, batch := range dataBatch {
			batchID = append(batchID, batch.Id)

			audit = append(audit, models.AuditTrail{
				Id:       userID,
				Tanggal:  nowTime,
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: userIP,
				Nama:     userNama,
				Area:     userArea,
				Kegiatan: userNama + " melakukan QA Release." +
					" [1] Kode Ruah : " + batch.KodeRuah +
					" [2] Kode Produk : " + batch.KodeProduk +
					" [3] No Batch : " + batch.NoBatch +
					" [4] No WO Ruah : " + batch.NoWoRuah,
			})
		}

		if err := tx.Create(&audit).Error; err != nil {
			return err
		}

		result := tx.Model(&models.WorkOrders{}).
			Where("id IN (?)", batchID).
			Updates(map[string]any{
				"qa_release_date":   nowTime,
				"status_qc_release": "released",
				"updated_at":        nowTime,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		var listCreatedBy []models.CreatedBy
		var listKeterangan []models.Keterangan

		for _, id := range batchID {
			woID := id
			uID := userID
			ket := teksKet

			listCreatedBy = append(listCreatedBy, models.CreatedBy{
				Id:         &woID,
				ShipmentBy: &uID,
			})

			listKeterangan = append(listKeterangan, models.Keterangan{
				Wo_id:          int(woID),
				Qa_release_ket: &ket,
			})
		}

		errCb := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"shipment_by"}),
		}).Create(&listCreatedBy).Error
		if errCb != nil {
			return errCb
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"qa_release_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// ReceiveShipmentService menandai bahwa pengiriman (shipment) telah diterima di tujuan.
// Ini adalah salah satu titik akhir dari perjalanan sebuah batch di sistem tracker.
func ReceiveShipmentService(db *gorm.DB, req models.NextRequest, userID uint, userNama string, userArea string, userIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var dataBatch []models.WorkOrders
		if err := tx.Where("id IN (?)", req.Id).
			Find(&dataBatch).Error; err != nil {
			return err
		}

		var nowTime = time.Now().Truncate(time.Second)

		var batchID []uint
		var audit []models.AuditTrail
		for _, batch := range dataBatch {
			batchID = append(batchID, batch.Id)

			audit = append(audit, models.AuditTrail{
				Id:       userID,
				Tanggal:  nowTime,
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: userIP,
				Nama:     userNama,
				Area:     userArea,
				Kegiatan: userNama + " melakukan Receive Shipment." +
					" [1] Kode Ruah : " + batch.KodeRuah +
					" [2] Kode Produk : " + batch.KodeProduk +
					" [3] No Batch : " + batch.NoBatch,
			})
		}

		if err := tx.Create(&audit).Error; err != nil {
			return err
		}

		result := tx.Model(&models.WorkOrders{}).
			Where("id IN (?)", batchID).
			Updates(map[string]any{
				"shipment_received_at": nowTime,
				"updated_at":           nowTime,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		var teksKet string
		if req.Ket != nil && *req.Ket != "" {
			teksKet = *req.Ket
		} else {
			teksKet = "-"
		}

		var listKeterangan []models.Keterangan
		for _, id := range batchID {
			woID := id
			ket := teksKet
			listKeterangan = append(listKeterangan, models.Keterangan{
				Wo_id:        int(woID),
				Shipment_ket: &ket,
			})
		}

		errKet := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "wo_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"shipment_ket"}),
		}).Create(&listKeterangan).Error
		if errKet != nil {
			return errKet
		}

		return nil
	})
}

// ----------------------------------------DELETE BATCH TRACK---------------------------------------------

// DeletePpicService (dan fungsi Delete lainnya) menangani pembatalan (soft delete) sebuah batch.
// Arsitektur Soft Delete & Keamanan:
// - Verifikasi identitas: Memerlukan username & input password yang akan dicocokkan dengan hash di database.
// - Otorisasi (RBAC): Memeriksa role/level user (Administrator, Manager, atau Supervisor PPIC).
// - Operasi Data: Mengupdate field `delete_status` menjadi "deleted", bukan menghapus record secara permanen (hard delete).
// - Transaksional: Memastikan pencatatan log pembatalan ke AuditTrail dan update status WorkOrders terjadi secara atomic.
func DeletePpicService(db *gorm.DB, req models.DeleteRequestPpic, nama, username, area, level, alamatIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if req.Username != username {
			return errors.New("Username salah!")
		}

		// 1. Ambil password hash dari database menggunakan Pluck
		var dbPassword string
		if err := tx.Model(&models.User{}).Select("password").Where("username ILIKE ?", username).Pluck("password", &dbPassword).Error; err != nil {
			return errors.New("User tidak ditemukan atau terjadi kesalahan database")
		}

		// 2. Gunakan helper untuk membandingkan password
		// Urutannya: (password_input_dari_react, password_hash_dari_database)
		isPasswordValid := helpers.CheckPassword(req.Password, dbPassword)
		if !isPasswordValid {
			return errors.New("Password salah!")
		}

		level = strings.ToLower(level)
		area = strings.ToLower(area)
		if !(level == "administrator" || level == "manager") || (level == "supervisor" && area == "ppic") {
			return errors.New("Anda tidak diizinkan menghapus WO")
		}

		var workOrder []models.WorkOrders
		if err := tx.Where("id = ?", req.Id).Find(&workOrder).Error; err != nil {
			return err
		}

		catatan := "-"
		if req.Ket != nil && *req.Ket != "" {
			catatan = *req.Ket
		}

		delWo := tx.Model(&models.WorkOrders{}).Where("id = ?", req.Id).
			Updates(map[string]any{
				"delete_status": "deleted",
				"ket":           catatan, // <- Gunakan variabel aman
				"updated_at":    time.Now().Truncate(time.Second),
			})
		if delWo.RowsAffected == 0 {
			return delWo.Error
		}

		var auditTrail []models.AuditTrail

		for _, wo := range workOrder {
			auditTrail = append(auditTrail, models.AuditTrail{
				Tanggal:  time.Now().Truncate(time.Second),
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: alamatIP,
				Nama:     nama,
				Area:     area,
				Kegiatan: nama + " membatalkan Work Order. Batch dengan detail berikut ini dihapus" +
					" [1] Kode Ruah : " + wo.KodeRuah +
					" [2] Kode Produk : " + wo.KodeProduk +
					" [3] No Batch : " + wo.NoBatch +
					" [4] Catatan : " + catatan, // <- Gunakan catatan baru, karena wo.Ket yang lama bisa memicu error jika pointer
			})
		}

		if len(auditTrail) > 0 {
			if err := tx.Create(&auditTrail).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

func DeletePotongStockService(db *gorm.DB, req models.DeleteRequest, nama, username, level, area, alamatIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if req.Username != username {
			return errors.New("Username salah!")
		}

		// 1. Ambil password hash dari database menggunakan Pluck
		var dbPassword string
		if err := tx.Model(&models.User{}).Select("password").Where("username ILIKE ?", username).Pluck("password", &dbPassword).Error; err != nil {
			return errors.New("User tidak ditemukan atau terjadi kesalahan database")
		}

		// 2. Gunakan helper untuk membandingkan password
		// Urutannya: (password_input_dari_react, password_hash_dari_database)
		isPasswordValid := helpers.CheckPassword(req.Password, dbPassword)
		if !isPasswordValid {
			return errors.New("Password salah!")
		}

		level = strings.ToLower(level)
		area = strings.ToLower(area)
		if !(level == "administrator" || level == "manager") || (level == "supervisor" && area == "ppic") {
			return errors.New("Anda tidak diizinkan menghapus WO pada tahap Potong Stock!")
		}

		var workOrder []models.WorkOrders
		if err := tx.Where("id = ?", req.Id).Find(&workOrder).Error; err != nil {
			return err
		}

		catatan := "-"
		if req.Ket != nil && *req.Ket != "" {
			catatan = *req.Ket
		}

		delWo := tx.Model(&models.WorkOrders{}).Where("id = ?", req.Id).
			Updates(map[string]any{
				"delete_status": "deleted",
				"ket":           catatan, // <- Gunakan variabel aman
				"updated_at":    time.Now().Truncate(time.Second),
			})
		if delWo.RowsAffected == 0 {
			return delWo.Error
		}

		var auditTrail []models.AuditTrail

		for _, wo := range workOrder {
			auditTrail = append(auditTrail, models.AuditTrail{
				Tanggal:  time.Now().Truncate(time.Second),
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: alamatIP,
				Nama:     nama,
				Area:     area,
				Kegiatan: nama + " membatalkan Work Order pada tahap Potong Stock. Batch dengan detail berikut ini dihapus" +
					" [1] Kode Ruah : " + wo.KodeRuah +
					" [2] Kode Produk : " + wo.KodeProduk +
					" [3] No Batch : " + wo.NoBatch +
					" [4] Catatan : " + catatan, // <- Gunakan catatan baru, karena wo.Ket yang lama bisa memicu error jika pointer
			})
		}

		if len(auditTrail) > 0 {
			if err := tx.Create(&auditTrail).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

func DeletePreparasiService(db *gorm.DB, req models.DeleteRequest, nama, username, level, area, alamatIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if req.Username != username {
			return errors.New("Username salah!")
		}

		// 1. Ambil password hash dari database menggunakan Pluck
		var dbPassword string
		if err := tx.Model(&models.User{}).Select("password").Where("username ILIKE ?", username).Pluck("password", &dbPassword).Error; err != nil {
			return errors.New("User tidak ditemukan atau terjadi kesalahan database")
		}

		// 2. Gunakan buatanmu untuk membandingkan password
		// Urutannya: (password_input_dari_react, password_hash_dari_database)
		isPasswordValid := helpers.CheckPassword(req.Password, dbPassword)
		if !isPasswordValid {
			return errors.New("Password salah!")
		}

		level = strings.ToLower(level)
		area = strings.ToLower(area)
		if !(level == "administrator" || level == "manager") || (level == "supervisor" && area == "ppic") {
			return errors.New("Anda tidak diizinkan menghapus WO pada tahap Preparasi!")
		}

		var workOrder []models.WorkOrders
		if err := tx.Where("id = ?", req.Id).Find(&workOrder).Error; err != nil {
			return err
		}

		catatan := "-"
		if req.Ket != nil && *req.Ket != "" {
			catatan = *req.Ket
		}

		delWo := tx.Model(&models.WorkOrders{}).Where("id = ?", req.Id).
			Updates(map[string]any{
				"delete_status": "deleted",
				"ket":           catatan, // <- Gunakan variabel aman
				"updated_at":    time.Now().Truncate(time.Second),
			})
		if delWo.RowsAffected == 0 {
			return delWo.Error
		}

		var auditTrail []models.AuditTrail

		for _, wo := range workOrder {
			auditTrail = append(auditTrail, models.AuditTrail{
				Tanggal:  time.Now().Truncate(time.Second),
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: alamatIP,
				Nama:     nama,
				Area:     area,
				Kegiatan: nama + " membatalkan Work Order pada tahap Preparasi. Batch dengan detail berikut ini dihapus" +
					" [1] Kode Ruah : " + wo.KodeRuah +
					" [2] Kode Produk : " + wo.KodeProduk +
					" [3] No Batch : " + wo.NoBatch +
					" [4] Catatan : " + catatan, // <- Gunakan catatan baru, karena wo.Ket yang lama bisa memicu error jika pointer
			})
		}

		if len(auditTrail) > 0 {
			if err := tx.Create(&auditTrail).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

func DeleteWeighingService(db *gorm.DB, req models.DeleteRequest, nama, username, level, area, alamatIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if req.Username != username {
			return errors.New("Username salah!")
		}

		// 1. Ambil password hash dari database menggunakan Pluck
		var dbPassword string
		if err := tx.Model(&models.User{}).Select("password").Where("username ILIKE ?", username).Pluck("password", &dbPassword).Error; err != nil {
			return errors.New("User tidak ditemukan atau terjadi kesalahan database")
		}

		// 2. Gunakan helper untuk membandingkan password
		// Urutannya: (password_input_dari_react, password_hash_dari_database)
		isPasswordValid := helpers.CheckPassword(req.Password, dbPassword)
		if !isPasswordValid {
			return errors.New("Password salah!")
		}

		level = strings.ToLower(level)
		area = strings.ToLower(area)
		if !(level == "administrator" || level == "manager") || (level == "supervisor" && area == "ppic") {
			return errors.New("Anda tidak diizinkan menghapus WO pada tahap Penimbangan!")
		}

		var workOrder []models.WorkOrders
		if err := tx.Where("id = ?", req.Id).Find(&workOrder).Error; err != nil {
			return err
		}

		catatan := "-"
		if req.Ket != nil && *req.Ket != "" {
			catatan = *req.Ket
		}

		delWo := tx.Model(&models.WorkOrders{}).Where("id = ?", req.Id).
			Updates(map[string]any{
				"delete_status": "deleted",
				"ket":           catatan, // <- Gunakan variabel aman
				"updated_at":    time.Now().Truncate(time.Second),
			})
		if delWo.RowsAffected == 0 {
			return delWo.Error
		}

		var auditTrail []models.AuditTrail

		for _, wo := range workOrder {
			auditTrail = append(auditTrail, models.AuditTrail{
				Tanggal:  time.Now().Truncate(time.Second),
				Jam:      time.Now().Format("15:04:05"),
				AlamatIP: alamatIP,
				Nama:     nama,
				Area:     area,
				Kegiatan: nama + " membatalkan Work Order pada tahap Penimbangan. Batch dengan detail berikut ini dihapus" +
					" [1] Kode Ruah : " + wo.KodeRuah +
					" [2] Kode Produk : " + wo.KodeProduk +
					" [3] No Batch : " + wo.NoBatch +
					" [4] Catatan : " + catatan, // <- Gunakan catatan baru, karena wo.Ket yang lama bisa memicu error jika pointer
			})
		}

		if len(auditTrail) > 0 {
			if err := tx.Create(&auditTrail).Error; err != nil {
				return err
			}
		}

		return nil
	})
}
