package structs

import (
	"encoding/json"
	"time"

	"gorm.io/datatypes"
)

// ============================================
// LIST INSTRUMENT STRUCTS (Section 3.1)
// ============================================

type InstrumentListResponse struct {
	Id                 uint       `json:"id"`
	NamaInstrument     string     `json:"nama_instrument"`
	NomorKontrol       string     `json:"nomor_kontrol"`
	PICInstrument      string     `json:"pic_instrument"`
	LokasiInstrument   string     `json:"lokasi_instrument"`
	LokasiSite         string     `json:"lokasi_site"`
	TanggalKalibrasi   time.Time  `json:"tanggal_kalibrasi"`
	EDKalibrasi        time.Time  `json:"ed_kalibrasi"`
	Status             string     `json:"status"`
	TanggalStockOpname *time.Time `json:"tanggal_stock_opname"`
	PICStockOpname     *string    `json:"pic_stock_opname"`
	KalibrasiColorCode string     `json:"kalibrasi_color_code"`
	Type               string     `json:"type"`

	// 🆕 Bridge Fields
	BridgePCID     string    `json:"bridge_pc_id,omitempty"`
	BridgePort     string    `json:"bridge_port,omitempty"`
	BridgeBaudrate int       `json:"bridge_baudrate,omitempty"`
	BridgeStatus   string    `json:"bridge_status,omitempty"`
	LastBridgeSeen time.Time `json:"last_bridge_seen,omitempty"`
}

// ============================================
// ADD NEW INSTRUMENT STRUCTS (Section 3.2)
// ============================================

type CreateInstrumentRequest struct {
	LokasiSite       string    `json:"lokasi_site" validate:"required,oneof=PLG CKR"` // PLG/CKR
	Ruangan          string    `json:"ruangan" validate:"required"`
	NomorSeri        string    `json:"nomor_seri" validate:"required"`
	NamaInstrument   string    `json:"nama_instrument" validate:"required"`
	NamaMerk         string    `json:"nama_merk" validate:"required"`
	NomorKontrol     string    `json:"nomor_kontrol" validate:"required,len=11"` // XXX-XXX-XXX
	PICInstrumentID  uint      `json:"pic_instrument_id" validate:"required"`
	MassaANT         *float64  `json:"massa_ant"` // Khusus anak timbang
	TanggalKalibrasi time.Time `json:"tanggal_kalibrasi" validate:"required"`
	EDKalibrasi      time.Time `json:"ed_kalibrasi" validate:"required"`
	Type             string    `json:"type"`
}

type CreateInstrumentResponse struct {
	Id             uint   `json:"id"`
	NomorKontrol   string `json:"nomor_kontrol"`
	NamaInstrument string `json:"nama_instrument"`
	Message        string `json:"message"`
}

// ============================================
// INSTRUMENT VERIFICATION STRUCTS
// ============================================
type InstrumentVerificationItem struct {
	Id             uint      `json:"id"`
	VerifiedBy     string    `json:"verified_by"`
	VerifiedAt     time.Time `json:"verified_at"`
	Remarks        string    `json:"remarks"`
	PreviousStatus string    `json:"previous_status"`
	NewStatus      string    `json:"new_status"`
}

// ============================================
// VIEW INSTRUMENT DETAIL STRUCTS (Section 3.3)
// ============================================
// ============================================
// UNIFIED HISTORY ITEM (Usage + Verification)
// ============================================

