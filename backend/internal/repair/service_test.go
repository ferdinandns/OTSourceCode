package repair_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"emertrack/internal/domain"
	"emertrack/internal/repair"
	"emertrack/mocks"
	"emertrack/pkg/email"

	"github.com/stretchr/testify/assert"
	// Hapus import mock yang tidak digunakan
	"gorm.io/gorm"
)

// setupService initialises the real repair service with mock dependencies.
func setupService(t *testing.T) (
	domain.RepairService,
	*mocks.RepairRepository,
	*mocks.SarprasRepository,
	*mocks.AuditService,
) {
	repairRepo := new(mocks.RepairRepository)
	sarprasRepo := new(mocks.SarprasRepository)
	auditSvc := new(mocks.AuditService)
	userRepo := new(mocks.UserRepository)
	notifSvc := new(mocks.NotificationService)
	mailer := &email.Mailer{} // dummy, not used in these tests

	dummyDB := &gorm.DB{}

	svc := repair.NewService(repairRepo, userRepo, sarprasRepo, auditSvc, notifSvc, mailer, dummyDB)

	return svc, repairRepo, sarprasRepo, auditSvc
}

func baseRepairOrder() *domain.RepairOrder {
	return &domain.RepairOrder{
		ID:           1,
		InspectionID: 10,
		SarprasID:    1,
		PICID:        5,
		Status:       domain.RepairAssigned,
		Sarpras: domain.Sarpras{
			ID:   1,
			Code: "APAR-HSE-001",
		},
	}
}

// ─── ListRepairs Tests ────────────────────────────────────────────────────────

func TestListRepairs_Success(t *testing.T) {
	svc, repairRepo, _, _ := setupService(t)
	ctx := context.Background()

	now := time.Now()
	filter := domain.RepairFilter{Page: 1, PageSize: 10}
	expectedRows := []domain.RepairRow{
		{
			ID:           1,
			SarprasCode:  "APAR-HSE-001",
			RepairStatus: domain.RepairAssigned,
			InspectedAt:  &now, // pointer
		},
		{
			ID:           2,
			SarprasCode:  "HYD-ENG-002",
			RepairStatus: domain.RepairInProgress,
			InspectedAt:  &now,
		},
	}
	var expectedTotal int64 = 2

	repairRepo.On("ListAll", ctx, filter).Return(expectedRows, expectedTotal, nil)

	rows, total, err := svc.ListRepairs(ctx, filter)

	assert.NoError(t, err)
	assert.Equal(t, expectedTotal, total)
	assert.Len(t, rows, 2)
	assert.Equal(t, "APAR-HSE-001", rows[0].SarprasCode)
	assert.Equal(t, domain.RepairInProgress, rows[1].RepairStatus)

	repairRepo.AssertExpectations(t)
}

func TestListRepairs_Empty(t *testing.T) {
	svc, repairRepo, _, _ := setupService(t)
	ctx := context.Background()

	filter := domain.RepairFilter{Page: 1, PageSize: 10}

	repairRepo.On("ListAll", ctx, filter).Return([]domain.RepairRow{}, int64(0), nil)

	rows, total, err := svc.ListRepairs(ctx, filter)

	assert.NoError(t, err)
	assert.Equal(t, int64(0), total)
	assert.Len(t, rows, 0)

	repairRepo.AssertExpectations(t)
}

func TestListRepairs_RepositoryError(t *testing.T) {
	svc, repairRepo, _, _ := setupService(t)
	ctx := context.Background()

	filter := domain.RepairFilter{Page: 1, PageSize: 10}

	repairRepo.On("ListAll", ctx, filter).Return(nil, int64(0), errors.New("db timeout"))

	rows, total, err := svc.ListRepairs(ctx, filter)

	assert.Error(t, err)
	assert.Nil(t, rows)
	assert.Equal(t, int64(0), total)

	repairRepo.AssertExpectations(t)
}

