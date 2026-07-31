package inspection

import (
	"context"
	"errors"
	"testing"
	"time"

	"emertrack/internal/domain"
	"emertrack/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/gorm"
)

// setupService initialises the real inspection service with mock dependencies.
func setupService(t *testing.T) (
	domain.InspectionService,
	*mocks.InspectionRepository,
	*mocks.SarprasRepository,
	*mocks.SarprasTypeRepository,
	*mocks.RefillRepository,
	*mocks.RepairRepository,
	*mocks.AuditService,
	*mocks.UserRepository,
	*mocks.NotificationService,
) {
	inspRepo := new(mocks.InspectionRepository)
	sarprasRepo := new(mocks.SarprasRepository)
	stRepo := new(mocks.SarprasTypeRepository)
	refillRepo := new(mocks.RefillRepository)
	repairRepo := new(mocks.RepairRepository)
	auditSvc := new(mocks.AuditService)
	userRepo := new(mocks.UserRepository)
	notifSvc := new(mocks.NotificationService)

	dummyDB := &gorm.DB{}

	deps := InspectionServiceDeps{
		InspRepo:    inspRepo,
		SarprasRepo: sarprasRepo,
		StRepo:      stRepo,
		RefillRepo:  refillRepo,
		NotifSvc:    notifSvc,
		AuditSvc:    auditSvc,
		UserRepo:    userRepo,
		DB:          dummyDB,
	}

	svc := NewService(deps)

	return svc, inspRepo, sarprasRepo, stRepo, refillRepo, repairRepo, auditSvc, userRepo, notifSvc
}

// futureDate returns a due date within the H-10 inspection window.
func futureDate() *time.Time {
	d := time.Now().AddDate(0, 0, 5)
	return &d
}

// farFutureDate returns a due date outside the H-10 inspection window.
func farFutureDate() *time.Time {
	d := time.Now().AddDate(0, 0, 30)
	return &d
}

// ─── GetInspectionForm Tests ─────────────────────────────────────────────────

func TestGetInspectionForm_Success(t *testing.T) {
	svc, _, sarprasRepo, stRepo, refillRepo, _, _, _, _ := setupService(t)
	ctx := context.Background()

	dueDate := futureDate()
	mockSarpras := &domain.Sarpras{
		ID:            1,
		Code:          "APAR-HSE-001",
		SarprasTypeID: 10,
		SarprasType: domain.SarprasType{
			Name: "APAR",
		},
		DueDate: dueDate,
	}
	mockParams := []domain.Parameter{
		{ID: 1, SarprasTypeID: 10, Name: "Tekanan", OrderNo: 1},
		{ID: 2, SarprasTypeID: 10, Name: "Kondisi Selang", OrderNo: 2},
	}

	sarprasRepo.On("FindByID", ctx, uint(1)).Return(mockSarpras, nil)
	stRepo.On("GetParametersByType", ctx, uint(10)).Return(mockParams, nil)
	refillRepo.On("GetActiveRefillBySarprasID", ctx, uint(1)).Return(nil, nil)

	result, err := svc.GetInspectionForm(ctx, 1)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, uint(1), result.SarprasID)
	assert.Equal(t, "APAR-HSE-001", result.SarprasCode)
	assert.Equal(t, "APAR", result.SarprasName)
	assert.Len(t, result.Parameters, 2)
	assert.True(t, result.CanInspect)

	sarprasRepo.AssertExpectations(t)
	stRepo.AssertExpectations(t)
	refillRepo.AssertExpectations(t)
}

func TestGetInspectionForm_SarprasNotFound(t *testing.T) {
	svc, _, sarprasRepo, _, refillRepo, _, _, _, _ := setupService(t)
	ctx := context.Background()

	sarprasRepo.On("FindByID", ctx, uint(99)).Return(nil, errors.New("record not found"))
	// refillRepo dipanggil di service, tapi sarpras tidak ditemukan sehingga tidak perlu ekspektasi?
	// Sebenarnya service tetap memanggil refillRepo setelah FindByID, jadi perlu:
	refillRepo.On("GetActiveRefillBySarprasID", ctx, uint(99)).Return(nil, nil).Maybe()

	result, err := svc.GetInspectionForm(ctx, 99)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "sarpras tidak ditemukan")
	sarprasRepo.AssertExpectations(t)
}