type UnifiedHistoryItem struct {
	Type      string    `json:"type"` // "usage" or "verification"
	Id        uint      `json:"id"`
	Timestamp time.Time `json:"timestamp"` // start_time for usage, verified_at for verification
	User      string    `json:"user"`
	Status    string    `json:"status"` // status_penggunaan or verification status

	// Usage-specific fields (only populated if type == "usage")
	IsExported    bool `json:"is_exported,omitempty"`
	DownloadCount int  `json:"download_count,omitempty"`

	// Verification-specific fields (only populated if type == "verification")
	ValidUntil   *time.Time `json:"valid_until,omitempty"`
	RoomTemp     *float64   `json:"room_temp,omitempty"`
	RoomHumidity *float64   `json:"room_humidity,omitempty"`
	Notes        string     `json:"notes,omitempty"`

	EndTime        *time.Time `json:"end_time,omitempty"`
	KategoriSampel string     `json:"kategori_sampel,omitempty"`
	Sampel         []string   `json:"sampel,omitempty"`

	HasReread     bool  `json:"has_reread"`
	ParentUsageID *uint `json:"parent_usage_id,omitempty"` // Untuk verifikasi, bisa tahu usage_id terkait

	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

type InstrumentDetailResponse struct {
	// Basic Info
	Id             uint   `json:"id"`
	NamaInstrument string `json:"nama_instrument"`
	NomorKontrol   string `json:"nomor_kontrol"`
	NomorSeri      string `json:"nomor_seri"`
	NamaMerk       string `json:"nama_merk"`
	Type           string `json:"type"`

	// Location
	LokasiInstrument string `json:"lokasi_instrument"`
	LokasiSite       string `json:"lokasi_site"`

	// PIC & Dates
	PICInstrument      UserBasicInfo `json:"pic_instrument"`
	TanggalKalibrasi   time.Time     `json:"tanggal_kalibrasi"`
	EDKalibrasi        time.Time     `json:"ed_kalibrasi"`
	KalibrasiColorCode string        `json:"kalibrasi_color_code"`

	// Stock Opname
	TanggalStockOpname *time.Time     `json:"tanggal_stock_opname"`
	PICStockOpname     *UserBasicInfo `json:"pic_stock_opname"`

	// Status
	Status string `json:"status"`

	// Special Fields
	MassaANT *float64 `json:"massa_ant"`

	// Configuration (if exists)
	Configuration *InstrumentConfigDetail `json:"configuration"`

	// ✅ UNIFIED HISTORY (combines usage + verification)
	UnifiedHistory []UnifiedHistoryItem `json:"unified_history"`

	// ⚠️ DEPRECATED: Keep for backward compatibility but will be removed
	RiwayatPenggunaan []UsageHistoryItem           `json:"riwayat_penggunaan,omitempty"`
	RiwayatVerifikasi []InstrumentVerificationItem `json:"riwayat_verifikasi,omitempty"`

	BridgePCID     string `json:"bridge_pc_id"`
	BridgePort     string `json:"bridge_port"`
	BridgeBaudrate int    `json:"bridge_baudrate"`
	SharedAccess   bool   `json:"shared_access"`
}

type UserBasicInfo struct {
	Id   uint   `json:"id"`
	Name string `json:"name"`
}

type InstrumentConfigDetail struct {
	Id                 uint            `json:"id"`
	BaudRate           int             `json:"baud_rate"`
	DataBits           int             `json:"data_bits"`
	StopBits           int             `json:"stop_bits"`
	Parity             string          `json:"parity"`
	ComPort            string          `json:"com_port"`
	IPAddress          string          `json:"ip_address"`
	TCPPort            int             `json:"tcp_port"`
	Timeout            int             `json:"timeout"`
	RegexPattern       string          `json:"regex_pattern"`
	FilePath           string          `json:"file_path"`
	FilePath2          string          `json:"file_path_2"`
	CustomCommands     string          `json:"custom_commands"`
	ReadCommand        string          `json:"read_command"`
	ReadingMode        string          `json:"reading_mode"`
	NeedsBatch         bool            `json:"needs_batch"`
	NeedsSample        bool            `json:"needs_sample"`
	ReadingSchema      json.RawMessage `json:"reading_schema"`
	LinesPerItem       int             `json:"lines_per_item"`       // Number of lines per measurement
	RegexFilterEnabled bool            `json:"regex_filter_enabled"` // Reject non-matching data

	PDFColumns datatypes.JSON `json:"pdf_columns"`
}
type UsageHistoryItem struct {
	Id               uint      `json:"id"`
	TanggalWaktu     time.Time `json:"tanggal_waktu"`
	User             string    `json:"user"`
	IsExported       bool      `json:"is_exported"`
	StatusPenggunaan string    `json:"status_penggunaan"`
	DownloadCount    int       `json:"download_count"`

	HasReread     bool  `json:"has_reread"`
	ParentUsageID *uint `json:"parent_usage_id,omitempty"`
}

// ============================================
// EDIT CONFIGURATION STRUCTS (Section 3.4)
// ============================================

type UpdateConfigurationRequest struct {
	ActiveTab *string `json:"active_tab"`
	// Serial Configuration
	BaudRate *int    `json:"baud_rate" validate:"omitempty,oneof=1200 2400 4800 9600 14400 38400 19200 57600 115200"`
	DataBits *int    `json:"data_bits" validate:"omitempty,oneof=7 8"`
	StopBits *int    `json:"stop_bits" validate:"omitempty,oneof=1 2"`
	Parity   *string `json:"parity" validate:"omitempty,oneof=Odd None Even"`
	ComPort  *string `json:"com_port"`

	// TCP/IP Configuration
	IPAddress *string `json:"ip_address"`
	TCPPort   *int    `json:"tcp_port"`
	Timeout   *int    `json:"timeout"`

	// Data Processing
	RegexPattern *string `json:"regex_pattern"`
	FilePath     *string `json:"file_path"`
	FilePath2    *string `json:"file_path_2"`

	CustomCommands *string `json:"custom_commands"`
	ReadCommand    *string `json:"read_command"`

	PDFColumns *string `json:"pdf_columns"`

	ReadingMode   *string         `json:"reading_mode"`   // "auto", "single", "manual-trigger"
	NeedsBatch    *bool           `json:"needs_batch"`    // true/false
	NeedsSample   *bool           `json:"needs_sample"`   // true/false
	ReadingSchema json.RawMessage `json:"reading_schema"` // JSON string

	LinesPerItem       *int  `json:"lines_per_item,omitempty"`
	RegexFilterEnabled *bool `json:"regex_filter_enabled,omitempty"`
}

type TestConnectionRequest struct {
	InstrumentID uint   `json:"instrument_id" validate:"required"`
	SerialNumber string `json:"serial_number"`
}

type TestConnectionResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    string `json:"data,omitempty"`
}

