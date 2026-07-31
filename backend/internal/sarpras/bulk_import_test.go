package sarpras

import (
	"context"
	"testing"

	"emertrack/internal/domain"
	"emertrack/mocks"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/gorm"
)

// --- Helper functions for tests ---

func TestFindBulkImportHeaderRow_Found(t *testing.T) {
	rows := [][]string{
		{"guide"},
		{"sarpras_type_code", "location_dept_code"},
	}
	idx, err := findBulkImportHeaderRow(rows)
	assert.NoError(t, err)
	assert.Equal(t, 1, idx)
}

func TestFindBulkImportHeaderRow_NotFound(t *testing.T) {
	_, err := findBulkImportHeaderRow([][]string{{"other_col"}})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "sarpras_type_code")
}

func TestValidateBulkImportRequiredColumns_Missing(t *testing.T) {
	err := validateBulkImportRequiredColumns(map[string]int{"sarpras_type_code": 0})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "location_dept_code")
}

func TestValidateBulkImportRowCount(t *testing.T) {
	assert.Error(t, validateBulkImportRowCount(0))
	assert.Error(t, validateBulkImportRowCount(5001))
	assert.NoError(t, validateBulkImportRowCount(1))
}

func TestCollectNonEmptyBulkImportRows(t *testing.T) {
	// Simulasikan cara production: loadBulkImportExcel memanggil
	//   dataRows := allRows[headerRowIdx+3:]
	//   nonEmpty := collectNonEmptyBulkImportRows(dataRows, headerRowIdx)
	// Jadi fungsi menerima slice yang sudah dipotong dari luar.
	// headerRowIdx = 2, allRows[2+3:] = allRows[5:]
	allRows := [][]string{
		{"guide1"},             // indeks 0
		{"guide2"},             // indeks 1
		{"header1", "header2"}, // indeks 2 - header row (headerRowIdx=2)
		{"contoh1", "contoh2"}, // indeks 3 - baris contoh (dilewati via slice)
		{"contoh3", "contoh4"}, // indeks 4 - baris contoh (dilewati via slice)
		{"", ""},               // indeks 5 - data kosong, dilewati
		{"HYD", "WATER"},       // indeks 6 - data valid
	}
	headerRowIdx := 2
	dataRows := allRows[headerRowIdx+3:] // = allRows[5:] → hanya indeks 5 dan 6
	rows := collectNonEmptyBulkImportRows(dataRows, headerRowIdx)
	// excelRow = headerRowIdx + 4 + i = 2 + 4 + 1 = 7 untuk HYD (i=1 karena indeks 5 kosong)
	assert.Len(t, rows, 1)
	assert.Equal(t, "HYD", rows[0].data[0])
	assert.Equal(t, 7, rows[0].excelRow)
}

func TestBulkImportGetCell(t *testing.T) {
	colIdx := map[string]int{"sarpras_type_code": 0, "location_detail": 1}
	row := []string{"  APAR  ", "Lobby"}
	assert.Equal(t, "APAR", bulkImportGetCell(row, "sarpras_type_code", colIdx))
	assert.Equal(t, "Lobby", bulkImportGetCell(row, "location_detail", colIdx))
	assert.Equal(t, "", bulkImportGetCell(row, "missing", colIdx))
}

func TestValidateBulkParseTypeCode(t *testing.T) {
	errs := validateBulkParseTypeCode("")
	assert.Contains(t, errs, "sarpras_type_code wajib diisi")

	errs = validateBulkParseTypeCode("THIS_CODE_IS_WAY_TOO_LONG_FOR_FIELD")
	assert.Contains(t, errs[0], "maks 20")

	assert.Nil(t, validateBulkParseTypeCode("APAR"))
}

func TestValidateBulkParseBoolFields(t *testing.T) {
	errs := validateBulkParseBoolFields("ya", "tidak", "maybe")
	assert.Len(t, errs, 1)
	assert.Contains(t, errs[0], "has_risk_location")
}

func TestValidateBulkParseExpiredDate(t *testing.T) {
	assert.Nil(t, validateBulkParseExpiredDate(""))
	errs := validateBulkParseExpiredDate("not-a-date")
	assert.Len(t, errs, 1)
	assert.Nil(t, validateBulkParseExpiredDate("2026-12-31"))
}

