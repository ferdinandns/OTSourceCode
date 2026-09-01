package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"

	// ✅ IMPORTANT: These imports must match your go.mod module name
	"lab-connect/backend-api/middlewares"
	"lab-connect/backend-api/services"
	"lab-connect/backend-api/structs"
)

type ProductController struct {
	productService *services.ProductService
	validate       *validator.Validate
}

func NewProductController(productService *services.ProductService) *ProductController {
	return &ProductController{
		productService: productService,
		validate:       validator.New(),
	}
}

// ============================================
// LIST PRODUCT ENDPOINTS
// ============================================

// GetAllProducts - GET /api/products
func (c *ProductController) GetAllProducts(ctx *gin.Context) {
	userRole, _ := middlewares.GetUserRole(ctx)
	userSite, _ := middlewares.GetUserSite(ctx)

	// Parse filter & pagination
	var filter structs.ProductFilterRequest
	if err := ctx.ShouldBindQuery(&filter); err != nil {
		c.respondWithError(ctx, http.StatusBadRequest, "Invalid query parameters", err)
		return
	}

	// Apply site filter based on user role
	if userRole != "superadmin" && userRole != "administrator" {
		filter.Site = userSite
	}

	// Set default pagination
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 {
		filter.Limit = 10
	}

	result, err := c.productService.GetAllProducts(filter)
	if err != nil {
		c.respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch products", err)
		return
	}

	c.respondWithSuccess(ctx, http.StatusOK, "Products retrieved successfully", result)
}

// ============================================
// CREATE PRODUCT ENDPOINT
// ============================================

// CreateProduct - POST /api/products
func (c *ProductController) CreateProduct(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)
	userRole, _ := middlewares.GetUserRole(ctx)
	userSite, _ := middlewares.GetUserSite(ctx)

	var req structs.CreateProductRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		c.respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate request
	if err := c.validate.Struct(req); err != nil {
		c.respondWithValidationError(ctx, err)
		return
	}

	// If not superadmin, use user's site
	if userRole != "superadmin" {
		req.LokasiSite = userSite
	}

	result, err := c.productService.CreateProduct(req, userID)
	if err != nil {
		c.respondWithError(ctx, http.StatusInternalServerError, "Failed to create product", err)
		return
	}

	c.respondWithSuccess(ctx, http.StatusCreated, "Product created successfully", result)
}

// ============================================
// GET PRODUCT DETAIL ENDPOINT
// ============================================

// GetProductDetail - GET /api/products/:id
func (c *ProductController) GetProductDetail(ctx *gin.Context) {
	productID, err := c.parseUintParam(ctx, "id")
	if err != nil {
		c.respondWithError(ctx, http.StatusBadRequest, "Invalid product ID", err)
		return
	}

	result, err := c.productService.GetProductDetail(productID)
	if err != nil {
		c.respondWithError(ctx, http.StatusNotFound, "Product not found", err)
		return
	}

	c.respondWithSuccess(ctx, http.StatusOK, "Product detail retrieved successfully", result)
}

// ============================================
// UPDATE PRODUCT ENDPOINT
// ============================================

// UpdateProduct - PUT /api/products/:id
func (c *ProductController) UpdateProduct(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)
	userGroup, _ := middlewares.GetUserGroup(ctx)

	productID, err := c.parseUintParam(ctx, "id")
	if err != nil {
		c.respondWithError(ctx, http.StatusBadRequest, "Invalid product ID", err)
		return
	}

	// Supervisor+ can edit any product; analysts can only edit their own
	if userGroup > 3 { // group 4
		product, err := c.productService.GetProductByID(productID)
		if err != nil {
			c.respondWithError(ctx, http.StatusNotFound, "Product not found", err)
			return
		}
		if product.CreatedBy != userID {
			c.respondWithError(ctx, http.StatusForbidden, "You can only edit products you created", nil)
			return
		}
	}

	var req structs.UpdateProductRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		c.respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}
	if err := c.validate.Struct(req); err != nil {
		c.respondWithValidationError(ctx, err)
		return
	}

	result, err := c.productService.UpdateProduct(productID, req, userID)
	if err != nil {
		c.respondWithError(ctx, http.StatusInternalServerError, "Failed to update product", err)
		return
	}
	c.respondWithSuccess(ctx, http.StatusOK, "Product updated successfully", result)
}

// ============================================
// DELETE PRODUCT ENDPOINT
// ============================================

// DeleteProduct - DELETE /api/products/:id
func (c *ProductController) DeleteProduct(ctx *gin.Context) {
	productID, err := c.parseUintParam(ctx, "id")
	if err != nil {
		c.respondWithError(ctx, http.StatusBadRequest, "Invalid product ID", err)
		return
	}

	err = c.productService.DeleteProduct(productID)
	if err != nil {
		c.respondWithError(ctx, http.StatusInternalServerError, "Failed to delete product", err)
		return
	}
	c.respondWithSuccess(ctx, http.StatusOK, "Product deleted successfully", nil)
}

