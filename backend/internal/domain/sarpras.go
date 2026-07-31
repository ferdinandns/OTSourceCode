package domain

import (
	"context"
	"mime/multipart"
	"time"
	"gorm.io/gorm"
)

type SarprasStatus string

const (
	SarprasNotReady            SarprasStatus = "not_ready"
	SarprasReady               SarprasStatus = "ready"
	SarprasNeedRepair          SarprasStatus = "need_repair"
	SarprasWillBeRepaired      SarprasStatus = "will_be_repaired"
	SarprasWaitingVerification SarprasStatus = "waiting_verification"
)

type RiskLevel string

const (
	RiskLow      RiskLevel = "low"
	RiskMedium   RiskLevel = "medium"
	RiskHigh     RiskLevel = "high"
	RiskVeryHigh RiskLevel = "very_high"
)

type SarprasType struct {
	ID                 uint   `gorm:"primaryKey"                   json:"id"`
	Code               string `gorm:"uniqueIndex;not null;size:20"  json:"code"`
	Name               string `gorm:"not null;size:100"             json:"name"`
	IsAPAR             bool   `gorm:"default:false"                json:"is_apar"`
	PICDeptID          uint   `gorm:"not null;index"               json:"pic_dept_id"`
	InspIntervalMonths int    `gorm:"column:insp_interval_months;not null;default:1;check:chk_insp_interval_months,insp_interval_months >= 1 AND insp_interval_months <= 12" json:"insp_interval_months"`
	ExpiryParamID      *uint  `gorm:"column:expiry_param_id"       json:"expiry_param_id"`
	CreatedAt          time.Time `json:"-"`
	UpdatedAt          time.Time `json:"-"`

	PICDept    Department  `gorm:"foreignKey:PICDeptID;constraint:OnDelete:SET NULL" json:"-"`
	Parameters []Parameter `gorm:"foreignKey:SarprasTypeID"                          json:"parameters"`
}

type SarprasTypeDetail struct {
	ID                 uint
	Code               string
	SarprasName        string
	PICDepartment      string
	InspIntervalMonths int
	Parameters         []Parameter
}

type Parameter struct {
	ID            uint   `gorm:"primaryKey"                 json:"id"`
	SarprasTypeID uint   `gorm:"not null;index"             json:"sarpras_type_id"`
	Name          string `gorm:"not null;size:200"          json:"name"`
	Desc          string `gorm:"column:param_desc;size:255" json:"desc"`
	OrderNo       int    `gorm:"not null"                   json:"order_no"`
}

type Sarpras struct {
	ID              uint          `gorm:"primaryKey"                            json:"id"`
	Code            string        `gorm:"uniqueIndex;not null;size:30"          json:"code"`
	SarprasTypeID   uint          `gorm:"not null;index"                        json:"sarpras_type_id"`
	LocationDeptID  uint          `gorm:"not null;index"                        json:"location_dept_id"`
	SiteID          uint          `gorm:"not null;index"                        json:"site_id"`
	LocationDetail  string        `gorm:"type:text"                             json:"location_detail"`
	IsCritical      bool          `gorm:"default:false"                         json:"is_critical"`
	HasAlternative  bool          `gorm:"default:false"                         json:"has_alternative"`
	HasRiskLocation bool          `gorm:"default:false"                         json:"has_risk_location"`
	RiskScore       int           `gorm:"default:0"                             json:"risk_score"`
	RiskLevel       RiskLevel     `gorm:"type:risk_level_enum;default:'low'"    json:"risk_level"`
	Status          SarprasStatus `gorm:"type:sarpras_status_enum;default:'not_ready'" json:"status"`
	LastInspected   *time.Time    `json:"last_inspected"`
	DueDate         *time.Time    `json:"due_date"`
	ExpiredDate     *time.Time    `json:"expired_date"`
	CreatedAt       time.Time     `json:"-"`
	UpdatedAt       time.Time     `json:"-"`

	SarprasType  SarprasType `gorm:"foreignKey:SarprasTypeID;constraint:OnDelete:RESTRICT"  json:"-"`
	LocationDept Department  `gorm:"foreignKey:LocationDeptID;constraint:OnDelete:RESTRICT" json:"-"`
	Site         Site        `gorm:"foreignKey:SiteID"                                      json:"-"`
}

// ─── View Rows & Filters ──────────────────────────────────────────────────────