func TestGetInspectionForm_ParameterLoadFail(t *testing.T) {
	svc, _, sarprasRepo, stRepo, refillRepo, _, _, _, _ := setupService(t)
	ctx := context.Background()

	mockSarpras := &domain.Sarpras{
		ID:            2,
		Code:          "HYD-001",
		SarprasTypeID: 20,
		SarprasType:   domain.SarprasType{Name: "Hydrant"},
		DueDate:       futureDate(),
	}

	sarprasRepo.On("FindByID", ctx, uint(2)).Return(mockSarpras, nil)
	stRepo.On("GetParametersByType", ctx, uint(20)).Return(nil, errors.New("db error"))
	refillRepo.On("GetActiveRefillBySarprasID", mock.Anything, uint(2)).Return(nil, nil).Maybe()

	result, err := svc.GetInspectionForm(ctx, 2)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "gagal memuat parameter")
	sarprasRepo.AssertExpectations(t)
	stRepo.AssertExpectations(t)
	refillRepo.AssertExpectations(t)
}

func TestGetInspectionForm_CannotInspect_TooFarFromDueDate(t *testing.T) {
	svc, _, sarprasRepo, stRepo, refillRepo, _, _, _, _ := setupService(t)
	ctx := context.Background()

	mockSarpras := &domain.Sarpras{
		ID:            3,
		Code:          "APAR-003",
		SarprasTypeID: 10,
		SarprasType:   domain.SarprasType{Name: "APAR"},
		DueDate:       farFutureDate(),
	}
	mockParams := []domain.Parameter{}

	sarprasRepo.On("FindByID", ctx, uint(3)).Return(mockSarpras, nil)
	stRepo.On("GetParametersByType", ctx, uint(10)).Return(mockParams, nil)
	refillRepo.On("GetActiveRefillBySarprasID", ctx, uint(3)).Return(nil, nil)

	result, err := svc.GetInspectionForm(ctx, 3)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.False(t, result.CanInspect)
}

// ─── ListActiveTasks Tests ────────────────────────────────────────────────────

func TestListActiveTasks_Success(t *testing.T) {
	svc, inspRepo, _, _, _, _, _, _, _ := setupService(t)
	ctx := context.Background()

	filter := domain.InspectionFilter{Page: 1, PageSize: 10}
	expectedRows := []domain.InspectionRow{
		{ID: 1, SarprasCode: "APAR-001", SarprasName: "APAR", ScheduleStatus: domain.SchedulePending},
		{ID: 2, SarprasCode: "HYD-001", SarprasName: "Hydrant", ScheduleStatus: domain.ScheduleInProgress},
	}
	var expectedTotal int64 = 2

	inspRepo.On("ListActiveTasks", ctx, filter).Return(expectedRows, expectedTotal, nil)

	rows, total, err := svc.ListActiveTasks(ctx, filter)

	assert.NoError(t, err)
	assert.Equal(t, expectedTotal, total)
	assert.Len(t, rows, 2)
	assert.Equal(t, "APAR-001", rows[0].SarprasCode)
	inspRepo.AssertExpectations(t)
}

func TestListActiveTasks_RepositoryError(t *testing.T) {
	svc, inspRepo, _, _, _, _, _, _, _ := setupService(t)
	ctx := context.Background()

	filter := domain.InspectionFilter{Page: 1, PageSize: 10}
	inspRepo.On("ListActiveTasks", ctx, filter).Return(nil, int64(0), errors.New("db error"))

	rows, total, err := svc.ListActiveTasks(ctx, filter)

	assert.Error(t, err)
	assert.Nil(t, rows)
	assert.Equal(t, int64(0), total)
	inspRepo.AssertExpectations(t)
}

