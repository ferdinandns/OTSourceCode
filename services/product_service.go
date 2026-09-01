package services

import (
	"errors"
	"fmt"
	"math"
	"strings"

	"gorm.io/gorm"

	"lab-connect/backend-api/database"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/structs"
)

type ProductService struct {
	db *gorm.DB
}

func NewProductService() *ProductService {
	return &ProductService{
		db: database.DB,
	}
}

// ============================================
// LIST PRODUCT SERVICES
// ============================================

// GetAllProducts - Get all products with filter & pagination
func (s *ProductService) GetAllProducts(filter structs.ProductFilterRequest) (*structs.PaginatedProductResponse, error) {
	var products []models.Product
	var total int64

	query := s.db.Model(&models.Product{})

	// Apply filters
	if filter.Site != "" {
		query = query.Where("lokasi_site = ?", filter.Site)
	}

	if filter.KategoriSampel != "" {
		query = query.Where("kategori_sampel = ?", filter.KategoriSampel)
	}

	if filter.Search != "" {
		query = query.Where(
			"item_code LIKE ? OR item_name LIKE ? OR keterangan LIKE ? OR item_id LIKE ?",
			"%"+filter.Search+"%",
			"%"+filter.Search+"%",
			"%"+filter.Search+"%",
			"%"+filter.Search+"%",
		)
	}

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	// Apply sorting
	sortBy := "created_at"
	sortOrder := "DESC"
	if filter.SortBy != "" {
		sortBy = filter.SortBy
	}
	if filter.SortOrder != "" {
		sortOrder = strings.ToUpper(filter.SortOrder)
	}
	query = query.Order(fmt.Sprintf("%s %s", sortBy, sortOrder))

	// Apply pagination
	offset := (filter.Page - 1) * filter.Limit
	query = query.Offset(offset).Limit(filter.Limit)

	// Preload relationships
	if err := query.
		Preload("Creator").
		Preload("Updater").
		Find(&products).Error; err != nil {
		return nil, err
	}

	// Transform to response
	data := make([]structs.ProductListResponse, len(products))
	for i, product := range products {
		data[i] = structs.ProductListResponse{
			Id:             product.Id,
			ItemID:         product.ItemID,
			KategoriSampel: product.KategoriSampel,
			ItemCode:       product.ItemCode,
			ItemName:       product.ItemName,
			Keterangan:     product.Keterangan,
			LokasiSite:     product.LokasiSite,
			CreatedAt:      product.CreatedAt,
			CreatedBy:      product.Creator.Name,
		}
	}

	totalPages := int(math.Ceil(float64(total) / float64(filter.Limit)))

	return &structs.PaginatedProductResponse{
		Data:       data,
		Total:      total,
		Page:       filter.Page,
		Limit:      filter.Limit,
		TotalPages: totalPages,
	}, nil
}

// ============================================
// CREATE PRODUCT SERVICE
// ============================================

// CreateProduct - Create new product
func (s *ProductService) CreateProduct(req structs.CreateProductRequest, createdBy uint) (*structs.ProductDetailResponse, error) {
	// Check if item code already exists in the same site
	var existingProduct models.Product
	if err := s.db.Where("item_code = ? AND lokasi_site = ?", req.ItemCode, req.LokasiSite).First(&existingProduct).Error; err == nil {
		return nil, errors.New("item code already exists in this site")
	}

	// Generate Item ID
	itemID, err := s.generateItemID()
	if err != nil {
		return nil, err
	}

	product := models.Product{
		ItemID:         itemID,
		KategoriSampel: req.KategoriSampel,
		ItemCode:       req.ItemCode,
		ItemName:       req.ItemName,
		Keterangan:     req.Keterangan,
		LokasiSite:     req.LokasiSite,
		CreatedBy:      createdBy,
	}

	if err := s.db.Create(&product).Error; err != nil {
		return nil, err
	}

	// Reload with relations
	if err := s.db.Preload("Creator").First(&product, product.Id).Error; err != nil {
		return nil, err
	}

	return &structs.ProductDetailResponse{
		Id:             product.Id,
		ItemID:         product.ItemID,
		KategoriSampel: product.KategoriSampel,
		ItemCode:       product.ItemCode,
		ItemName:       product.ItemName,
		Keterangan:     product.Keterangan,
		LokasiSite:     product.LokasiSite,
		CreatedAt:      product.CreatedAt,
		UpdatedAt:      product.UpdatedAt,
		CreatedBy:      product.Creator.Name,
	}, nil
}

