package services

import (
	"log"
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/models"
	"strconv"
	"sync"
	"time"

	"gorm.io/gorm"
)

// LeadtimeService menyimpan cache leadtime dalam memori dan meng-update data secara berkala.
type LeadtimeService struct {
	mu    sync.RWMutex
	cache map[string]models.LeadtimeSummary
	db    *gorm.DB
}

// NewLeadtimeService membuat service leadtime dan langsung memulai background job caching.
func NewLeadtimeService(db *gorm.DB) *LeadtimeService {
	s := &LeadtimeService{
		cache: make(map[string]models.LeadtimeSummary),
		db:    db,
	}

	go s.backgroundLeadtime()

	return s
}

func (s *LeadtimeService) backgroundLeadtime() {
	log.Println("[Leadtime] Background caching for Leadtime started")

	s.ProcessLeadtimeJob()
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		s.ProcessLeadtimeJob()
	}
}

func (s *LeadtimeService) GetSummaryData() map[string]models.LeadtimeSummary {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.cache
}

// ProcessLeadtimeJob membaca data work order dan menghitung nilai leadtime per tahap proses.
func (s *LeadtimeService) ProcessLeadtimeJob() {
	var allWo []models.WorkOrders

	if err := s.db.Where("delete_status IS NULL").Find(&allWo).Error; err != nil {
		log.Println("[Leadtime] Error fetching WO:", err)
		return
	}

	var products []models.Product
	kategoriMap := make(map[string]string)
	if err := s.db.Select("kode_produk, kategori").Find(&products).Error; err == nil {
		for _, p := range products {
			kategoriMap[p.KodeProduk] = p.Kategori
		}
	}

	newSummary := make(map[string]models.LeadtimeSummary)

	for _, wo := range allWo {
		tanggalWOStr := ""
		if wo.TanggalWO != nil {
			tanggalWOStr = wo.TanggalWO.Format("2006-01-02 15:04:05")
		}

		kategori := kategoriMap[wo.KodeProduk]
		if kategori == "" {
			kategori = "Unknown" // Fallback jika produk terhapus dari master
		}

		lead := models.LeadtimeSummary{
			Id:                      int(wo.Id),
			NoBatch:                 wo.NoBatch,
			KodeProduk:              wo.KodeProduk,
			KodeRuah:                wo.KodeRuah,
			Kategori:                kategori,
			TanggalWO:               tanggalWOStr,
			TanggalPotongStock:      helpers.FormatTime(wo.TanggalPotongStock),
			TanggalTimbang:          helpers.FormatTime(wo.TanggalTimbang),
			TanggalTerimaVal1:       helpers.FormatTime(wo.TanggalTerimaVal1),
			TanggalKirimVal1:        helpers.FormatTime(wo.TanggalKirimVal1),
			TanggalTerimaVal2:       helpers.FormatTime(wo.TanggalTerimaVal2),
			TanggalKirimCompounding: helpers.FormatTime(wo.TanggalKirimCompounding),
			TanggalKirimKeQC:        helpers.FormatTime(wo.TanggalKirimKeQC),
			TanggalQcAnalisa:        helpers.FormatTime(wo.TanggalQcAnalisa),
			AnalisaCompleteDate:     helpers.FormatTime(wo.AnalisaCompleteDate),
			QcReleaseDate:           helpers.FormatTime(wo.QcReleaseDate),
			TempelLabelReleaseDate:  helpers.FormatTime(wo.TempelLabelReleaseDate),
			KirimKeFilling:          helpers.FormatTime(wo.KirimKeFilling),
			KirimKeSampleFG:         helpers.FormatTime(wo.KirimKeSampleFG),
			KirimKeEndPackaging:     helpers.FormatTime(wo.KirimKeEndPackaging),
			KirimKeSerahTerimaBPP:   helpers.FormatTime(wo.KirimKeSerahTerimaBPP),
			SetorBrDate:             helpers.FormatTime(wo.SetorBrDate),
			SetorRapDate:            helpers.FormatTime(wo.SetorRapDate),
			TerimaBrDate:            helpers.FormatTime(wo.TerimaBrDate),
			TerimaRapDate:           helpers.FormatTime(wo.TerimaRapDate),
			QaReleaseDate:           helpers.FormatTime(wo.QaReleaseDate),
			ShipmentReceivedAt:      helpers.FormatTime(wo.ShipmentReceivedAt),
			LeadCWO:                 0,
			LeadPotongStock:         helpers.DiffMinutes(wo.TanggalWO, wo.TanggalPotongStock),
			LeadPreparasi:           helpers.DiffMinutes(wo.TanggalPotongStock, wo.TanggalTimbang),
			LeadTimbang:             helpers.DiffMinutes(wo.TanggalPotongStock, wo.TanggalTimbang),
			LeadValidasi1:           helpers.DiffMinutes(wo.TanggalTimbang, wo.TanggalKirimVal1),
			LeadValidasi2:           helpers.DiffMinutes(wo.TanggalKirimVal1, wo.TanggalTerimaVal2),
			LeadCompounding:         helpers.DiffMinutes(wo.TanggalTerimaVal2, wo.TanggalKirimCompounding),
			LeadTerimaSample:        helpers.DiffMinutes(wo.TanggalKirimCompounding, wo.TanggalKirimKeQC),
			LeadAnalisaComplete:     helpers.DiffMinutes(wo.TanggalKirimKeQC, wo.TanggalQcAnalisa),
			LeadReleaseQC:           helpers.DiffMinutes(wo.TanggalQcAnalisa, wo.AnalisaCompleteDate),
			LeadTempelLabelRilis:    helpers.DiffMinutes(wo.AnalisaCompleteDate, wo.QcReleaseDate),
			LeadFilling:             helpers.DiffMinutes(wo.TempelLabelReleaseDate, wo.KirimKeFilling),
			LeadSampleFG:            helpers.DiffMinutes(wo.KirimKeFilling, wo.KirimKeSampleFG),
			LeadEndPackaging:        helpers.DiffMinutes(wo.KirimKeSampleFG, wo.KirimKeEndPackaging),
			LeadSetorBr:             helpers.DiffMinutes(wo.KirimKeSerahTerimaBPP, wo.SetorBrDate),
			LeadSetorRap:            helpers.DiffMinutes(wo.KirimKeSerahTerimaBPP, wo.SetorRapDate),
			LeadTerimaBr:            helpers.DiffMinutes(wo.SetorBrDate, wo.TerimaBrDate),
			LeadTerimaRap:           helpers.DiffMinutes(wo.SetorRapDate, wo.TerimaRapDate),
			QaRelease:               helpers.DiffMinutes(helpers.MaxDate(wo.TerimaBrDate, wo.TerimaRapDate), wo.QaReleaseDate),
			LeadShipment:            helpers.DiffMinutes(wo.QaReleaseDate, wo.ShipmentReceivedAt),
			UpdatedAt:               time.Now().Truncate(time.Second),
		}
		woId := strconv.Itoa(int(wo.Id))
		newSummary[woId] = lead
	}
	s.mu.Lock()
	s.cache = newSummary
	s.mu.Unlock()

	log.Println("Leadtime cache updated in memory.")
}