// ============================================
// EDIT INSTRUMENT STRUCTS (Section 3.5)
// ============================================

// UpdateInstrumentRequest - untuk update instrument
type UpdateInstrumentRequest struct {
	NomorSeri       *string  `json:"nomor_seri"`
	NamaMerk        *string  `json:"nama_merk"`
	Ruangan         *string  `json:"ruangan"`
	LokasiSite      *string  `json:"lokasi_site" validate:"omitempty,oneof=PLG CKR"`
	PICInstrumentID *uint    `json:"pic_instrument_id"`
	MassaANT        *float64 `json:"massa_ant"`

	// Stock Opname
	TanggalStockOpname  *time.Time `json:"tanggal_stock_opname"`
	UseCurrentTimeStock *bool      `json:"use_current_time_stock"`
	PICStockOpnameID    *uint      `json:"pic_stock_opname_id"`
	Status              *string    `json:"status" validate:"omitempty,oneof=Available Unverified Unavailable"`
	SharedAccess        *bool      `json:"shared_access"`
	// Kalibrasi
	TanggalKalibrasi  *time.Time `json:"tanggal_kalibrasi"`
	UseCurrentTimeCal *bool      `json:"use_current_time_cal"`
	EDKalibrasi       *time.Time `json:"ed_kalibrasi"`
	UseCurrentTimeED  *bool      `json:"use_current_time_ed"`

	// ✅ Bridge Fields (NEW)
	BridgePCID     *string `json:"bridge_pc_id"`
	BridgePort     *string `json:"bridge_port"`
	BridgeBaudrate *int    `json:"bridge_baudrate"`
}

// ============================================
// READ INSTRUMENT STRUCTS (Section 4)
// ============================================

// Section 4.1 - List Category
type CategoryInstrumentResponse struct {
	Categories []string `json:"categories"`
}

// Section 4.2 - List Instrument by Category
type InstrumentByTypeResponse struct {
	Id               uint      `json:"id"`
	NamaInstrument   string    `json:"nama_instrument"`
	NomorKontrol     string    `json:"nomor_kontrol"`
	Status           string    `json:"status"` // Available, In Used, Unverified, etc.
	StatusColor      string    `json:"status_color"`
	TanggalKalibrasi time.Time `json:"tanggal_kalibrasi"`
	EDKalibrasi      time.Time `json:"ed_kalibrasi"`
}