// ============================================
// GET PRODUCT DETAIL SERVICE
// ============================================

// GetProductDetail - Get product detail by ID
func (s *ProductService) GetProductDetail(productID uint) (*structs.ProductDetailResponse, error) {
	var product models.Product

	if err := s.db.
		Preload("Creator").
		Preload("Updater").
		First(&product, productID).Error; err != nil {
		return nil, err
	}

	response := structs.ProductDetailResponse{
		Id:             product.Id,
		ItemID:         product.ItemID,
		KategoriSampel: product.KategoriSampel,
		ItemCode:       product.ItemCode,
		ItemName:       product.ItemName,
		Keterangan:     product.Keterangan,
		LokasiSite:     product.LokasiSite,
		CreatedAt:      product.CreatedAt,
		UpdatedAt:      product.UpdatedAt,
		CreatedBy:      product.Creator.Name,
	}

	if product.Updater != nil {
		updaterName := product.Updater.Name
		response.UpdatedBy = &updaterName
	}

	return &response, nil
}

// ============================================
// UPDATE PRODUCT SERVICE
// ============================================

// UpdateProduct - Update product
func (s *ProductService) UpdateProduct(productID uint, req structs.UpdateProductRequest, updatedBy uint) (*structs.ProductDetailResponse, error) {
	var product models.Product
	if err := s.db.First(&product, productID).Error; err != nil {
		return nil, err
	}

	updates := make(map[string]interface{})

	if req.KategoriSampel != nil {
		updates["kategori_sampel"] = *req.KategoriSampel
	}
	if req.ItemCode != nil {
		// Check if new item code already exists (excluding current product)
		var existingProduct models.Product
		if err := s.db.Where("item_code = ? AND lokasi_site = ? AND id != ?", *req.ItemCode, product.LokasiSite, productID).First(&existingProduct).Error; err == nil {
			return nil, errors.New("item code already exists in this site")
		}
		updates["item_code"] = *req.ItemCode
	}
	if req.ItemName != nil {
		updates["item_name"] = *req.ItemName
	}
	if req.Keterangan != nil {
		updates["keterangan"] = *req.Keterangan
	}
	if req.LokasiSite != nil {
		updates["lokasi_site"] = *req.LokasiSite
	}

	updates["updated_by"] = updatedBy

	if err := s.db.Model(&product).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Return updated detail
	return s.GetProductDetail(productID)
}

// ============================================
// DELETE PRODUCT SERVICE
// ============================================

// DeleteProduct - Delete product
func (s *ProductService) DeleteProduct(productID uint) error {
	var product models.Product
	if err := s.db.First(&product, productID).Error; err != nil {
		return err
	}

	return s.db.Delete(&product).Error
}

// ============================================
// HELPER METHODS
// ============================================

// generateItemID - Generate unique Item ID
func (s *ProductService) generateItemID() (string, error) {
	var lastItemID string

	err := s.db.Model(&models.Product{}).
		Select("item_id").
		Where("item_id LIKE 'ITEM-%'").
		Order("CAST(SUBSTRING(item_id FROM 6) AS INTEGER) DESC").
		Limit(1).
		Pluck("item_id", &lastItemID).Error

	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", err
	}

	nextNumber := 1
	if lastItemID != "" {
		var lastNumber int
		fmt.Sscanf(lastItemID, "ITEM-%d", &lastNumber)
		nextNumber = lastNumber + 1
	}

	// Check it doesn't already exist (safety guard)
	for {
		candidate := fmt.Sprintf("ITEM-%04d", nextNumber)
		var count int64
		s.db.Model(&models.Product{}).Where("item_id = ?", candidate).Count(&count)
		if count == 0 {
			return candidate, nil
		}
		nextNumber++
	}
}

