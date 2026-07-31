package audit_test

import (
	"context"
	"errors"
	"testing"

	"emertrack/internal/audit"
	"emertrack/internal/domain"
	"emertrack/internal/dto"
	"emertrack/mocks"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func setupAuditService(t *testing.T) (audit.AuditService, *mocks.AuditRepository) {
	repo := new(mocks.AuditRepository)
	svc := audit.NewAuditService(repo)
	return svc, repo
}

func TestLog_Success(t *testing.T) {
	svc, repo := setupAuditService(t)
	ctx := context.Background()
	entityID := uint(5)

	repo.On("Log", ctx, mock.MatchedBy(func(log *domain.AuditLog) bool {
		return log.UserID == 1 && log.Action == "create" && log.Menu == "user" && *log.EntityID == 5
	})).Return(nil)

	err := svc.Log(ctx, 1, "create", "user", "created user", &entityID)
	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

// ─── Perbaikan: gunakan limit=20 sesuai dengan ekspektasi mock ──────────────
func TestList_Success(t *testing.T) {
	svc, repo := setupAuditService(t)
	ctx := context.Background()

	expected := []dto.AuditResponse{{ID: 1, Action: "create", Menu: "user"}}
	repo.On("List", ctx, "user", (*uint)(nil), 1, 20).Return(expected, int64(25), nil)

	res, err := svc.List(ctx, "user", nil, 1, 20) // ← ubah 0 → 20
	assert.NoError(t, err)
	assert.Equal(t, int64(25), res.Total)
	assert.Equal(t, 20, res.PageSize)
	assert.Equal(t, 2, res.TotalPages)
	assert.Len(t, res.Data, 1)
	repo.AssertExpectations(t)
}

func TestList_RepositoryError(t *testing.T) {
	svc, repo := setupAuditService(t)
	ctx := context.Background()

	repo.On("List", ctx, "", (*uint)(nil), 1, 10).Return(nil, int64(0), errors.New("db error"))

	res, err := svc.List(ctx, "", nil, 1, 10)
	assert.Error(t, err)
	assert.Nil(t, res)
	repo.AssertExpectations(t)
}