type SarprasTypeRow struct {
	ID          uint
	Code        string `gorm:"column:sarprastype_code"`
	Name        string `gorm:"column:sarprastype_name"`
	IsAPAR      bool
	PICDeptCode string `gorm:"column:pic_department_code"`
	PICDeptName string `gorm:"column:pic_department_name"`
	// ── CHANGED: months, not days ──
	InspIntervalMonths int
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type SarprasRow struct {
	ID               uint
	Code             string
	SarprasTypeName  string
	LocationDeptName string
	SiteName         string
	PICDeptName      string
	LocationDetail   string
	RiskScore        int
	RiskLevel        RiskLevel
	Status           SarprasStatus
	DueDate          *time.Time
	Notes            string
}

type SarprasFilter struct {
	LocationDeptID *uint
	SarprasTypeID  *uint
	Status         *SarprasStatus
	Search         string
	Limit          int
	Offset         int
	ExportMode     bool `json:"-"`
	SortBy         string
	SortOrder      string
}

type SarprasDetailResponse struct {
	ID                uint       `json:"id"`
	Code              string     `json:"code"`
	Name              string     `json:"name"`
	Status            string     `json:"status"`
	RiskLevel         string     `json:"risk_level"`
	Type              string     `json:"type"`
	SerialNumber      string     `json:"serial_number"`
	Site              string     `json:"site"`
	Department        string     `json:"department"`
	Location          string     `json:"location"`
	Pemeriksa         string     `json:"pemeriksa"`
	PICResponsibility string     `json:"pic_responsibility"`
	LastInspected     *time.Time `json:"last_inspected"`
	NextDueDate       *time.Time `json:"next_due_date"`
	// ── ADDED: surface the interval in the detail response ──
	InspIntervalMonths int    `json:"insp_interval_months"`
	QRCode             string `json:"qr_code"`
}

type ExportSarprasPDFRequest struct {
	SarprasTypeID   *uint  `form:"sarpras_type_id"`
	LocationDeptID  *uint  `form:"location_dept_id"`
	DepartmentName  string `form:"department_name"`
	SarprasTypeName string `form:"sarpras_type_name"`
	SortBy          string `form:"sort_by"`
	SortOrder       string `form:"sort_order"`
}

type CheckerEligibility struct {
	Eligible   bool      `json:"eligible"`
	IsDue      bool      `json:"is_due"`
	DueDate    time.Time `json:"due_date"`
	SarprasID  uint      `json:"sarpras_id"`
	ScheduleID uint      `json:"schedule_id"`
	Reason     string    `json:"reason,omitempty"` 
	Message    string	 `json:"message,omitempty"` 
}

type BulkImportItemRequest struct {
	Row              int     `json:"row"`
	SarprasTypeCode  string  `json:"sarpras_type_code"`
	LocationDeptCode string  `json:"location_dept_code"`
	SiteCode         string  `json:"site_code"`
	LocationDetail   string  `json:"location_detail"`
	IsCritical       bool    `json:"is_critical"`
	HasAlternative   bool    `json:"has_alternative"`
	HasRiskLocation  bool    `json:"has_risk_location"`
	ExpiredDate      *string `json:"expired_date"`
}

type BulkParseRow struct {
	Row              int      `json:"row"`
	SarprasTypeCode  string   `json:"sarpras_type_code"`
	LocationDeptCode string   `json:"location_dept_code"`
	SiteCode         string   `json:"site_code"`
	LocationDetail   string   `json:"location_detail"`
	IsCritical       bool     `json:"is_critical"`
	HasAlternative   bool     `json:"has_alternative"`
	HasRiskLocation  bool     `json:"has_risk_location"`
	ExpiredDate      string   `json:"expired_date"`
	RiskScore        int      `json:"risk_score"`
	RiskLevel        string   `json:"risk_level"`
	Valid            bool     `json:"valid"`
	Errors           []string `json:"errors"`
}

type BulkParseResponse struct {
	TotalRows int            `json:"total_rows"`
	ValidRows int            `json:"valid_rows"`
	ErrorRows int            `json:"error_rows"`
	AllValid  bool           `json:"all_valid"`
	Rows      []BulkParseRow `json:"rows"`
}

type BulkExecuteRequest struct {
	Items []BulkImportItemRequest `json:"items" binding:"required,min=1,max=5000"`
	Notes string                  `json:"notes"`
}

type BulkValidateResponse struct {
	Valid     bool `json:"valid"`
	TotalRows int  `json:"total_rows"`
	ErrorRows int  `json:"error_rows"`
	RowErrors []struct {
		Row    int      `json:"row"`
		Errors []string `json:"errors"`
	} `json:"row_errors"`
}

type BulkExecuteResponse struct {
	TotalInserted int    `json:"total_inserted"`
	Message       string `json:"message"`
}

// Template Excel

type ColorTemplateExcel string

const (
	ColorNavy     ColorTemplateExcel = "003D7A"
	ColorWhite    ColorTemplateExcel = "FFFFFF"
	ColorGuideB   ColorTemplateExcel = "EBF3FB"
	ColorGuideT   ColorTemplateExcel = "4A5568"
	ColorReqB     ColorTemplateExcel = "FFF5F5"
	ColorReqT     ColorTemplateExcel = "C53030"
	ColorOptB     ColorTemplateExcel = "F7FAFC"
	ColorOptT     ColorTemplateExcel = "718096"
	ColorExampleB ColorTemplateExcel = "F0FFF4"
	ColorAltRow   ColorTemplateExcel = "F8FAFC"
)

type TemplateCol struct {
	Header   string // key teknis — harus sama persis dengan yang dibaca parser
	Label    string // judul ramah pengguna
	Format   string // keterangan format
	Example  string // nilai contoh
	Required bool
	Width    float64
}

const ya_tidak = "ya / tidak"

// ── NEW constant for automatic expiry parameter detection ──
const ExpiryParamName = "Masa Berlaku"

var TemplateColumns = []TemplateCol{
	{"sarpras_type_code", "Kode Jenis Sarpras", "Teks, maks 20 karakter", "APAR", true, 22},
	{"location_dept_code", "Kode Dept Lokasi", "Teks, maks 30 karakter", "ENG", true, 22},
	{"site_code", "Kode Site", "CKR atau PLG", "CKR", true, 14},
	{"location_detail", "Lokasi Detail", "Teks, maks 255 karakter", "Dekat pintu masuk Lobby Utama", true, 42},
	{"is_critical", "Kritis jika tidak ada", ya_tidak, "ya", true, 18},
	{"has_alternative", "Ada Alternatif", ya_tidak, "tidak", true, 18},
	{"has_risk_location", "Lokasi Berisiko", ya_tidak, "ya", true, 18},
	{"expired_date", "Tanggal Kadaluarsa", "YYYY-MM-DD", "2026-12-31", false, 20},
}

// ─── Business helpers ─────────────────────────────────────────────────────────

func CalculateRiskScore(s Sarpras) int {
	score := 0
	if s.IsCritical {
		score += 5
	} else {
		score += 1
	}
	if !s.HasAlternative {
		score += 2
	}
	if s.HasRiskLocation {
		score += 3
	} else {
		score += 1
	}
	return score
}

func ResolveRiskLevel(score int) RiskLevel {
	switch {
	case score >= 10:
		return RiskVeryHigh
	case score >= 8:
		return RiskHigh
	case score >= 6:
		return RiskMedium
	default:
		return RiskLow
	}
}

func CalculateNextDueDate(lastInspected time.Time, inspIntervalMonths int) time.Time {
	return lastInspected.AddDate(0, inspIntervalMonths, 0)
}

// ─── Interfaces (unchanged signatures) ───────────────────────────────────────

type SarprasTypeRepository interface {
	Create(ctx context.Context, st *SarprasType) error
	Update(ctx context.Context, st *SarprasType) error
	Delete(ctx context.Context, id uint) error
	FindByID(ctx context.Context, id uint) (*SarprasType, error)
	Detail(ctx context.Context, id uint) (*SarprasTypeDetail, error)
	List(ctx context.Context, filter map[string]interface{}) ([]SarprasTypeRow, error)
	FindExistingIDs(ctx context.Context, ids []uint) ([]uint, error)
	FindByCode(ctx context.Context, code string) (*SarprasType, error)
	FindByName(ctx context.Context, name string) (*SarprasType, error)
	FindByNameExcludingID(ctx context.Context, name string, exludeID uint) (*SarprasType, error)
	FindExpiryParamID(ctx context.Context, typeID uint) (*uint, error)

	CreateParameter(ctx context.Context, p *Parameter) error
	UpdateParameter(ctx context.Context, p *Parameter) error
	DeleteParameter(ctx context.Context, id uint) error
	GetParametersByType(ctx context.Context, typeID uint) ([]Parameter, error)

	CreateTx(tx *gorm.DB, st *SarprasType) error
	UpdateWithParamsTx(tx *gorm.DB, id uint, st *SarprasType) error
	DeleteTx(tx *gorm.DB, id uint) error
}

type SarprasRepository interface {
	UpdateStatus(ctx context.Context, id uint, status SarprasStatus) error
	FindByID(ctx context.Context, id uint) (*Sarpras, error)
	FindByCode(ctx context.Context, code string) (*Sarpras, error)
	List(ctx context.Context, filter SarprasFilter) ([]SarprasRow, int64, error)
	CountByTypeAndDepts(ctx context.Context, typeID uint, locationDeptID uint, picDeptID uint) (int, error)
	GetExpiringAPAR(ctx context.Context, before time.Time) ([]SarprasRow, error)
	GetCheckerAssignedSarpras(ctx context.Context, userID uint, filter SarprasFilter) ([]SarprasRow, int64, error)
	FindEligibleChecker(tx *gorm.DB, typeID uint, deptID uint) (uint, error)
	GetLastChecker(ctx context.Context, sarprasID uint) (string, error)

	GetLatestCodeTx(tx *gorm.DB, typeID uint, locationDeptID uint) (string, error)
	CreateTx(tx *gorm.DB, s *Sarpras) error
	UpdateTx(tx *gorm.DB, id uint, s *Sarpras) error
	DeleteTx(tx *gorm.DB, id uint) error

	UpdateStatusByExpiry(ctx context.Context) error
}

func joinSarprasParts(parts []string) string {
	if len(parts) == 0 {
		return ""
	}
	if len(parts) == 1 {
		return parts[0]
	}
	result := parts[0]
	for i := 1; i < len(parts)-1; i++ {
		result += ", " + parts[i]
	}
	result += " and " + parts[len(parts)-1]
	return result
}

type SarprasService interface {
	RequestCreateSarprasType(ctx context.Context, userID uint, req *SarprasType, notes string) (*ApprovalResponse, error)
	RequestEditSarprasType(ctx context.Context, userID, id uint, req *SarprasType, notes string) (*ApprovalResponse, error)
	RequestDeleteSarprasType(ctx context.Context, userID, id uint, notes string) (*ApprovalResponse, error)
	GetSarprasTypeDetail(ctx context.Context, id uint) (*SarprasTypeDetail, error)
	ListSarprasTypes(ctx context.Context, filter map[string]interface{}) ([]SarprasTypeRow, error)

	RequestCreateSarpras(ctx context.Context, userID uint, req *Sarpras, notes string) (*ApprovalResponse, error)
	RequestEditSarpras(ctx context.Context, userID, id uint, req *Sarpras, notes string) (*ApprovalResponse, error)
	RequestDeleteSarpras(ctx context.Context, userID, id uint, notes string) (*ApprovalResponse, error)
	GetSarpras(ctx context.Context, id uint) (*Sarpras, error)
	GetSarprasDetail(ctx context.Context, code string) (*SarprasDetailResponse, error)
	ListSarpras(ctx context.Context, filter SarprasFilter) ([]SarprasRow, int64, error)
	GetByQRCode(ctx context.Context, code string) (*Sarpras, error)
	GenerateQRCode(ctx context.Context, sarprasID uint) ([]byte, error)
	ExportPDF(ctx context.Context, userID uint, req ExportSarprasPDFRequest) ([]byte, error)
	CheckEligibility(ctx context.Context, userID uint, code string) (*CheckerEligibility, error)
	UpdateStatusExpiry(ctx context.Context) error
	BulkImportParse(ctx context.Context, file multipart.File, header *multipart.FileHeader) (*BulkParseResponse, error)
	BulkImportValidate(ctx context.Context, req BulkExecuteRequest) (*BulkValidateResponse, error)
	RequestCreateSarprasImport(ctx context.Context, userID uint, req BulkExecuteRequest, notes string) (*ApprovalResponse, error)
	ExecuteBulkImportInTx(ctx context.Context, tx *gorm.DB, items []BulkImportItemRequest, userID uint) (int, error)
	GetTemplateMetadata(ctx context.Context) ([]SarprasTypeRow, []DepartmentRow, error)
}
