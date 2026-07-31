package master_test

import (
	"context"
	"errors"
	"testing"

	"emertrack/internal/domain"
	"emertrack/internal/master"
	"emertrack/mocks"

	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
)

func setupMasterService(t *testing.T) (domain.MasterService, *mocks.MasterRepository, *mocks.NotificationService) {
	repo := new(mocks.MasterRepository)
	notifSvc := new(mocks.NotificationService)
	svc := master.NewMasterService(repo, notifSvc, &gorm.DB{})
	return svc, repo, notifSvc
}

func TestListSites_Success(t *testing.T) {
	svc, repo, _ := setupMasterService(t)
	ctx := context.Background()
	filter := map[string]interface{}{"active": true}
	expected := []domain.Site{{ID: 1, Code: "CKR", Name: "Cikarang"}}

	repo.On("ListSite", ctx, filter).Return(expected, nil)

	res, err := svc.ListSites(ctx, filter)
	assert.NoError(t, err)
	assert.Len(t, res, 1)
	assert.Equal(t, "CKR", res[0].Code)
	repo.AssertExpectations(t)
}

func TestListSites_Error(t *testing.T) {
	svc, repo, _ := setupMasterService(t)
	ctx := context.Background()

	repo.On("ListSite", ctx, map[string]interface{}(nil)).Return(nil, errors.New("db error"))

	res, err := svc.ListSites(ctx, nil)
	assert.Error(t, err)
	assert.Nil(t, res)
	repo.AssertExpectations(t)
}

func TestListDepartments_Success(t *testing.T) {
	svc, repo, _ := setupMasterService(t)
	ctx := context.Background()
	expected := []domain.DepartmentRow{{ID: 1, Code: "ENG", Name: "Engineering"}}

	repo.On("ListDepartment", ctx, map[string]interface{}(nil)).Return(expected, nil)

	res, err := svc.ListDepartments(ctx, nil)
	assert.NoError(t, err)
	assert.Len(t, res, 1)
	assert.Equal(t, "ENG", res[0].Code)
	repo.AssertExpectations(t)
}
