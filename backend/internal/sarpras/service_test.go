package sarpras_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"emertrack/internal/domain"
	"emertrack/internal/sarpras"
	"emertrack/mocks"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// dummyDB returns a real *gorm.DB backed by sqlmock.
// getBulkValidateDefaultSiteCode calls s.db.WithContext(ctx).Find(&sites);
// sqlmock matches the SELECT and returns 0 rows so the function returns ""
// safely — each BulkImportItemRequest already carries its own SiteCode.
func dummyDB() *gorm.DB {
	db, mk, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		panic(err)
	}
	mk.ExpectQuery(".*").WillReturnRows(sqlmock.NewRows(nil))
	gormDB, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      db,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{SkipDefaultTransaction: true})
	if err != nil {
		panic(err)
	}
	return gormDB
}

func setupService(t *testing.T) (
	domain.SarprasService,
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

	svc := sarpras.NewSarprasService(stRepo, sRepo, mRepo, aRepo, nServ, db)
	return svc, stRepo, sRepo, mRepo, aRepo, nServ
}

// ─── Sarpras Type Tests ───────────────────────────────────────────────────────

func TestGetSarprasTypeDetail_Success(t *testing.T) {
	svc, stRepo, _, _, _, _ := setupService(t)
	ctx := context.Background()

	expectedDetail := &domain.SarprasTypeDetail{
		ID:                 1,
		Code:               "APAR",
		SarprasName:        "Alat Pemadam Api Ringan",
		InspIntervalMonths: 3,
	}

	stRepo.On("Detail", ctx, uint(1)).Return(expectedDetail, nil)

	res, err := svc.GetSarprasTypeDetail(ctx, 1)

	assert.NoError(t, err)
	assert.NotNil(t, res)
	assert.Equal(t, "APAR", res.Code)
	assert.Equal(t, 3, res.InspIntervalMonths)
	stRepo.AssertExpectations(t)
}

func TestGetSarprasTypeDetail_NotFound(t *testing.T) {
	svc, stRepo, _, _, _, _ := setupService(t)
	ctx := context.Background()

	stRepo.On("Detail", ctx, uint(99)).Return(nil, nil)

	res, err := svc.GetSarprasTypeDetail(ctx, 99)

	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Equal(t, "sarpras type not found", err.Error())
	stRepo.AssertExpectations(t)
}

func TestListSarprasTypes_Success(t *testing.T) {
	svc, stRepo, _, _, _, _ := setupService(t)
	ctx := context.Background()
	filter := map[string]interface{}{"is_apar": true}

	expectedList := []domain.SarprasTypeRow{
		{ID: 1, Code: "APAR", Name: "Alat Pemadam Api Ringan", InspIntervalMonths: 1},
		{ID: 2, Code: "HYD", Name: "Hydrant", InspIntervalMonths: 6},
	}

	stRepo.On("List", ctx, filter).Return(expectedList, nil)

	res, err := svc.ListSarprasTypes(ctx, filter)

	assert.NoError(t, err)
	assert.Len(t, res, 2)
	assert.Equal(t, "HYD", res[1].Code)
	assert.Equal(t, 6, res[1].InspIntervalMonths)
	stRepo.AssertExpectations(t)
}

// ─── Sarpras Detail Tests ─────────────────────────────────────────────────────