func TestBulkParseAPARError(t *testing.T) {
	st := &domain.SarprasType{IsAPAR: true}
	errs := bulkParseAPARError(st, "")
	assert.Len(t, errs, 1)
	assert.Contains(t, errs[0], "APAB dan APAR wajib mengisi expired_date")

	assert.Nil(t, bulkParseAPARError(st, "2026-12-31"))
	assert.Nil(t, bulkParseAPARError(&domain.SarprasType{IsAPAR: false}, ""))
}

func TestResolveBulkValidateSiteCode(t *testing.T) {
	assert.Equal(t, "SITE1", resolveBulkValidateSiteCode("", "SITE1"))
	assert.Equal(t, "SITE2", resolveBulkValidateSiteCode("site2", "SITE1"))
}

func TestValidateBulkExecuteExpiredDate(t *testing.T) {
	bad := "bad"
	errs := validateBulkExecuteExpiredDate(&bad)
	assert.Len(t, errs, 1)
	assert.Contains(t, errs[0], "format YYYY-MM-DD")
	good := "2026-01-01"
	assert.Nil(t, validateBulkExecuteExpiredDate(&good))
	assert.Nil(t, validateBulkExecuteExpiredDate(nil))
}

func TestBuildBulkValidateResponse(t *testing.T) {
	items := []domain.BulkImportItemRequest{{Row: 1}, {Row: 2}}
	rowErrors := []bulkValidateRowError{{Row: 2, Errors: []string{"err"}}}
	res := buildBulkValidateResponse(items, rowErrors)
	assert.False(t, res.Valid)
	assert.Equal(t, 2, res.TotalRows)
	assert.Equal(t, 1, res.ErrorRows)
}

// --- Tests using real service with mocks ---

func TestParseBulkImportRow_Valid(t *testing.T) {
	svc, stRepo, _, mRepo, _, _ := bulkImportTestService(t)
	ctx := context.Background()

	stRepo.On("FindByCode", ctx, "APAR").Return(&domain.SarprasType{Code: "APAR", IsAPAR: false}, nil)
	mRepo.On("FindByCodeDepartment", ctx, "ENG").Return(&domain.Department{Code: "ENG"}, nil)

	colIdx := map[string]int{
		"sarpras_type_code": 0, "location_dept_code": 1, "location_detail": 2,
		"is_critical": 3, "has_alternative": 4, "has_risk_location": 5, "expired_date": 6,
	}
	entry := bulkImportNonEmptyRow{
		data:     []string{"APAR", "ENG", "Lobby", "ya", "tidak", "tidak", ""},
		excelRow: 5,
	}

	row := svc.parseBulkImportRow(ctx, entry, "SITE1", colIdx, map[string]*domain.SarprasType{}, map[string]*domain.Department{})
	assert.True(t, row.Valid)
	assert.Equal(t, "APAR", row.SarprasTypeCode)
	assert.Equal(t, "SITE1", row.SiteCode)
	assert.Equal(t, "Lobby", row.LocationDetail)
}

func TestParseBulkImportRow_InvalidType(t *testing.T) {
	svc, stRepo, _, mRepo, _, _ := bulkImportTestService(t)
	ctx := context.Background()

	stRepo.On("FindByCode", ctx, "UNKNOWN").Return(nil, assert.AnError)
	mRepo.On("FindByCodeDepartment", ctx, "ENG").Return(&domain.Department{Code: "ENG"}, nil).Maybe()
	mRepo.On("FindByCodeSite", ctx, "SITE1").Return(&domain.Site{Code: "SITE1"}, nil).Maybe()

	colIdx := map[string]int{
		"sarpras_type_code": 0, "location_dept_code": 1, "location_detail": 2,
		"is_critical": 3, "has_alternative": 4, "has_risk_location": 5, "expired_date": 6,
	}
	entry := bulkImportNonEmptyRow{
		data:     []string{"UNKNOWN", "ENG", "Lobby", "ya", "tidak", "tidak", ""},
		excelRow: 5,
	}

	row := svc.parseBulkImportRow(ctx, entry, "SITE1", colIdx, map[string]*domain.SarprasType{}, map[string]*domain.Department{})
	assert.False(t, row.Valid)
	assert.Contains(t, row.Errors[0], "tidak ditemukan di master")
}