func TestListRepairs_WithStatusFilter(t *testing.T) {
	svc, repairRepo, _, _ := setupService(t)
	ctx := context.Background()

	status := domain.RepairSubmitted
	filter := domain.RepairFilter{
		Status:   &status,
		Page:     1,
		PageSize: 5,
	}
	expectedRows := []domain.RepairRow{
		{ID: 3, SarprasCode: "APAR-003", RepairStatus: domain.RepairSubmitted},
	}
	var expectedTotal int64 = 1

	repairRepo.On("ListAll", ctx, filter).Return(expectedRows, expectedTotal, nil)

	rows, total, err := svc.ListRepairs(ctx, filter)

	assert.NoError(t, err)
	assert.Equal(t, expectedTotal, total)
	assert.Len(t, rows, 1)
	assert.Equal(t, domain.RepairSubmitted, rows[0].RepairStatus)

	repairRepo.AssertExpectations(t)
}

// ─── GetRepairDetail Tests ────────────────────────────────────────────────────

func TestGetRepairDetail_Success(t *testing.T) {
	svc, repairRepo, _, _ := setupService(t)
	ctx := context.Background()

	now := time.Now()
	dueDate := now.AddDate(0, 3, 0)
	submission := domain.SubmissionDetail{
		ID:         1,
		Attempt:    1,
		ActionPlan: "Ganti tabung",
		DueDate:    &dueDate,
		Status:     "submitted",
		CreatedAt:  now,
		Evidences:  []string{"/uploads/ev1.jpg"},
	}
	expected := &domain.RepairDetailResponse{
		RepairOrderID: 1,
		SarprasCode:   "APAR-HSE-001",
		SarprasName:   "APAR",
		Department:    "HSE",
		Status:        domain.RepairAssigned,
		InspectedAt:   &now, // pointer
		NOKDetails: []domain.NOKParameterDetail{
			{ParameterName: "Tekanan", Notes: "Tekanan rendah", PhotoURL: "/uploads/p1.jpg"},
		},
		Submissions: []domain.SubmissionDetail{submission},
	}

	repairRepo.On("GetDetail", ctx, uint(1)).Return(expected, nil)

	result, err := svc.GetRepairDetail(ctx, 1)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, uint(1), result.RepairOrderID)
	assert.Equal(t, "APAR-HSE-001", result.SarprasCode)
	assert.Equal(t, domain.RepairAssigned, result.Status)
	assert.Len(t, result.NOKDetails, 1)
	assert.Equal(t, "Tekanan", result.NOKDetails[0].ParameterName)
	assert.Len(t, result.Submissions, 1)
	assert.Equal(t, "Ganti tabung", result.Submissions[0].ActionPlan)

	repairRepo.AssertExpectations(t)
}

func TestGetRepairDetail_NotFound(t *testing.T) {
	svc, repairRepo, _, _ := setupService(t)
	ctx := context.Background()

	repairRepo.On("GetDetail", ctx, uint(999)).Return(nil, errors.New("record not found"))

	result, err := svc.GetRepairDetail(ctx, 999)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "record not found")

	repairRepo.AssertExpectations(t)
}

func TestGetRepairDetail_WithEvidences(t *testing.T) {
	svc, repairRepo, _, _ := setupService(t)
	ctx := context.Background()

	now := time.Now()
	submission := domain.SubmissionDetail{
		ID:         2,
		Attempt:    1,
		ActionPlan: "Perbaiki bocor",
		Status:     "submitted",
		CreatedAt:  now,
		Evidences:  []string{"/uploads/ev1.jpg", "/uploads/ev2.jpg"},
	}
	expected := &domain.RepairDetailResponse{
		RepairOrderID: 2,
		SarprasCode:   "HYD-001",
		Status:        domain.RepairSubmitted,
		InspectedAt:   &now, // pointer
		Submissions:   []domain.SubmissionDetail{submission},
	}

	repairRepo.On("GetDetail", ctx, uint(2)).Return(expected, nil)

	result, err := svc.GetRepairDetail(ctx, 2)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Len(t, result.Submissions, 1)
	assert.Len(t, result.Submissions[0].Evidences, 2)
	assert.Equal(t, domain.RepairSubmitted, result.Status)

	repairRepo.AssertExpectations(t)
}

// ─── FillActionPlan Tests ─────────────────────────────────────────────────────

