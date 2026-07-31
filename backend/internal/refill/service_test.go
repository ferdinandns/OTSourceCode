package refill_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"emertrack/internal/audit"
	"emertrack/internal/domain"
	"emertrack/internal/refill"
	"emertrack/mocks"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/gorm"
)

type mockRefillRepo struct{ mock.Mock }

func (m *mockRefillRepo) GetAparList(params domain.GetAparListParams) ([]domain.AparListRow, int, int, int, error) {
	args := m.Called(params)
	var rows []domain.AparListRow
	if v := args.Get(0); v != nil {
		rows = v.([]domain.AparListRow)
	}
	return rows, args.Int(1), args.Int(2), args.Int(3), args.Error(4)
}

func (m *mockRefillRepo) GetAparDetail(sarprasID uint) (*domain.AparListRow, error) {
	args := m.Called(sarprasID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.AparListRow), args.Error(1)
}

func (m *mockRefillRepo) GetAparsNearExpiry(daysAhead int) ([]domain.AparNearExpiry, error) {
	args := m.Called(daysAhead)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.AparNearExpiry), args.Error(1)
}

func (m *mockRefillRepo) CreateOrder(order *domain.RefillOrder, items []domain.RefillOrderItem) error {
	return m.Called(order, items).Error(0)
}

func (m *mockRefillRepo) ValidateSarprasForRefill(sarprasIDs []uint) ([]uint, error) {
	args := m.Called(sarprasIDs)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]uint), args.Error(1)
}

func (m *mockRefillRepo) ValidateSarprasForMarkUsed(sarprasIDs []uint) ([]uint, error) {
	args := m.Called(sarprasIDs)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]uint), args.Error(1)
}

func (m *mockRefillRepo) UpdateItemEvidence(itemID uint, userID uint, newDate time.Time, path string, reason string) error {
	return m.Called(itemID, userID, newDate, path, reason).Error(0)
}

func (m *mockRefillRepo) GetEmailsByDepartment(deptName string) ([]string, error) {
	args := m.Called(deptName)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]string), args.Error(1)
}

func (m *mockRefillRepo) GetEmailsByRole(role string) ([]string, error) {
	args := m.Called(role)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]string), args.Error(1)
}

func (m *mockRefillRepo) GetVerifyDetail(sarprasID uint) (*domain.VerifyDetailResponse, error) {
	args := m.Called(sarprasID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.VerifyDetailResponse), args.Error(1)
}

func (m *mockRefillRepo) GetActiveRefillBySarprasID(ctx context.Context, sarprasID uint) (*domain.RefillStatus, error) {
	args := m.Called(ctx, sarprasID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.RefillStatus), args.Error(1)
}

func setupRefillService(t *testing.T) (domain.RefillService, *mockRefillRepo) {
	repo := new(mockRefillRepo)
	auditRepo := new(mocks.AuditRepository)
	auditSvc := audit.NewAuditService(auditRepo)
	notifSvc := new(mocks.NotificationService)
	svc := refill.NewRefillService(repo, &gorm.DB{}, auditSvc, nil, notifSvc)
	return svc, repo
}

func TestGetAparDetail_NotFound(t *testing.T) {
	svc, repo := setupRefillService(t)

	repo.On("GetAparDetail", uint(99)).Return(nil, nil)

	res, err := svc.GetAparDetail(99)
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "sarpras tidak ditemukan")
	repo.AssertExpectations(t)
}

func TestGetAparDetail_Success(t *testing.T) {
	svc, repo := setupRefillService(t)
	expected := &domain.AparListRow{SarprasID: 1, SarprasNo: "APAR-001"}

	repo.On("GetAparDetail", uint(1)).Return(expected, nil)

	res, err := svc.GetAparDetail(1)
	assert.NoError(t, err)
	assert.Equal(t, "APAR-001", res.SarprasNo)
	repo.AssertExpectations(t)
}

func TestSubmitPO_EmptyPONumber(t *testing.T) {
	svc, _ := setupRefillService(t)
	err := svc.SubmitPO(domain.SubmitPORequest{PONumber: "  ", SarprasIDs: []uint{1}}, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "po_number wajib diisi")
}

func TestSubmitPO_NoSarprasSelected(t *testing.T) {
	svc, _ := setupRefillService(t)
	err := svc.SubmitPO(domain.SubmitPORequest{PONumber: "PO-001"}, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "minimal 1 sarpras")
}

func TestSubmitPO_PastDueDate(t *testing.T) {
	svc, repo := setupRefillService(t)
	yesterday := time.Now().AddDate(0, 0, -2)

	repo.On("ValidateSarprasForRefill", []uint{1}).Return([]uint{1}, nil)

	err := svc.SubmitPO(domain.SubmitPORequest{
		PONumber: "PO-001", SarprasIDs: []uint{1}, DueDate: yesterday,
	}, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Due Date tidak boleh kurang")
	repo.AssertExpectations(t)
}

func TestSubmitEvidence_NoFiles(t *testing.T) {
	svc, _ := setupRefillService(t)
	err := svc.SubmitEvidence(domain.SubmitEvidenceRequest{ItemID: 1, EvidencePath: []string{}}, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "minimal satu file bukti")
}

func TestMarkAsUsed_EmptyReason(t *testing.T) {
	svc, _ := setupRefillService(t)
	err := svc.MarkAsUsed(domain.MarkAsUsedRequest{Reason: " ", SarprasIDs: []uint{1}}, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "reason")
}

func TestMarkAsUsed_NoSarpras(t *testing.T) {
	svc, _ := setupRefillService(t)
	err := svc.MarkAsUsed(domain.MarkAsUsedRequest{Reason: "Training", SarprasIDs: nil}, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "minimal 1 sarpras")
}

func TestVerifyItem_RejectWithoutReason(t *testing.T) {
	svc, _ := setupRefillService(t)
	err := svc.VerifyItem(domain.VerifyRefillRequest{ItemID: 1, SarprasID: 1, Status: "rejected"}, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "alasan reject wajib diisi")
}

func TestValidateApar_DelegatesToRepo(t *testing.T) {
	svc, repo := setupRefillService(t)
	repo.On("ValidateSarprasForRefill", []uint{1, 2}).Return([]uint{1, 2}, nil)

	ids, err := svc.ValidateApar([]uint{1, 2})
	assert.NoError(t, err)
	assert.Equal(t, []uint{1, 2}, ids)
	repo.AssertExpectations(t)
}

func TestListApar_DelegatesToRepo(t *testing.T) {
	svc, repo := setupRefillService(t)
	params := domain.GetAparListParams{
		Limit:  10,
		Offset: 0,
	}
	rows := []domain.AparListRow{{SarprasNo: "APAR-001"}}

	repo.On("GetAparList", params).Return(rows, 1, 0, 0, nil)

	res, total, _, _, err := svc.ListApar(params)
	assert.NoError(t, err)
	assert.Equal(t, 1, total)
	assert.Len(t, res, 1)
	repo.AssertExpectations(t)
}

func TestGetVerifyDetail_Error(t *testing.T) {
	svc, repo := setupRefillService(t)
	repo.On("GetVerifyDetail", uint(5)).Return(nil, errors.New("not found"))

	res, err := svc.GetVerifyDetail(5)
	assert.Error(t, err)
	assert.Nil(t, res)
	repo.AssertExpectations(t)
}