func TestListActiveTasks_WithFilter(t *testing.T) {
	svc, inspRepo, _, _, _, _, _, _, _ := setupService(t)
	ctx := context.Background()

	sarprasID := uint(5)
	filter := domain.InspectionFilter{
		SarprasID: &sarprasID,
		Search:    "APAR",
		Page:      1,
		PageSize:  5,
	}
	expectedRows := []domain.InspectionRow{
		{ID: 1, SarprasCode: "APAR-ENG-001", SarprasName: "APAR"},
	}
	var expectedTotal int64 = 1

	inspRepo.On("ListActiveTasks", ctx, filter).Return(expectedRows, expectedTotal, nil)

	rows, total, err := svc.ListActiveTasks(ctx, filter)

	assert.NoError(t, err)
	assert.Equal(t, expectedTotal, total)
	assert.Len(t, rows, 1)
	inspRepo.AssertExpectations(t)
}

// ─── ListHistory Tests ────────────────────────────────────────────────────────

func TestListHistory_Success(t *testing.T) {
	svc, inspRepo, _, _, _, _, _, _, _ := setupService(t)
	ctx := context.Background()

	now := time.Now()
	filter := domain.InspectionHistoryFilter{Page: 1, PageSize: 20}
	expectedRows := []domain.InspectionHistoryRow{
		{
			InspectionID:  10,
			SarprasCode:   "APAR-001",
			OverallStatus: domain.ResultOK, // ← langsung gunakan domain.ResultOK
			InspectedAt:   now,
		},
		{
			InspectionID:  11,
			SarprasCode:   "HYD-002",
			OverallStatus: domain.ResultNOK, // ← langsung gunakan domain.ResultNOK
			InspectedAt:   now,
		},
	}
	var expectedTotal int64 = 2

	inspRepo.On("ListHistory", ctx, filter).Return(expectedRows, expectedTotal, nil)

	rows, total, err := svc.ListHistory(ctx, filter)

	assert.NoError(t, err)
	assert.Equal(t, expectedTotal, total)
	assert.Len(t, rows, 2)
	assert.Equal(t, domain.ResultNOK, rows[1].OverallStatus) // ← ubah assertion
	inspRepo.AssertExpectations(t)
}

func TestListHistory_Empty(t *testing.T) {
	svc, inspRepo, _, _, _, _, _, _, _ := setupService(t)
	ctx := context.Background()

	filter := domain.InspectionHistoryFilter{Page: 1, PageSize: 20}
	inspRepo.On("ListHistory", ctx, filter).Return([]domain.InspectionHistoryRow{}, int64(0), nil)

	rows, total, err := svc.ListHistory(ctx, filter)

	assert.NoError(t, err)
	assert.Equal(t, int64(0), total)
	assert.Len(t, rows, 0)
	inspRepo.AssertExpectations(t)
}

// ─── GetInspectionDetail Tests ──────────────────────────────────────────────

func TestGetInspectionDetail_Success(t *testing.T) {
	svc, inspRepo, _, _, _, _, _, _, _ := setupService(t)
	ctx := context.Background()

	now := time.Now()
	expected := &domain.Inspection{
		ID:            5,
		SarprasID:     1,
		CheckerID:     2,
		InspectedAt:   now,
		OverallStatus: domain.ResultOK,
		Items: []domain.InspectionItem{
			{ID: 1, ParameterID: 1, Status: domain.ResultOK, PhotoPath: "/uploads/photo1.jpg"},
		},
	}

	inspRepo.On("FindByID", ctx, uint(5)).Return(expected, nil)
	inspRepo.On("GetRepairOrderByInspection", ctx, uint(5)).Return(nil, errors.New("not found"))

	result, err := svc.GetInspectionDetail(ctx, 5)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, uint(5), result.ID)
	assert.Equal(t, domain.ResultOK, result.OverallStatus)
	assert.Len(t, result.Items, 1)
	inspRepo.AssertExpectations(t)
}

