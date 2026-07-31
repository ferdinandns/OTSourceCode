package dto

// ─── Sarpras Type DTOs ────────────────────────────────────────────────────────

type CreateSarprasTypeRequest struct {
	Code      string `json:"code" binding:"required"`
	Name      string `json:"name" binding:"required"`
	IsAPAR    bool   `json:"is_apar"`
	PICDeptID uint   `json:"pic_dept_id" binding:"required"`
	InspIntervalMonths int `json:"insp_interval_months" binding:"required,min=1,max=12"`
	Parameters []ParameterRequest `json:"parameters" binding:"required,min=1,dive"`
	Notes      string             `json:"notes"      binding:"required"`
}

type UpdateSarprasTypeRequest struct {
	Name string `json:"name" binding:"required"`
	InspIntervalMonths int `json:"insp_interval_months" binding:"required,min=1,max=12"`
	Parameters []ParameterRequest `json:"parameters" binding:"required,min=1,dive"`
	Notes      string             `json:"notes"      binding:"required"`
}

type SarprasTypeResponse struct {
	ID          uint   `json:"id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	IsAPAR      bool   `json:"is_apar"`
	PICDeptCode string `json:"pic_dept_code"`
	PICDeptName string `json:"pic_dept_name"`
	InspIntervalMonths int    `json:"insp_interval_months"`
	CreatedAt          string `json:"created_at"`
	UpdatedAt          string `json:"updated_at,omitempty"`
}

type SarprasTypeDetailResponse struct {
	ID            uint   `json:"id"`
	Code          string `json:"code"`
	SarprasName   string `json:"sarpras_name"`
	PICDepartment string `json:"pic_department"`
	InspIntervalMonths int                 `json:"insp_interval_months"`
	Parameters         []ParameterResponse `json:"parameters"`
}

type ParameterRequest struct {
	ID            *uint  `json:"id"`
	ParameterName string `json:"parameter_name" binding:"required"`
	ParameterDesc string `json:"parameter_desc" binding:"required"`
	OrderNo       int    `json:"order_no"       binding:"required,min=1"`
}

type ParameterResponse struct {
	ID      uint   `json:"id"`
	Name    string `json:"name"`
	Desc    string `json:"desc"`
	OrderNo int    `json:"order_no"`
}

// ─── Sarpras DTOs ─────────────────────────────────────────────────────────────

type CreateSarprasRequest struct {
	SarprasTypeID   uint    `json:"sarpras_type_id"   binding:"required"`
	LocationDeptID  uint    `json:"location_dept_id"  binding:"required"`
	LocationDetail  string  `json:"location_detail"   binding:"required"`
	SiteID          uint    `json:"site_id"			 binding:"required"`
	IsCritical      bool    `json:"is_critical"`
	HasAlternative  bool    `json:"has_alternative"`
	HasRiskLocation bool    `json:"has_risk_location"`
	ExpiredDate     *string `json:"expired_date"`
	Notes           string  `json:"notes" binding:"required"`
}

type EditSarprasRequest struct {
	LocationDetail string `json:"location_detail" binding:"required"`
	Notes          string `json:"notes"           binding:"required"`
}

type DeleteRequest struct {
	Notes string `json:"notes" binding:"required"`
	Force bool	  `json:"force"`
}