func TestGetSarprasDetail_Success(t *testing.T) {
	svc, _, sRepo, _, _, _ := setupService(t)
	ctx := context.Background()
	testCode := "APAR-ENG-HSE"

	mockSarpras := &domain.Sarpras{
		ID:             1,
		Code:           testCode,
		Status:         domain.SarprasReady,
		RiskLevel:      "High",
		LocationDetail: "Lobby Utama",
		SarprasType: domain.SarprasType{
			Name:               "APAR",
			InspIntervalMonths: 3,
			PICDept:            domain.Department{Name: "HSE"},
		},
		LocationDept: domain.Department{
			Name: "Engineering",
			Site: domain.Site{Name: "Cikarang"},
		},
	}

	sRepo.On("FindByCode", ctx, testCode).Return(mockSarpras, nil)
	sRepo.On("GetLastChecker", ctx, uint(1)).Return("Budi Santoso", nil)

	res, err := svc.GetSarprasDetail(ctx, testCode)

	assert.NoError(t, err)
	assert.NotNil(t, res)
	assert.Equal(t, "APAR", res.Name)
	assert.Equal(t, testCode, res.SerialNumber)
	assert.Equal(t, "Lobby Utama", res.Location)
	assert.Equal(t, "Engineering", res.Department)
	assert.Equal(t, "Cikarang", res.Site)
	assert.Equal(t, 3, res.InspIntervalMonths)
	assert.Contains(t, res.QRCode, "data:image/png;base64,")
	sRepo.AssertExpectations(t)
}

func TestGetSarprasDetail_NotFound(t *testing.T) {
	svc, _, sRepo, _, _, _ := setupService(t)
	ctx := context.Background()
	testCode := "INVALID-CODE"

	sRepo.On("FindByCode", ctx, testCode).Return(nil, errors.New("record not found"))

	res, err := svc.GetSarprasDetail(ctx, testCode)

	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Equal(t, "record not found", err.Error())
	sRepo.AssertExpectations(t)
}

// ─── Basic List & Get Tests ───────────────────────────────────────────────────

func TestGetSarpras_Success(t *testing.T) {
	svc, _, sRepo, _, _, _ := setupService(t)
	ctx := context.Background()

	expected := &domain.Sarpras{ID: 1, Code: "APAR-001"}
	sRepo.On("FindByID", ctx, uint(1)).Return(expected, nil)

	res, err := svc.GetSarpras(ctx, 1)

	assert.NoError(t, err)
	assert.Equal(t, "APAR-001", res.Code)
	sRepo.AssertExpectations(t)
}

func TestListSarpras_Success(t *testing.T) {
	svc, _, sRepo, _, _, _ := setupService(t)
	ctx := context.Background()

	status := domain.SarprasStatus(domain.SarprasReady)
	filter := domain.SarprasFilter{Status: &status}

	expectedRows := []domain.SarprasRow{{ID: 1, Code: "APAR-001"}}
	var expectedTotal int64 = 1

	sRepo.On("List", ctx, filter).Return(expectedRows, expectedTotal, nil)

	res, total, err := svc.ListSarpras(ctx, filter)

	assert.NoError(t, err)
	assert.Equal(t, expectedTotal, total)
	assert.Len(t, res, 1)
	sRepo.AssertExpectations(t)
}

// ─── Bulk Import Tests ────────────────────────────────────────────────────────

func TestBulkImportValidate_ValidItem(t *testing.T) {
	svc, stRepo, _, mRepo, _, _ := setupService(t)
	ctx := context.Background()

	stRepo.On("FindByCode", ctx, "APAR").Return(&domain.SarprasType{Code: "APAR"}, nil)
	mRepo.On("FindByCodeDepartment", ctx, "ENG").Return(&domain.Department{Code: "ENG"}, nil)
	mRepo.On("FindByCodeSite", ctx, "CKR").Return(&domain.Site{Code: "CKR"}, nil)

	exp := "2026-12-31"
	req := domain.BulkExecuteRequest{
		Items: []domain.BulkImportItemRequest{{
			Row:              4,
			SarprasTypeCode:  "APAR",
			LocationDeptCode: "ENG",
			SiteCode:         "CKR",
			LocationDetail:   "Lobby",
			ExpiredDate:      &exp,
			IsCritical:       true,
			HasAlternative:   false,
			HasRiskLocation:  true,
		}},
	}

	res, err := svc.BulkImportValidate(ctx, req)
	assert.NoError(t, err)
	assert.True(t, res.Valid)
	assert.Equal(t, 0, res.ErrorRows)
	stRepo.AssertExpectations(t)
	mRepo.AssertExpectations(t)
}