func TestGetInspectionDetail_NotFound(t *testing.T) {
	svc, inspRepo, _, _, _, _, _, _, _ := setupService(t)
	ctx := context.Background()

	inspRepo.On("FindByID", ctx, uint(999)).Return(nil, errors.New("record not found"))

	result, err := svc.GetInspectionDetail(ctx, 999)

	assert.Error(t, err)
	assert.Nil(t, result)
	inspRepo.AssertExpectations(t)
}

// ─── SubmitInspection Tests ──────────────────────────────────────────────────

func TestSubmitInspection_SarprasNotFound(t *testing.T) {
	svc, _, sarprasRepo, _, refillRepo, _, _, _, _ := setupService(t)
	ctx := context.Background()

	req := &domain.SubmitInspectionRequest{
		SarprasID: 99,
		Items: []domain.SubmitItemRequest{
			{ParameterID: 1, Status: domain.ResultOK, PhotoPath: "/uploads/p.jpg"},
		},
	}

	sarprasRepo.On("FindByID", ctx, uint(99)).Return(nil, errors.New("record not found"))
	refillRepo.On("GetActiveRefillBySarprasID", ctx, uint(99)).Return(nil, nil).Maybe()

	result, err := svc.SubmitInspection(ctx, req, 2)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "sarpras tidak ditemukan")
	sarprasRepo.AssertExpectations(t)
}

func TestSubmitInspection_OutsideInspectionWindow(t *testing.T) {
	svc, _, sarprasRepo, _, refillRepo, _, _, _, _ := setupService(t)
	ctx := context.Background()

	mockSarpras := &domain.Sarpras{
		ID:          1,
		Code:        "APAR-001",
		DueDate:     farFutureDate(),
		SarprasType: domain.SarprasType{InspIntervalMonths: 30},
	}

	req := &domain.SubmitInspectionRequest{
		SarprasID: 1,
		Items: []domain.SubmitItemRequest{
			{ParameterID: 1, Status: domain.ResultOK, PhotoPath: "/uploads/p.jpg"},
		},
	}

	sarprasRepo.On("FindByID", ctx, uint(1)).Return(mockSarpras, nil)
	refillRepo.On("GetActiveRefillBySarprasID", mock.Anything, uint(1)).Return(nil, nil).Maybe()

	result, err := svc.SubmitInspection(ctx, req, 2)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "belum memasuki periode H-10")
	sarprasRepo.AssertExpectations(t)
	refillRepo.AssertExpectations(t)
}

func TestSubmitInspection_MissingPhoto(t *testing.T) {
	svc, _, sarprasRepo, _, refillRepo, _, _, _, _ := setupService(t)
	ctx := context.Background()

	mockSarpras := &domain.Sarpras{
		ID:          1,
		Code:        "APAR-001",
		DueDate:     futureDate(),
		SarprasType: domain.SarprasType{InspIntervalMonths: 30},
	}

	req := &domain.SubmitInspectionRequest{
		SarprasID: 1,
		Items: []domain.SubmitItemRequest{
			{ParameterID: 1, Status: domain.ResultOK, PhotoPath: ""}, // missing photo
		},
	}

	sarprasRepo.On("FindByID", ctx, uint(1)).Return(mockSarpras, nil)
	refillRepo.On("GetActiveRefillBySarprasID", ctx, uint(1)).Return(nil, nil)

	result, err := svc.SubmitInspection(ctx, req, 2)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "foto wajib diisi")
	sarprasRepo.AssertExpectations(t)
	refillRepo.AssertExpectations(t)
}

