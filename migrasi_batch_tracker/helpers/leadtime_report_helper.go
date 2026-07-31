package helpers

import (
	"errors"
	"migrasi_batch_tracker/models"
	"strings"
	"time"
)

// GetLeadtimeValue mengambil nilai leadtime untuk proses tertentu dengan aman terhadap field pointer.
func GetLeadtimeValue(w *models.LeadtimeSummary, processName string) int {
	switch processName {
	case "CWO":
		return w.LeadCWO
	case "Potong Stock":
		return models.SafeDereference(w.LeadPotongStock)
	case "Preparasi":
		return models.SafeDereference(w.LeadPreparasi)
	case "Timbang":
		return models.SafeDereference(w.LeadTimbang)
	case "Validasi 1":
		return models.SafeDereference(w.LeadValidasi1)
	case "Validasi 2":
		return models.SafeDereference(w.LeadValidasi2)
	case "Compounding":
		return models.SafeDereference(w.LeadCompounding)
	case "Terima Sample":
		return models.SafeDereference(w.LeadTerimaSample)
	case "Analisa Complete":
		return models.SafeDereference(w.LeadAnalisaComplete)
	case "Release QC":
		return models.SafeDereference(w.LeadReleaseQC)
	case "Tempel Label Rilis":
		return models.SafeDereference(w.LeadTempelLabelRilis)
	case "Filling":
		return models.SafeDereference(w.LeadFilling)
	case "Sample FG":
		return models.SafeDereference(w.LeadSampleFG)
	case "End Packaging":
		return models.SafeDereference(w.LeadEndPackaging)
	case "Setor BR":
		return models.SafeDereference(w.LeadSetorBr)
	case "Setor RAP":
		return models.SafeDereference(w.LeadSetorRap)
	case "Terima BR":
		return models.SafeDereference(w.LeadTerimaBr)
	case "Terima RAP":
		return models.SafeDereference(w.LeadTerimaRap)
	case "QA Release":
		return models.SafeDereference(w.QaRelease)
	case "Shipment":
		return models.SafeDereference(w.LeadShipment)
	default:
		return 0
	}
}

// SetZeroLeadtimeValue mengatur nilai leadtime suatu proses menjadi nol untuk keperluan perhitungan rentang.
func SetZeroLeadtimeValue(w *models.LeadtimeSummary, processName string) {
	zero := 0 // Bikin variabel int=0 dulu butuh pointer untuk *int

	switch processName {
	case "CWO":
		w.LeadCWO = 0
	case "Potong Stock":
		w.LeadPotongStock = &zero
	case "Preparasi":
		w.LeadPreparasi = &zero
	case "Timbang":
		w.LeadTimbang = &zero
	case "Validasi 1":
		w.LeadValidasi1 = &zero
	case "Validasi 2":
		w.LeadValidasi2 = &zero
	case "Compounding":
		w.LeadCompounding = &zero
	case "Terima Sample":
		w.LeadTerimaSample = &zero
	case "Analisa Complete":
		w.LeadAnalisaComplete = &zero
	case "Release QC":
		w.LeadReleaseQC = &zero
	case "Tempel Label Rilis":
		w.LeadTempelLabelRilis = &zero
	case "Filling":
		w.LeadFilling = &zero
	case "Sample FG":
		w.LeadSampleFG = &zero
	case "End Packaging":
		w.LeadEndPackaging = &zero
	case "Setor BR":
		w.LeadSetorBr = &zero
	case "Setor RAP":
		w.LeadSetorRap = &zero
	case "Terima BR":
		w.LeadTerimaBr = &zero
	case "Terima RAP":
		w.LeadTerimaRap = &zero
	case "QA Release":
		w.QaRelease = &zero
	case "Shipment":
		w.LeadShipment = &zero
	}
}

// ParseProcessDate menangani string tanggal yang tidak konsisten dari data lama agar parsing tetap aman.
func ParseProcessDate(rawDate string) (*time.Time, error) {
	cleanDate := strings.TrimSpace(strings.ToLower(rawDate))

	// Handle edge cases dari data Laravel/MySQL lama
	if cleanDate == "" || cleanDate == "none" || cleanDate == "null" {
		return nil, nil
	}

	layout := "2006-01-02 15:04:05"

	parsedTime, err := time.Parse(layout, rawDate)
	if err != nil {
		// Coba format alternatif jika data kotor (misal tanpa jam)
		if parsedTimeAlt, errAlt := time.Parse("2006-01-02", rawDate); errAlt == nil {
			return &parsedTimeAlt, nil
		}
		return nil, err
	}

	return &parsedTime, nil
}

func CalculateTotalRange(dto *models.LeadtimeReportDTO, startProcess, endProcess string) error {
	startIndex := -1
	endIndex := -1

	for i, p := range models.ProcessList {
		if strings.EqualFold(p, startProcess) {
			startIndex = i
		}
		if strings.EqualFold(p, endProcess) {
			endIndex = i
		}
	}

	if startIndex == -1 || endIndex == -1 {
		return errors.New("proses mulai atau akhir tidak valid")
	}

	if startIndex > endIndex {
		startIndex, endIndex = endIndex, startIndex
	}

	// 1. Zeroing nilai proses awal (memodifikasi embedded struct)
	actualStartProcess := models.ProcessList[startIndex]
	SetZeroLeadtimeValue(&dto.LeadtimeSummary, actualStartProcess)

	// 2. Hitung total
	total := 0
	for i := startIndex; i <= endIndex; i++ {
		processName := models.ProcessList[i]
		total += GetLeadtimeValue(&dto.LeadtimeSummary, processName)
	}

	// 3. Masukkan ke field DTO
	dto.TotalRange = total
	return nil
}