func TestBulkImportValidate_InvalidType(t *testing.T) {
	svc, stRepo, _, mRepo, _, _ := setupService(t)
	ctx := context.Background()

	stRepo.On("FindByCode", ctx, "UNKNOWN").Return(nil, errors.New("not found"))
	// validateBulkImportItem tidak short-circuit — dept dan site tetap divalidasi
	mRepo.On("FindByCodeDepartment", ctx, "ENG").Return(&domain.Department{Code: "ENG"}, nil)
	mRepo.On("FindByCodeSite", ctx, "CKR").Return(&domain.Site{Code: "CKR"}, nil)

	req := domain.BulkExecuteRequest{
		Items: []domain.BulkImportItemRequest{{
			Row: 5, SarprasTypeCode: "UNKNOWN", LocationDeptCode: "ENG", SiteCode: "CKR",
		}},
	}

	res, err := svc.BulkImportValidate(ctx, req)
	assert.NoError(t, err)
	assert.False(t, res.Valid)
	assert.Equal(t, 1, res.ErrorRows)
	stRepo.AssertExpectations(t)
	mRepo.AssertExpectations(t)
}

// ─── CalculateNextDueDate unit tests ─────────────────────────────────────────

func TestCalculateNextDueDate_WholeMonths(t *testing.T) {
	cases := []struct {
		base   string
		months int
		want   string
	}{
		{"2026-01-15", 1, "2026-02-15"},
		{"2026-01-15", 3, "2026-04-15"},
		{"2026-01-15", 6, "2026-07-15"},
		{"2026-01-15", 12, "2027-01-15"},
		{"2026-01-31", 1, "2026-03-03"}, // Go time.AddDate overflow: Feb tidak punya 31
		{"2024-01-31", 1, "2024-03-02"}, // leap year: Feb 2024 punya 29 hari, 29+2=Mar 2
		{"2026-02-28", 3, "2026-05-28"},
	}

	for _, tc := range cases {
		base, err := time.Parse("2006-01-02", tc.base)
		assert.NoError(t, err)

		result := domain.CalculateNextDueDate(base, tc.months)
		assert.Equal(t, tc.want, result.Format("2006-01-02"),
			"base=%s months=%d", tc.base, tc.months)
	}
}

// ─── Test for the missing mock (FindByCodeSite) ─────────────────────────────
func TestValidateBulkImportItem_InvalidMaster(t *testing.T) {
	svc, stRepo, _, mRepo, _, _ := setupService(t)
	ctx := context.Background()

	// validateBulkImportItem tidak short-circuit — semua field divalidasi
	stRepo.On("FindByCode", ctx, "APAR").Return(&domain.SarprasType{Code: "APAR"}, nil)
	mRepo.On("FindByCodeDepartment", ctx, "DEPT").Return(&domain.Department{Code: "DEPT"}, nil)
	mRepo.On("FindByCodeSite", ctx, "SITE1").Return(nil, errors.New("site not found"))

	exp := "2026-12-31"
	req := domain.BulkExecuteRequest{
		Items: []domain.BulkImportItemRequest{{
			Row:              1,
			SarprasTypeCode:  "APAR",
			LocationDeptCode: "DEPT",
			SiteCode:         "SITE1",
			LocationDetail:   "Lobby",
			ExpiredDate:      &exp,
			IsCritical:       true,
			HasAlternative:   false,
			HasRiskLocation:  true,
		}},
	}

	res, err := svc.BulkImportValidate(ctx, req)
	assert.NoError(t, err)
	assert.False(t, res.Valid)
	assert.Equal(t, 1, res.ErrorRows)
	stRepo.AssertExpectations(t)
	mRepo.AssertExpectations(t)
}