// ============================================
// ADDITIONAL ENDPOINTS
// ============================================

// GetProductsByCategory - GET /api/products/by-category/:category
func (c *ProductController) GetProductsByCategory(ctx *gin.Context) {
	category := ctx.Param("category")
	userSite, _ := middlewares.GetUserSite(ctx)

	products, err := c.productService.GetProductsByCategory(category, userSite)
	if err != nil {
		c.respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch products", err)
		return
	}

	c.respondWithSuccess(ctx, http.StatusOK, "Products retrieved successfully", products)
}

// GetCategories - GET /api/products/categories
func (c *ProductController) GetCategories(ctx *gin.Context) {
	categories := c.productService.GetCategories()

	// Transform to detailed response
	categoryDetails := []map[string]string{
		{"code": "RM", "name": "Raw Material"},
		{"code": "PM", "name": "Packaging Material"},
		{"code": "RUAH", "name": "Ruah"},
		{"code": "FINISHED_GOOD", "name": "Finished Good"},
		{"code": "STABTEST", "name": "Stability Test"},
		{"code": "MIKRO", "name": "Microbiology"},
		{"code": "PROSES", "name": "Process"},
		{"code": "WS", "name": "WS"},
		{"code": "LAINNYA", "name": "Lainnya"},
		{"code": "EHM", "name": "Ehm"},
	}

	c.respondWithSuccess(ctx, http.StatusOK, "Categories retrieved successfully", gin.H{
		"categories": categories,
		"details":    categoryDetails,
	})
}

// SearchProducts - GET /api/products/search
func (c *ProductController) SearchProducts(ctx *gin.Context) {
	userSite, _ := middlewares.GetUserSite(ctx)
	userRole, _ := middlewares.GetUserRole(ctx)

	site := ctx.Query("site")
	category := ctx.Query("category")
	keyword := ctx.Query("keyword")
	limitStr := ctx.DefaultQuery("limit", "20")

	limit, _ := strconv.Atoi(limitStr)

	// Apply site filter based on user role
	if userRole != "superadmin" && userRole != "administrator" {
		site = userSite
	}

	products, err := c.productService.SearchProducts(site, category, keyword, limit)
	if err != nil {
		c.respondWithError(ctx, http.StatusInternalServerError, "Failed to search products", err)
		return
	}

	c.respondWithSuccess(ctx, http.StatusOK, "Search completed", gin.H{
		"keyword":  keyword,
		"category": category,
		"site":     site,
		"count":    len(products),
		"results":  products,
	})
}

// GetProductStats - GET /api/products/stats
func (c *ProductController) GetProductStats(ctx *gin.Context) {
	userSite, _ := middlewares.GetUserSite(ctx)
	userRole, _ := middlewares.GetUserRole(ctx)

	site := ""
	if userRole != "superadmin" && userRole != "administrator" {
		site = userSite
	} else {
		site = ctx.Query("site")
	}

	stats, err := c.productService.GetProductStats(site)
	if err != nil {
		c.respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch statistics", err)
		return
	}

	c.respondWithSuccess(ctx, http.StatusOK, "Statistics retrieved successfully", stats)
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// parseUintParam - Parse uint parameter from URL
func (c *ProductController) parseUintParam(ctx *gin.Context, param string) (uint, error) {
	id, err := strconv.ParseUint(ctx.Param(param), 10, 32)
	if err != nil {
		return 0, err
	}
	return uint(id), nil
}

// respondWithError - Send error response
func (c *ProductController) respondWithError(ctx *gin.Context, statusCode int, message string, err error) {
	response := structs.ErrorResponse{
		Status:  "error",
		Message: message,
	}

	if err != nil {
		response.Details = err.Error()
	}

	ctx.JSON(statusCode, response)
}

// respondWithSuccess - Send success response
func (c *ProductController) respondWithSuccess(ctx *gin.Context, statusCode int, message string, data interface{}) {
	ctx.JSON(statusCode, structs.SuccessResponse{
		Status:  "success",
		Message: message,
		Data:    data,
	})
}

// respondWithValidationError - Send validation error response
func (c *ProductController) respondWithValidationError(ctx *gin.Context, err error) {
	validationErrors := make(map[string]string)

	if errs, ok := err.(validator.ValidationErrors); ok {
		for _, e := range errs {
			validationErrors[e.Field()] = c.formatValidationError(e)
		}
	}

	ctx.JSON(http.StatusBadRequest, structs.ErrorResponse{
		Status:  "error",
		Message: "Validation failed",
		Details: validationErrors,
	})
}

// formatValidationError - Format validation error message
func (c *ProductController) formatValidationError(err validator.FieldError) string {
	switch err.Tag() {
	case "required":
		return err.Field() + " is required"
	case "email":
		return err.Field() + " must be a valid email"
	case "min":
		return err.Field() + " must be at least " + err.Param()
	case "max":
		return err.Field() + " must be at most " + err.Param()
	case "oneof":
		return err.Field() + " must be one of: " + err.Param()
	default:
		return err.Field() + " is invalid"
	}
}
