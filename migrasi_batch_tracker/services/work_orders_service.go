package services

import (
	"errors"
	"migrasi_batch_tracker/models"
	"time"

	"gorm.io/gorm"
)

type WorkOrderRaw struct {
	models.WorkOrders        // Embed seluruh field dari WorkOrders
	KategoriProduk    string `json:"kategori_produk" gorm:"column:kategori_produk"`
}

type DurationItem struct {
	ID                 uint                  `json:"id"`
	NoBatch            string                `json:"no_batch"`
	KodeProduk         string                `json:"kode_produk"`
	KodeRuah           string                `json:"kode_ruah"`
	Kategori           string                `json:"kategori"`
	LeadCwoPotong      float64               `json:"lead_cwo_potong"`
	LeadPotongTimbang  float64               `json:"lead_potong_timbang"`
	LeadTimbangVal1    float64               `json:"lead_timbang_val1"`
	LeadVal1Val2       float64               `json:"lead_val1_val2"`
	LeadVal2Comp       float64               `json:"lead_val2_comp"`
	LeadCompQc         float64               `json:"lead_comp_qc"`
	LeadQcAnalisa      float64               `json:"lead_qc_analisa"`
	LeadAnalisaRelease float64               `json:"lead_analisa_release"`
	LeadReleaseScan    float64               `json:"lead_release_scan"`
	LeadScanFilling    float64               `json:"lead_scan_filling"`
	LeadFillingSample  float64               `json:"lead_filling_sample"`
	LeadSampleEndpack  float64               `json:"lead_sample_endpack"`
	LeadEndpackSetorBr float64               `json:"lead_endpack_setor_br"`
	LeadSetorBrRap     float64               `json:"lead_setor_br_rap"`
	LeadSetorRapTrBr   float64               `json:"lead_setor_rap_tr_br"`
	LeadTrBrRap        float64               `json:"lead_tr_br_rap"`
	LeadTrRapQa        float64               `json:"lead_tr_rap_qa"`
	LeadQaShipment     float64               `json:"lead_qa_shipment"`
	TotalLeadtime      float64               `json:"total_leadtime"`
	Reasons            []models.BatchReasons `json:"reasons"`
}

type RawDataLeadtimeResponse struct {
	Timestamps []WorkOrderRaw `json:"timestamps"`
	Durations  []DurationItem `json:"durations"`
}

func calcDiffMinutes(start, end *time.Time) float64 {
	if start == nil || end == nil || start.IsZero() || end.IsZero() {
		return 0
	}
	return end.Sub(*start).Minutes()
}