// GetProductsByCategory - Get products by category for dropdown
func (s *ProductService) GetProductsByCategory(kategori, site string) ([]structs.ProductListResponse, error) {
	var products []models.Product

	query := s.db.Where("kategori_sampel = ? AND lokasi_site = ?", kategori, site).
		Order("item_name ASC")

	if err := query.Preload("Creator").Find(&products).Error; err != nil {
		return nil, err
	}

	response := make([]structs.ProductListResponse, len(products))
	for i, product := range products {
		response[i] = structs.ProductListResponse{
			Id:             product.Id,
			ItemID:         product.ItemID,
			KategoriSampel: product.KategoriSampel,
			ItemCode:       product.ItemCode,
			ItemName:       product.ItemName,
			Keterangan:     product.Keterangan,
			LokasiSite:     product.LokasiSite,
			CreatedAt:      product.CreatedAt,
			CreatedBy:      product.Creator.Name,
		}
	}

	return response, nil
}

// GetCategories - Get all available categories
func (s *ProductService) GetCategories() []string {
	return []string{
		"RM",
		"PM",
		"RUAH",
		"FINISHED_GOOD",
		"STABTEST",
		"MIKRO",
		"PROSES",
		"WS",
		"LAINNYA",
		"EHM",
	}
}

// GetProductByID - Helper to get product by ID
func (s *ProductService) GetProductByID(productID uint) (*models.Product, error) {
	var product models.Product
	if err := s.db.First(&product, productID).Error; err != nil {
		return nil, err
	}
	return &product, nil
}

// SearchProducts - Advanced search with multiple criteria
func (s *ProductService) SearchProducts(site, category, keyword string, limit int) ([]structs.ProductListResponse, error) {
	var products []models.Product

	query := s.db.Model(&models.Product{})

	if site != "" {
		query = query.Where("lokasi_site = ?", site)
	}

	if category != "" {
		query = query.Where("kategori_sampel = ?", category)
	}

	if keyword != "" {
		query = query.Where(
			"item_code LIKE ? OR item_name LIKE ? OR item_id LIKE ?",
			"%"+keyword+"%",
			"%"+keyword+"%",
			"%"+keyword+"%",
		)
	}

	if limit > 0 {
		query = query.Limit(limit)
	}

	if err := query.
		Preload("Creator").
		Order("item_name ASC").
		Find(&products).Error; err != nil {
		return nil, err
	}

	response := make([]structs.ProductListResponse, len(products))
	for i, product := range products {
		response[i] = structs.ProductListResponse{
			Id:             product.Id,
			ItemID:         product.ItemID,
			KategoriSampel: product.KategoriSampel,
			ItemCode:       product.ItemCode,
			ItemName:       product.ItemName,
			Keterangan:     product.Keterangan,
			LokasiSite:     product.LokasiSite,
			CreatedAt:      product.CreatedAt,
			CreatedBy:      product.Creator.Name,
		}
	}

	return response, nil
}

// GetProductStats - Get statistics for dashboard
func (s *ProductService) GetProductStats(site string) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total products
	var total int64
	query := s.db.Model(&models.Product{})
	if site != "" {
		query = query.Where("lokasi_site = ?", site)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}
	stats["total"] = total

	// Count by category
	categories := s.GetCategories()
	categoryCounts := make(map[string]int64)

	for _, cat := range categories {
		var count int64
		query := s.db.Model(&models.Product{}).Where("kategori_sampel = ?", cat)
		if site != "" {
			query = query.Where("lokasi_site = ?", site)
		}
		if err := query.Count(&count).Error; err != nil {
			return nil, err
		}
		categoryCounts[cat] = count
	}
	stats["by_category"] = categoryCounts

	// Count by site
	var siteCounts []map[string]interface{}
	if err := s.db.Model(&models.Product{}).
		Select("lokasi_site, COUNT(*) as count").
		Group("lokasi_site").
		Scan(&siteCounts).Error; err != nil {
		return nil, err
	}
	stats["by_site"] = siteCounts

	return stats, nil
}