func TestSubmitInspection_NOKWithoutNotes(t *testing.T) {
	svc, _, sarprasRepo, _, refillRepo, _, _, _, _ := setupService(t)
	ctx := context.Background()

	mockSarpras := &domain.Sarpras{
		ID:          1,
		Code:        "APAR-001",
		DueDate:     futureDate(),
		SarprasType: domain.SarprasType{InspIntervalMonths: 30},
	}

	req := &domain.SubmitInspectionRequest{
		SarprasID: 1,
		Items: []domain.SubmitItemRequest{
			{ParameterID: 1, Status: domain.ResultNOK, PhotoPath: "/uploads/p.jpg", Notes: ""}, // NOK but no notes
		},
	}

	sarprasRepo.On("FindByID", ctx, uint(1)).Return(mockSarpras, nil)
	refillRepo.On("GetActiveRefillBySarprasID", ctx, uint(1)).Return(nil, nil)

	result, err := svc.SubmitInspection(ctx, req, 2)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "keterangan NOK wajib diisi")
	sarprasRepo.AssertExpectations(t)
	refillRepo.AssertExpectations(t)
}

// ─── CanInspect Unit Tests ────────────────────────────────────────────────────

func TestCanInspect_NilDueDate(t *testing.T) {
	assert.False(t, domain.CanInspect(nil))
}

func TestCanInspect_WithinWindow(t *testing.T) {
	d := time.Now().AddDate(0, 0, 5)
	assert.True(t, domain.CanInspect(&d))
}

func TestCanInspect_OutsideWindow(t *testing.T) {
	d := time.Now().AddDate(0, 0, 15)
	assert.False(t, domain.CanInspect(&d))
}

func TestCanInspect_PastDueDate(t *testing.T) {
	d := time.Now().AddDate(0, 0, -1)
	assert.True(t, domain.CanInspect(&d))
}

// ─── Compile-time check ─────────────────────────────────────────────────────

var _ domain.InspectionService = (*mockInspectionServiceCompileCheck)(nil)

type mockInspectionServiceCompileCheck struct{}

func (m *mockInspectionServiceCompileCheck) GetInspectionForm(ctx context.Context, sarprasID uint) (*domain.InspectionFormResponse, error) {
	return nil, nil
}
func (m *mockInspectionServiceCompileCheck) SubmitInspection(ctx context.Context, req *domain.SubmitInspectionRequest, checkerID uint) (*domain.InspectionSubmitResult, error) {
	return nil, nil
}
func (m *mockInspectionServiceCompileCheck) ListActiveTasks(ctx context.Context, filter domain.InspectionFilter) ([]domain.InspectionRow, int64, error) {
	return nil, 0, nil
}
func (m *mockInspectionServiceCompileCheck) ListHistory(ctx context.Context, filter domain.InspectionHistoryFilter) ([]domain.InspectionHistoryRow, int64, error) {
	return nil, 0, nil
}
func (m *mockInspectionServiceCompileCheck) ListMonitoring(ctx context.Context, filter domain.InspectionMonitoringFilter) ([]domain.InspectionMonitoringRow, int64, error) {
	return nil, 0, nil
}
func (m *mockInspectionServiceCompileCheck) GetInspectionDetail(ctx context.Context, id uint) (*domain.InspectionDetailResponse, error) {
	return nil, nil
}
func (m *mockInspectionServiceCompileCheck) ClaimInspection(ctx context.Context, scheduleID uint, userID uint) error {
	return nil
}
func (m *mockInspectionServiceCompileCheck) CancelClaim(ctx context.Context, scheduleID uint, userID uint) error {
	return nil
}
func (m *mockInspectionServiceCompileCheck) GenerateSchedulesDueSoon(ctx context.Context) error {
	return nil
}
func (m *mockInspectionServiceCompileCheck) UpdateOverdueSchedules(ctx context.Context) error {
	return nil
}
func (m *mockInspectionServiceCompileCheck) UpdateMarkAsNotReady(ctx context.Context) error {
	return nil
}
func (m *mockInspectionServiceCompileCheck) UpdateOverdueAndNotReady(ctx context.Context) error {
	return nil
}
func (m *mockInspectionServiceCompileCheck) SendInspectionReminders(ctx context.Context) error {
	return nil
}
