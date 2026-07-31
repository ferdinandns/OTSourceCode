package models

// Daftar konstanta proses agar terhindar dari typo
var ProcessList = []string{
	"CWO", "Potong Stock", "Preparasi", "Timbang", "Validasi 1", "Validasi 2", "Compounding",
	"Terima Sample", "Analisa Complete", "Release QC", "Tempel Label Rilis",
	"Filling", "Sample FG", "End Packaging", "Setor BR", "Setor RAP",
	"Terima BR", "Terima RAP", "QA Release", "Shipment",
}

type LeadtimeReportDTO struct {
	LeadtimeSummary                // Embed struct asli (semua field otomatis masuk)
	TotalRange      int            `json:"total_range"`
	StartRangeDate  string         `json:"start_range_date,omitempty"`
	EndRangeDate    string         `json:"end_range_date,omitempty"`
	Reasons         []BatchReasons `json:"reasons"` // Data array of reasons
}

// SafeDereference membantu mengambil nilai int dari pointer agar tidak panic jika nil
func SafeDereference(val *int) int {
	if val == nil {
		return 0
	}
	return *val
}
