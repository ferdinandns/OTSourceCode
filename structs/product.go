package structs

import "time"

// ============================================
// PRODUCT LIST & PAGINATION STRUCTS
// ============================================

// ProductListResponse - Response untuk list product
type ProductListResponse struct {
	Id             uint      `json:"id"`
	ItemID         string    `json:"item_id"`
	KategoriSampel string    `json:"kategori_sampel"`
	ItemCode       string    `json:"item_code"`
	ItemName       string    `json:"item_name"`
	Keterangan     string    `json:"keterangan"`
	LokasiSite     string    `json:"lokasi_site"`
	CreatedAt      time.Time `json:"created_at"`
	CreatedBy      string    `json:"created_by"`
}

// ProductFilterRequest - Filter untuk list product
type ProductFilterRequest struct {
	Site           string `json:"site" form:"site"`
	KategoriSampel string `json:"kategori_sampel" form:"kategori_sampel"`
	Search         string `json:"search" form:"search"`
	Page           int    `json:"page" form:"page"`
	Limit          int    `json:"limit" form:"limit"`
	SortBy         string `json:"sort_by" form:"sort_by"`
	SortOrder      string `json:"sort_order" form:"sort_order"`
}

// PaginatedProductResponse - Response dengan pagination
type PaginatedProductResponse struct {
	Data       []ProductListResponse `json:"data"`
	Total      int64                 `json:"total"`
	Page       int                   `json:"page"`
	Limit      int                   `json:"limit"`
	TotalPages int                   `json:"total_pages"`
}

// ============================================
// PRODUCT DETAIL STRUCT
// ============================================

// ProductDetailResponse - Response detail product
type ProductDetailResponse struct {
	Id             uint      `json:"id"`
	ItemID         string    `json:"item_id"`
	KategoriSampel string    `json:"kategori_sampel"`
	ItemCode       string    `json:"item_code"`
	ItemName       string    `json:"item_name"`
	Keterangan     string    `json:"keterangan"`
	LokasiSite     string    `json:"lokasi_site"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	CreatedBy      string    `json:"created_by"`
	UpdatedBy      *string   `json:"updated_by"`
}

// ============================================
// CREATE PRODUCT STRUCT
// ============================================

// CreateProductRequest - Request untuk membuat product baru
type CreateProductRequest struct {
	KategoriSampel string `json:"kategori_sampel" validate:"required,oneof=RM PM RUAH FINISHED_GOOD STABTEST MIKRO PROSES WS LAINNYA EHM"`
	ItemCode       string `json:"item_code" validate:"required"`
	ItemName       string `json:"item_name" validate:"required"`
	Keterangan     string `json:"keterangan"`
	LokasiSite     string `json:"lokasi_site" validate:"required,oneof=PLG CKR"`
}

// ============================================
// UPDATE PRODUCT STRUCT
// ============================================

// UpdateProductRequest - Request untuk update product
type UpdateProductRequest struct {
	KategoriSampel *string `json:"kategori_sampel" validate:"omitempty,oneof=RM PM RUAH FINISHED_GOOD STABTEST MIKRO PROSES WS LAINNYA EHM"`
	ItemCode       *string `json:"item_code"`
	ItemName       *string `json:"item_name"`
	Keterangan     *string `json:"keterangan"`
	LokasiSite     *string `json:"lokasi_site" validate:"omitempty,oneof=PLG CKR"`
}

// ============================================
// ADDITIONAL RESPONSE STRUCTS
// ============================================

// CategoryResponse - Response untuk list kategori
type CategoryResponse struct {
	Categories []string             `json:"categories"`
	Details    []CategoryDetailItem `json:"details"`
}

// CategoryDetailItem - Detail item kategori
type CategoryDetailItem struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

// ProductStatsResponse - Response untuk statistik
type ProductStatsResponse struct {
	Total      int64            `json:"total"`
	ByCategory map[string]int64 `json:"by_category"`
	BySite     []SiteCountItem  `json:"by_site"`
}

// SiteCountItem - Item untuk count per site
type SiteCountItem struct {
	LokasiSite string `json:"lokasi_site"`
	Count      int64  `json:"count"`
}

// SearchProductResponse - Response untuk search
type SearchProductResponse struct {
	Keyword  string                `json:"keyword"`
	Category string                `json:"category"`
	Site     string                `json:"site"`
	Count    int                   `json:"count"`
	Results  []ProductListResponse `json:"results"`
}