// Section 4.3 - Start Process Read Instrument
type StartReadRequest struct {
	InstrumentID     uint                   `json:"instrument_id" validate:"required"`
	InitialCondition map[string]interface{} `json:"initial_condition" validate:"required"`
	KategoriSampel   string                 `json:"kategori_sampel" validate:"required"`
	Sampel           []string               `json:"sampel" validate:"required,min=1"`
	NoQCBatch        []NoQCBatchItem        `json:"no_qc_batch" validate:"required,min=1,dive"`
	AdditionalData   map[string]interface{} `json:"additional_data"` // Data tambahan per instrument type
}

type NoQCBatchItem struct {
	NoQCBatch  string `json:"no_qc_batch" validate:"required"`
	JumlahItem int    `json:"jumlah_item" validate:"required,min=1"`
}

type StartReadResponse struct {
	UsageID          uint      `json:"usage_id"`
	InstrumentID     uint      `json:"instrument_id"`
	Status           string    `json:"status"`            // In Used
	StatusPenggunaan string    `json:"status_penggunaan"` // Read Process
	StartTime        time.Time `json:"start_time"`
	Message          string    `json:"message"`
}

// Section 4.4 - Process Read Instrument
type ProcessReadRequest struct {
	UsageID    uint   `json:"usage_id" validate:"required"`
	NoQCBatch  string `json:"no_qc_batch" validate:"required"`
	ItemNumber int    `json:"item_number" validate:"required,min=1"`
}

type ProcessReadResponse struct {
	Success    bool                   `json:"success"`
	ResultData map[string]interface{} `json:"result_data"`
	Message    string                 `json:"message"`
}

// Section 4.5 - Read Instrument Result
type ReadResultRequest struct {
	UsageID        uint                   `json:"usage_id" validate:"required"`
	NoQCBatch      string                 `json:"no_qc_batch" validate:"required"`
	ItemNumber     int                    `json:"item_number" validate:"required"`
	FinalCondition string                 `json:"final_condition" validate:"required,oneof=OK NOT_OK"`
	ResultData     map[string]interface{} `json:"result_data" validate:"required"`
}

type ReadResultResponse struct {
	ResultID       uint                   `json:"result_id"`
	UsageID        uint                   `json:"usage_id"`
	NoQCBatch      string                 `json:"no_qc_batch"`
	ItemNumber     int                    `json:"item_number"`
	ResultData     map[string]interface{} `json:"result_data"`
	FinalCondition string                 `json:"final_condition"`
	RemainingItems int                    `json:"remaining_items"`
	Message        string                 `json:"message"`
}

// Section 4.6 - Uji Ulang
type UjiUlangRequest struct {
	UsageID      uint   `json:"usage_id" validate:"required"`
	ResultID     uint   `json:"result_id" validate:"required"`
	Alasan       string `json:"alasan" validate:"required,min=10"`
	SupervisorID uint   `json:"supervisor_id" validate:"required"`
}

type UjiUlangResponse struct {
	NewUsageID    uint   `json:"new_usage_id"`
	ParentUsageID uint   `json:"parent_usage_id"`
	Status        string `json:"status"` // Re-read
	NeedsApproval bool   `json:"needs_approval"`
	Message       string `json:"message"`
}

type ApproveUjiUlangRequest struct {
	UsageID  uint   `json:"usage_id" validate:"required"`
	Approved bool   `json:"approved" validate:"required"`
	Comment  string `json:"comment"`
}

// Section 4.7 - Export to PDF
type ExportPDFRequest struct {
	UsageID   uint   `json:"usage_id" validate:"required"`
	ResultIDs []uint `json:"result_ids" validate:"required,min=1,dive"`
}

type ExportPDFResponse struct {
	Success  bool   `json:"success"`
	PDFPath  string `json:"pdf_path"`
	Exported bool   `json:"exported"`
	Message  string `json:"message"`
}

// Section 4.9 - End Process
type EndProcessRequest struct {
	UsageID        uint   `json:"usage_id" validate:"required"`
	FinalCondition string `json:"final_condition" validate:"required,oneof=OK NOT_OK"`
}

type EndProcessResponse struct {
	Success            bool      `json:"success"`
	InstrumentStatus   string    `json:"instrument_status"`
	EndTime            time.Time `json:"end_time"`
	TotalItemsRead     int       `json:"total_items_read"`
	TotalItemsExported int       `json:"total_items_exported"`
	Message            string    `json:"message"`
}