func TestFillActionPlan_OrderNotFound(t *testing.T) {
	svc, repairRepo, _, _ := setupService(t)
	ctx := context.Background()

	repairRepo.On("FindByID", ctx, uint(99)).Return(nil, errors.New("record not found"))

	err := svc.FillActionPlan(ctx, 99, 5, "Ganti tabung", time.Now())

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "repair order tidak ditemukan")

	repairRepo.AssertExpectations(t)
}

func TestFillActionPlan_WrongStatus(t *testing.T) {
	svc, repairRepo, _, _ := setupService(t)
	ctx := context.Background()

	order := baseRepairOrder()
	order.Status = domain.RepairInProgress

	repairRepo.On("FindByID", ctx, uint(1)).Return(order, nil)

	err := svc.FillActionPlan(ctx, 1, 5, "Ganti tabung", time.Now())

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "action plan hanya dapat diisi saat status 'assigned'")

	repairRepo.AssertExpectations(t)
}

func TestFillActionPlan_WrongStatus_Submitted(t *testing.T) {
	svc, repairRepo, _, _ := setupService(t)
	ctx := context.Background()

	order := baseRepairOrder()
	order.Status = domain.RepairSubmitted

	repairRepo.On("FindByID", ctx, uint(1)).Return(order, nil)

	err := svc.FillActionPlan(ctx, 1, 5, "Perbaiki pompa", time.Now())

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "action plan hanya dapat diisi saat status 'assigned'")

	repairRepo.AssertExpectations(t)
}

func TestFillActionPlan_TransactionRequired(t *testing.T) {
	t.Skip("FillActionPlan uses gorm transaction (s.db.Begin); full coverage requires sqlmock")
}

// ─── SubmitEvidence Tests ─────────────────────────────────────────────────────

func TestSubmitEvidence_OrderNotFound(t *testing.T) {
	svc, repairRepo, _, _ := setupService(t)
	ctx := context.Background()

	repairRepo.On("FindByID", ctx, uint(99)).Return(nil, errors.New("record not found"))

	err := svc.SubmitEvidence(ctx, 99, 5, []string{"/uploads/ev.jpg"}, "catatan perbaikan")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "repair order tidak ditemukan")

	repairRepo.AssertExpectations(t)
}

func TestSubmitEvidence_WrongStatus(t *testing.T) {
	svc, repairRepo, _, _ := setupService(t)
	ctx := context.Background()

	order := baseRepairOrder()
	order.Status = domain.RepairAssigned

	repairRepo.On("FindByID", ctx, uint(1)).Return(order, nil)

	err := svc.SubmitEvidence(ctx, 1, 5, []string{"/uploads/ev.jpg"}, "catatan")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "bukti hanya dapat diunggah saat status 'in_progress'")

	repairRepo.AssertExpectations(t)
}

func TestSubmitEvidence_NoFiles(t *testing.T) {
	svc, repairRepo, _, _ := setupService(t)
	ctx := context.Background()

	order := baseRepairOrder()
	order.Status = domain.RepairInProgress

	repairRepo.On("FindByID", ctx, uint(1)).Return(order, nil)

	err := svc.SubmitEvidence(ctx, 1, 5, []string{}, "catatan")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "minimal satu file bukti perbaikan wajib diunggah")

	repairRepo.AssertExpectations(t)
}

func TestSubmitEvidence_TransactionRequired(t *testing.T) {
	t.Skip("SubmitEvidence uses gorm transaction (s.db.Begin); full coverage requires sqlmock")
}

// ─── Domain Constant Sanity Tests ────────────────────────────────────────────

func TestRepairStatusConstants(t *testing.T) {
	assert.Equal(t, domain.RepairStatus("assigned"), domain.RepairAssigned)
	assert.Equal(t, domain.RepairStatus("in_progress"), domain.RepairInProgress)
	assert.Equal(t, domain.RepairStatus("submitted"), domain.RepairSubmitted)
	assert.Equal(t, domain.RepairStatus("approved"), domain.RepairApproved)
	assert.Equal(t, domain.RepairStatus("rejected"), domain.RepairRejected)
}
