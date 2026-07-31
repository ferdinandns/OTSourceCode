package services

import (
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/models"
	"strconv"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

type ReportFilterRequest struct {
	StartDate      string   `form:"start_date"`
	EndDate        string   `form:"end_date"`
	StartProcess   string   `form:"start_process"`
	EndProcess     string   `form:"end_process"`
	KodeProduk     []string `form:"kode_produk[]"`     // Berubah menjadi array
	Batches        []string `form:"batches[]"`
	KelompokProduk []string `form:"kelompok_produk[]"` // Berubah menjadi array
}

type ReportService struct {
	DB *gorm.DB
	LeadtimeService *LeadtimeService
	BatchReasonService *BatchReasonService 
}

func NewReportService(db *gorm.DB, leadtimeSvc *LeadtimeService, reasonSvc *BatchReasonService) *ReportService {
	return &ReportService{
		DB:              db,
		LeadtimeService: leadtimeSvc,
		BatchReasonService: reasonSvc,
	}
}

// GetBatchReportData menarik data dari DB dan memproses kalkulasi leadtime
func (s *ReportService) GetBatchReportData(req ReportFilterRequest) ([]models.LeadtimeReportDTO, error) {
	// 1. Ambil & filter data (fungsi dari langkah sebelumnya)
	rawMapData := s.LeadtimeService.GetSummaryData()
	filteredData := processLeadtimeConcurrent(rawMapData, req)

	// 2. Kumpulkan semua ID Batch yang lolos filter
	var batchIDs []int
	for _, dto := range filteredData {
		batchIDs = append(batchIDs, dto.Id)
	}

	// 3. Ambil seluruh Reason untuk batch-batch tersebut
	reasonsMap, err := s.BatchReasonService.GetReasonsByBatchIDs(batchIDs)
	if err != nil {
		return nil, err
	}

	// 4. Suntikkan/Tempelkan array reason ke dalam setiap DTO yang sesuai
	for i := range filteredData {
		if reasons, exists := reasonsMap[filteredData[i].Id]; exists {
			filteredData[i].Reasons = reasons
		} else {
			filteredData[i].Reasons = []models.BatchReasons{} // Kosongkan jika tidak ada
		}
	}

	return filteredData, nil
}

// GetProductReportData menangani logika untuk laporan per Produk
func (s *ReportService) GetProductReportData(req ReportFilterRequest) ([]models.LeadtimeReportDTO, error) {
	rawMapData := s.LeadtimeService.GetSummaryData()
	return processLeadtimeConcurrent(rawMapData, req), nil
}

// GetGroupReportData menangani logika untuk laporan Kategori (Pharma vs Herbal)
func (s *ReportService) GetGroupReportData(req ReportFilterRequest) ([]models.LeadtimeReportDTO, error) {
	rawMapData := s.LeadtimeService.GetSummaryData()

	if len(req.KelompokProduk) > 0 {
		var kodeProduks []string
		
		err := s.DB.Table("tb_produk").
			Where("kategori IN ?", req.KelompokProduk).
			Pluck("kode_produk", &kodeProduks).Error

		if err != nil {
			return nil, err
		}

		if len(kodeProduks) == 0 {
			return []models.LeadtimeReportDTO{}, nil
		}
		
		// Timpa request kode produk agar difilter di Goroutine
		req.KodeProduk = kodeProduks
	}

	return processLeadtimeConcurrent(rawMapData, req), nil
}

// processLeadtimeConcurrent menjalankan kalkulasi TotalRange secara paralel
func processLeadtimeConcurrent(rawMapData map[string]models.LeadtimeSummary, req ReportFilterRequest) []models.LeadtimeReportDTO {
	var wg sync.WaitGroup
	resultChan := make(chan models.LeadtimeReportDTO, len(rawMapData))

	for _, row := range rawMapData {
		wg.Add(1)

		go func(data models.LeadtimeSummary) {
			defer wg.Done()

			// 1. FILTER DELETE STATUS
			if strings.ToLower(data.DeleteStatus) == "deleted" {
				return
			}

			// 2. FILTER TANGGAL WO
			if req.StartDate != "" && req.EndDate != "" {
				woDate, err := helpers.ParseProcessDate(data.TanggalWO)
				if err != nil || woDate == nil {
					return
				}

				reqStart, _ := time.Parse("2006-01-02", req.StartDate)
				reqEnd, _ := time.Parse("2006-01-02", req.EndDate)
				reqEnd = reqEnd.Add((24 * time.Hour) - time.Second) // 23:59:59

				if woDate.Before(reqStart) || woDate.After(reqEnd) {
					return
				}
			}

			// 3. FILTER BATCHES
			if len(req.Batches) > 0 {
				if !containsString(req.Batches, strconv.Itoa(data.Id)) {
					return
				}
			}

			// 4. FILTER KODE PRODUK
			if len(req.KodeProduk) > 0 {
				if !containsString(req.KodeProduk, data.KodeProduk) {
					return
				}
			}

			dtoData := models.LeadtimeReportDTO{
				LeadtimeSummary: data,
			}

			// 5. KALKULASI TOTAL RANGE
			if req.StartProcess != "" && req.EndProcess != "" {
				_ = helpers.CalculateTotalRange(&dtoData, req.StartProcess, req.EndProcess)
			}

			resultChan <- dtoData
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

func containsString(slice []string, val string) bool {
	for _, item := range slice {
		if item == val {
			return true
		}
	}
	return false
}