// FilterRequest menampung parameter filter yang dikirim frontend saat menampilkan report leadtime.
type FilterRequest struct {
	StartDate    string
	EndDate      string
	StartProcess string
	EndProcess   string
	KodeProduk   []string
	// Tambahkan field filter lain jika perlu
}

// ProcessLeadtimeConcurrent memproses kalkulasi leadtime secara paralel menggunakan goroutine dan channel.
// Sangat berguna untuk menghasilkan report dalam jumlah baris data besar secara efisien.
func ProcessLeadtimeConcurrent(rawData []models.LeadtimeSummary, req FilterRequest) []models.LeadtimeReportDTO {
	var wg sync.WaitGroup
	resultChan := make(chan models.LeadtimeReportDTO, len(rawData))

	for _, row := range rawData {
		wg.Add(1)

		go func(data models.LeadtimeSummary) {
			defer wg.Done()

			// ... (Logika filtering tanggal & produk tetap sama) ...

			// Mapping ke DTO
			dto := models.LeadtimeReportDTO{
				LeadtimeSummary: data, // Masukkan data asli ke dalam DTO
			}

			// Hitung total range menggunakan DTO
			if req.StartProcess != "" && req.EndProcess != "" {
				// Error diabaikan untuk mempersingkat contoh, pastikan log error di production
				_ = helpers.CalculateTotalRange(&dto, req.StartProcess, req.EndProcess)
			}

			resultChan <- dto
		}(row)
	}

	go func() {
		wg.Wait()
		close(resultChan)
	}()

	var processedData []models.LeadtimeReportDTO
	for processed := range resultChan {
		processedData = append(processedData, processed)
	}

	return processedData
}