// ============================================
// ADDITIONAL DATA STRUCTS PER INSTRUMENT TYPE
// ============================================

// pH & Cond. Meter
type PHCondAdditionalData struct {
	Parameters []string `json:"parameters"` // CND, pH, TDS
}

// Oven
type OvenAdditionalData struct {
	Suhu float64 `json:"suhu"`
}

// AAS
type AASAdditionalData struct {
	LampuKatoda string  `json:"lampu_katoda"`
	JenisGas    string  `json:"jenis_gas"`
	GasSebelum  float64 `json:"gas_sebelum"` // bar/psi
}

// Linomat
type LinomatAdditionalData struct {
	JenisPemakaian string `json:"jenis_pemakaian"`
}

// Spectrophotometer
type SpectrophotometerAdditionalData struct {
	UsiaLampuD1 int `json:"usia_lampu_d1"`
	UsiaLampuW2 int `json:"usia_lampu_w2"`
}

// Autoclave
type AutoclaveAdditionalData struct {
	JenisBahan string `json:"jenis_bahan"` // Media, Alat dan Bahan
}

// Incubator
type IncubatorAdditionalData struct {
	JenisUji string  `json:"jenis_uji"`
	SuhuAwal float64 `json:"suhu_awal"`
}

// ============================================
// FILTER & PAGINATION STRUCTS
// ============================================

type InstrumentFilterRequest struct {
	Site      string `json:"site" form:"site"`
	Status    string `json:"status" form:"status"`
	Type      string `json:"type" form:"type"`
	Lokasi    string `json:"lokasi" form:"lokasi"`
	Search    string `json:"search" form:"search"`
	Page      int    `json:"page" form:"page"`
	Limit     int    `json:"limit" form:"limit"`
	SortBy    string `json:"sort_by" form:"sort_by"`
	SortOrder string `json:"sort_order" form:"sort_order"`
}

type PaginatedInstrumentResponse struct {
	Data       []InstrumentListResponse `json:"data"`
	Total      int64                    `json:"total"`
	Page       int                      `json:"page"`
	Limit      int                      `json:"limit"`
	TotalPages int                      `json:"total_pages"`
}

// Add these structs to structs/instruments.go

// AutoReadResponse - Response for auto-read start
type AutoReadResponse struct {
	UsageID      uint   `json:"usage_id"`
	InstrumentID uint   `json:"instrument_id"`
	TotalItems   int    `json:"total_items"`
	Status       string `json:"status"`
	Message      string `json:"message"`
}

// BatchData - Batch information
type BatchData struct {
	NoQCBatch  string `json:"no_qc_batch" validate:"required"`
	JumlahItem int    `json:"jumlah_item" validate:"required,min=1"`
}

// ReadProgressResponse - Progress information (optional, for type safety)
type ReadProgressResponse struct {
	UsageID         uint                   `json:"usage_id"`
	Status          string                 `json:"status"`
	TotalItems      int                    `json:"total_items"`
	CompletedItems  int64                  `json:"completed_items"`
	ProgressPercent float64                `json:"progress_percent"`
	CurrentItem     int                    `json:"current_item,omitempty"`
	CurrentStatus   string                 `json:"current_status,omitempty"`
	LatestResult    map[string]interface{} `json:"latest_result,omitempty"`
	StartTime       time.Time              `json:"start_time"`
	EndTime         *time.Time             `json:"end_time,omitempty"`
}

// SaveFileRequest - Request for saving file to capture
type SaveFileRequest struct {
	UsageID       uint `json:"usage_id" validate:"required"`
	ResultID      uint `json:"result_id" validate:"required"`
	DestinationID int  `json:"destination_id" validate:"required,oneof=1 2"` // 1=QC, 2=AnDev
}

// SaveFileResponse - Response after saving file
type SaveFileResponse struct {
	Success  bool   `json:"success"`
	FilePath string `json:"file_path"`
	Message  string `json:"message"`
}

// Section 4.2.1 - Instrument Name Group
type InstrumentNameGroup struct {
	Nama  string `json:"nama"`
	Type  string `json:"type"`
	Count int    `json:"count"` // Jumlah kode kontrol dengan nama ini
}

