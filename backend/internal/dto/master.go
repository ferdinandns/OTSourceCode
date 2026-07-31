package dto

// --- SITE DTO ---

type CreateSiteRequest struct {
	Code string `json:"code" binding:"required"`
	Name string `json:"name" binding:"required"`
}

type UpdateSiteRequest struct {
	// Hanya field Name yang diizinkan untuk diedit
	Name string `json:"name" binding:"required"`
}

type SiteResponse struct {
	ID        uint   `json:"id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
}

// --- DEPARTMENT DTO ---

type CreateDepartmentRequest struct {
	Code   string `json:"code" binding:"required"`
	Name   string `json:"name" binding:"required"`
	IsQs   bool   `json:"is_qs"`
	SiteID uint   `json:"site_id" binding:"required"`
	Notes  string `json:"notes" binding:"required"`
}

type UpdateDepartmentRequest struct {
	Name   string `json:"name" binding:"required"`
	Notes  string `json:"notes" binding:"required"`
	SiteID uint   `json:"site_id" binding:"required"`
}

type DepartmentResponse struct {
	ID        uint   `json:"id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	IsQs      bool   `json:"is_qs"`
	SiteCode  string `json:"site_code"`
	SiteDesc  string `json:"site_desc"`
	CreatedAt string `json:"created_at"`
}