func TestValidateBulkImportItem_InvalidMaster(t *testing.T) {
	svc, stRepo, _, mRepo, _, _ := bulkImportTestService(t)
	ctx := context.Background()
	cache := newBulkImportMasterCache()

	stRepo.On("FindByCode", ctx, "UNKNOWN").Return(nil, assert.AnError)
	mRepo.On("FindByCodeDepartment", ctx, "ENG").Return(&domain.Department{Code: "ENG"}, nil)
	mRepo.On("FindByCodeSite", ctx, "SITE1").Return(&domain.Site{Code: "SITE1"}, nil)

	exp := "2026-12-31"
	item := domain.BulkImportItemRequest{
		Row:              3,
		SarprasTypeCode:  "UNKNOWN",
		LocationDeptCode: "ENG",
		SiteCode:         "SITE1",
		ExpiredDate:      &exp,
		IsCritical:       true,
		HasAlternative:   false,
		HasRiskLocation:  true,
	}
	errs := svc.validateBulkImportItem(ctx, item, "SITE1", cache)
	assert.Contains(t, errs[0], "tidak ditemukan di master")
}

func TestValidateBulkImportItem_InvalidSite(t *testing.T) {
	svc, _, _, mRepo, _, _ := bulkImportTestService(t)
	ctx := context.Background()
	cache := newBulkImportMasterCache()

	mRepo.On("FindByCodeSite", ctx, "SITE99").Return(nil, assert.AnError)

	errs := svc.validateBulkImportSiteCode(ctx, "SITE99", cache)
	assert.Contains(t, errs[0], "tidak ditemukan di master")
}

func TestCachedSarprasType_UsesCache(t *testing.T) {
	svc, stRepo, _, _, _, _ := bulkImportTestService(t)
	ctx := context.Background()
	cache := map[string]*domain.SarprasType{}
	st := &domain.SarprasType{Code: "APAR"}

	stRepo.On("FindByCode", ctx, "APAR").Return(st, nil).Once()

	assert.Equal(t, st, svc.cachedSarprasType(ctx, "apar", cache))
	assert.Equal(t, st, svc.cachedSarprasType(ctx, "APAR", cache))
}

func TestValidateBulkImportAPAR_RequiresExpiry(t *testing.T) {
	svc, stRepo, _, _, _, _ := bulkImportTestService(t)
	ctx := context.Background()
	cache := newBulkImportMasterCache()

	stRepo.On("FindByCode", ctx, "APAR").Return(&domain.SarprasType{Code: "APAR", IsAPAR: true}, nil)

	item := domain.BulkImportItemRequest{SarprasTypeCode: "APAR"}
	errs := svc.validateBulkImportAPAR(ctx, item, cache)
	assert.Len(t, errs, 1)
	assert.Contains(t, errs[0], "expired_date")
}

// --- Helper setup for tests that need service ---
func dummyDB() *gorm.DB {
	return &gorm.DB{
		Config: &gorm.Config{
			SkipDefaultTransaction: true,
		},
	}
}

func bulkImportTestService(t *testing.T) (
	*sarprasService,
	*mocks.SarprasTypeRepository,
	*mocks.SarprasRepository,
	*mocks.MasterRepository,
	*mocks.ApprovalRepository,
	*mocks.NotificationService,
) {
	stRepo := new(mocks.SarprasTypeRepository)
	sRepo := new(mocks.SarprasRepository)
	mRepo := new(mocks.MasterRepository)
	aRepo := new(mocks.ApprovalRepository)
	nServ := new(mocks.NotificationService)
	db := dummyDB()
	svc := NewSarprasService(stRepo, sRepo, mRepo, aRepo, nServ, db).(*sarprasService)
	t.Cleanup(func() {
		stRepo.AssertExpectations(t)
		mRepo.AssertExpectations(t)
	})
	return svc, stRepo, sRepo, mRepo, aRepo, nServ
}

// --- suppress unused warnings ---
var _ = mock.Anything