// Section 4.2.2 - Instrument Code Item
type InstrumentCodeItem struct {
	Id               uint      `json:"id"`
	KodeInstrument   string    `json:"kode_instrument"`
	Nama             string    `json:"nama"`
	Type             string    `json:"type"`
	Status           string    `json:"status"`
	LokasiInstrument string    `json:"lokasi_instrument"`
	LokasiSite       string    `json:"lokasi_site"`
	PICInstrument    string    `json:"pic_instrument"`
	TanggalKalibrasi time.Time `json:"tanggal_kalibrasi"`
	EDKalibrasi      time.Time `json:"ed_kalibrasi"`
	CurrentUsageID   uint      `json:"current_usage_id,omitempty"` // Jika sedang dipakai, tampilkan usage_id
	CurrentUserID    uint      `json:"current_user_id"`
	CurrentUserName  string    `json:"current_user_name"`
	SharedAccess     bool      `json:"shared_access"`
}

type MTSICSCommand struct {
	Command     string `json:"command"`
	Description string `json:"description"`
}

// ExecuteCommandRequest - Request to execute custom command
type ExecuteCommandRequest struct {
	Command string `json:"command" validate:"required"`
}

// ExecuteCommandResponse - Response from command execution
type ExecuteCommandResponse struct {
	Command string `json:"command"`
	Result  string `json:"result"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// GetChecklistRequest - Request untuk get checklist template
type GetChecklistRequest struct {
	InstrumentID  uint   `json:"instrument_id" form:"instrument_id" validate:"required"`
	ChecklistType string `json:"checklist_type" form:"checklist_type" validate:"required,oneof=initial final"`
}

// ChecklistItemResponse - Item dalam checklist
type ChecklistItemResponse struct {
	ID          int      `json:"id"`
	Label       string   `json:"label"`
	Type        string   `json:"type"` // boolean, text, number
	Required    bool     `json:"required"`
	CriticalOK  bool     `json:"critical_ok"` // Jika false, instrument jadi Unavailable
	HelpText    string   `json:"help_text"`
	Placeholder string   `json:"placeholder"`
	MinValue    *float64 `json:"min_value,omitempty"`
	MaxValue    *float64 `json:"max_value,omitempty"`
}

// GetChecklistResponse - Response berisi checklist items
type GetChecklistResponse struct {
	InstrumentID   uint                    `json:"instrument_id"`
	InstrumentName string                  `json:"instrument_name"`
	InstrumentType string                  `json:"instrument_type"`
	ChecklistType  string                  `json:"checklist_type"` // initial, final
	ChecklistItems []ChecklistItemResponse `json:"checklist_items"`
	RequireAllOK   bool                    `json:"require_all_ok"`
}

// ValidateChecklistRequest - Request untuk validasi checklist
type ValidateChecklistRequest struct {
	InstrumentID  uint                    `json:"instrument_id" validate:"required"`
	ChecklistType string                  `json:"checklist_type" validate:"required,oneof=initial final"`
	Responses     []ChecklistResponseItem `json:"responses" validate:"required,dive"`
}

// ChecklistResponseItem - User response untuk satu item
type ChecklistResponseItem struct {
	ID    int         `json:"id" validate:"required"`
	Value interface{} `json:"value" validate:"required"` // bool, string, atau number
	OK    bool        `json:"ok"`                        // Apakah item ini OK
	Note  string      `json:"note"`                      // Catatan tambahan
}

// ValidateChecklistResponse - Response hasil validasi
type ValidateChecklistResponse struct {
	IsValid          bool   `json:"is_valid"`
	AllOK            bool   `json:"all_ok"`
	FailedItems      []int  `json:"failed_items"`      // ID dari items yang NOT OK
	CriticalFailed   bool   `json:"critical_failed"`   // Ada critical item yang failed
	InstrumentStatus string `json:"instrument_status"` // Available, Unavailable
	Message          string `json:"message"`
	CanProceed       bool   `json:"can_proceed"` // Bisa lanjut reading atau tidak
}

// CreateChecklistTemplateRequest - Admin create template
type CreateChecklistTemplateRequest struct {
	InstrumentType        string                  `json:"instrument_type" validate:"required"`
	TemplateName          string                  `json:"template_name" validate:"required"`
	Description           string                  `json:"description"`
	InitialChecklistItems []ChecklistItemResponse `json:"initial_checklist_items" validate:"required,dive"`
	FinalChecklistItems   []ChecklistItemResponse `json:"final_checklist_items" validate:"required,dive"`
}

// UpdateChecklistConfigRequest - Update config untuk instrument tertentu
type UpdateChecklistConfigRequest struct {
	InstrumentID          uint                     `json:"instrument_id" validate:"required"`
	InitialChecklistItems *[]ChecklistItemResponse `json:"initial_checklist_items,omitempty"`
	FinalChecklistItems   *[]ChecklistItemResponse `json:"final_checklist_items,omitempty"`
	RequireAllInitialOK   *bool                    `json:"require_all_initial_ok,omitempty"`
	RequireAllFinalOK     *bool                    `json:"require_all_final_ok,omitempty"`
}

// Update StartReadRequest - tambahkan checklist_responses
type StartReadRequestWithChecklist struct {
	InstrumentID       uint                    `json:"instrument_id" validate:"required"`
	ChecklistResponses []ChecklistResponseItem `json:"checklist_responses" validate:"required,dive"` // TAMBAH INI
	KategoriSampel     string                  `json:"kategori_sampel" validate:"required"`
	Sampel             []string                `json:"sampel" validate:"required,min=1"`
	NoQCBatch          []NoQCBatchItem         `json:"no_qc_batch" validate:"required,min=1,dive"`
	AdditionalData     map[string]interface{}  `json:"additional_data"`
}

// Update EndProcessRequest - tambahkan checklist_responses
type EndProcessRequestWithChecklist struct {
	UsageID            uint                    `json:"usage_id" validate:"required"`
	ChecklistResponses []ChecklistResponseItem `json:"checklist_responses" validate:"required,dive"` // TAMBAH INI
}

// ============================================
// CHECKLIST ADMIN MANAGEMENT STRUCTS
// ============================================

// ChecklistTemplateResponse - Template list response
type ChecklistTemplateResponse struct {
	Id                uint      `json:"id"`
	InstrumentType    string    `json:"instrument_type"`
	TemplateName      string    `json:"template_name"`
	Description       string    `json:"description"`
	InitialItemsCount int       `json:"initial_items_count"`
	FinalItemsCount   int       `json:"final_items_count"`
	IsActive          bool      `json:"is_active"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// ChecklistTemplateDetailResponse - Template detail with items
type ChecklistTemplateDetailResponse struct {
	Id                    uint                    `json:"id"`
	InstrumentType        string                  `json:"instrument_type"`
	TemplateName          string                  `json:"template_name"`
	Description           string                  `json:"description"`
	InitialChecklistItems []ChecklistItemResponse `json:"initial_checklist_items"`
	FinalChecklistItems   []ChecklistItemResponse `json:"final_checklist_items"`
	IsActive              bool                    `json:"is_active"`
	CreatedAt             time.Time               `json:"created_at"`
	UpdatedAt             time.Time               `json:"updated_at"`
}

// InstrumentChecklistStatusResponse - Instrument with checklist status
type InstrumentChecklistStatusResponse struct {
	Id                 uint   `json:"id"`
	KodeInstrument     string `json:"kode_instrument"`
	Nama               string `json:"nama"`
	Type               string `json:"type"`
	HasCustomChecklist bool   `json:"has_custom_checklist"`
	InitialItemsCount  *int   `json:"initial_items_count,omitempty"`
	FinalItemsCount    *int   `json:"final_items_count,omitempty"`
}

// InstrumentChecklistConfigDetailResponse - Config detail with items
type InstrumentChecklistConfigDetailResponse struct {
	InstrumentID          uint                    `json:"instrument_id"`
	InstrumentName        string                  `json:"instrument_name"`
	InstrumentType        string                  `json:"instrument_type"`
	HasCustomConfig       bool                    `json:"has_custom_config"`
	InitialChecklistItems []ChecklistItemResponse `json:"initial_checklist_items"`
	FinalChecklistItems   []ChecklistItemResponse `json:"final_checklist_items"`
	RequireAllInitialOK   bool                    `json:"require_all_initial_ok"`
	RequireAllFinalOK     bool                    `json:"require_all_final_ok"`
}