// GetWorkOrdersService mengambil data work orders dengan filter tanggal range dan delete_status null
func GetWorkOrdersService(db *gorm.DB, startDateStr string, endDateStr string) (*RawDataLeadtimeResponse, int64, error) {
	var rawData []WorkOrderRaw
	var total int64

	// 1. Default & Validasi Tanggal
	if startDateStr == "" && endDateStr == "" {
		today := time.Now().Format("2006-01-02")
		startDateStr, endDateStr = today, today
	}

	if startDateStr != "" && endDateStr != "" {
		_, err1 := time.Parse("2006-01-02", startDateStr)
		_, err2 := time.Parse("2006-01-02", endDateStr)
		if err1 != nil || err2 != nil {
			return nil, 0, errors.New("format tanggal tidak valid, gunakan YYYY-MM-DD")
		}
	}

	// 2. Setup Query & Hitung Total
	query := db.Table("tb_work_orders").
		Select("tb_work_orders.*, tb_produk.kategori as kategori_produk").
		Joins("LEFT JOIN tb_produk ON tb_work_orders.kode_produk = tb_produk.kode_produk").
		Where("tb_work_orders.delete_status IS NULL")

	if startDateStr != "" {
		query = query.Where("DATE(tb_work_orders.tanggal_wo) >= ?", startDateStr)
	}
	if endDateStr != "" {
		query = query.Where("DATE(tb_work_orders.tanggal_wo) <= ?", endDateStr)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 3. Eksekusi Pengambilan Data
	if err := query.Order("tb_work_orders.tanggal_wo ASC").Find(&rawData).Error; err != nil {
		return nil, 0, err
	}

	// 4. Ambil Batch Reasons (Bulk Query agar efisien)
	var batchIDs []uint
	for _, data := range rawData {
		batchIDs = append(batchIDs, data.Id)
	}

	reasonsMap := make(map[uint][]models.BatchReasons)
	if len(batchIDs) > 0 {
		var reasons []models.BatchReasons
		// Asumsi tabel bernama tb_batch_reasons
		db.Table("tb_batch_reasons").Where("batch_id IN ?", batchIDs).Find(&reasons)
		for _, r := range reasons {
			reasonsMap[uint(r.BatchId)] = append(reasonsMap[uint(r.BatchId)], r)
		}
	}

	// 5. Proses Durasi (Leadtime)
	var durations []DurationItem
	for _, r := range rawData {
		dur := DurationItem{
			ID:                 r.Id,
			NoBatch:            r.NoBatch,
			KodeProduk:         r.KodeProduk,
			KodeRuah:           r.KodeRuah,
			Kategori:           r.KategoriProduk,
			LeadCwoPotong:      calcDiffMinutes(r.PpicSubmitDate, r.TanggalPotongStock),
			LeadPotongTimbang:  calcDiffMinutes(r.TanggalPotongStock, r.TanggalTimbang),
			LeadTimbangVal1:    calcDiffMinutes(r.TanggalTimbang, r.TanggalTerimaVal1),
			LeadVal1Val2:       calcDiffMinutes(r.TanggalTerimaVal1, r.TanggalTerimaVal2),
			LeadVal2Comp:       calcDiffMinutes(r.TanggalTerimaVal2, r.TanggalKirimCompounding),
			LeadCompQc:         calcDiffMinutes(r.TanggalKirimCompounding, r.TanggalKirimKeQC),
			LeadQcAnalisa:      calcDiffMinutes(r.TanggalKirimKeQC, r.TanggalQcAnalisa),
			LeadAnalisaRelease: calcDiffMinutes(r.TanggalQcAnalisa, r.AnalisaCompleteDate),
			LeadReleaseScan:    calcDiffMinutes(r.QcReleaseDate, r.TempelLabelReleaseDate), // Sesuaikan field jika berbeda
			LeadScanFilling:    calcDiffMinutes(r.TempelLabelReleaseDate, r.KirimKeFilling),
			LeadFillingSample:  calcDiffMinutes(r.KirimKeFilling, r.KirimKeSampleFG),
			LeadSampleEndpack:  calcDiffMinutes(r.KirimKeSampleFG, r.KirimKeEndPackaging),
			LeadEndpackSetorBr: calcDiffMinutes(r.KirimKeEndPackaging, r.SetorBrDate),
			LeadSetorBrRap:     calcDiffMinutes(r.SetorBrDate, r.SetorRapDate),
			LeadSetorRapTrBr:   calcDiffMinutes(r.SetorRapDate, r.TerimaBrDate),
			LeadTrBrRap:        calcDiffMinutes(r.TerimaBrDate, r.TerimaRapDate),
			LeadTrRapQa:        calcDiffMinutes(r.TerimaRapDate, r.QaReleaseDate),
			LeadQaShipment:     calcDiffMinutes(r.QaReleaseDate, r.ShipmentReceivedAt),
		}

		// Hitung Total Leadtime
		dur.TotalLeadtime = dur.LeadCwoPotong + dur.LeadPotongTimbang + dur.LeadTimbangVal1 + dur.LeadVal1Val2 +
			dur.LeadVal2Comp + dur.LeadCompQc + dur.LeadQcAnalisa + dur.LeadAnalisaRelease + dur.LeadReleaseScan +
			dur.LeadScanFilling + dur.LeadFillingSample + dur.LeadSampleEndpack + dur.LeadEndpackSetorBr +
			dur.LeadSetorBrRap + dur.LeadSetorRapTrBr + dur.LeadTrBrRap + dur.LeadTrRapQa + dur.LeadQaShipment

		// Tambahkan reasons (jika ada, jika tidak, slice kosong)
		if reas, exists := reasonsMap[r.Id]; exists {
			dur.Reasons = reas
		} else {
			dur.Reasons = []models.BatchReasons{}
		}

		durations = append(durations, dur)
	}

	result := &RawDataLeadtimeResponse{
		Timestamps: rawData,
		Durations:  durations,
	}

	return result, total, nil
}
