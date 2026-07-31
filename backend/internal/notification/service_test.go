package notification_test

import (
	"context"
	"errors"
	"testing"

	"emertrack/internal/domain"
	"emertrack/internal/notification"
	"emertrack/mocks"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockNotificationRepo struct{ mock.Mock }

func (m *mockNotificationRepo) Create(ctx context.Context, notif *domain.Notification) error {
	return m.Called(ctx, notif).Error(0)
}

func (m *mockNotificationRepo) FindUserNotifications(ctx context.Context, userID uint) ([]domain.Notification, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.Notification), args.Error(1)
}

func (m *mockNotificationRepo) MarkAsRead(ctx context.Context, id uint, userID uint) error {
	return m.Called(ctx, id, userID).Error(0)
}

func (m *mockNotificationRepo) MarkAllAsRead(ctx context.Context, userID uint) error {
	return m.Called(ctx, userID).Error(0)
}

func (m *mockNotificationRepo) Delete(ctx context.Context, id uint, userID uint) error {
	return m.Called(ctx, id, userID).Error(0)
}

func (m *mockNotificationRepo) DeleteAll(ctx context.Context, userID uint) error {
	return m.Called(ctx, userID).Error(0)
}

func setupNotificationService(t *testing.T) (domain.NotificationService, *mockNotificationRepo, *mocks.UserRepository) {
	notifRepo := new(mockNotificationRepo)
	userRepo := new(mocks.UserRepository)
	svc := notification.NewService(notifRepo, userRepo, nil)
	return svc, notifRepo, userRepo
}

func TestGetUserNotifications_Success(t *testing.T) {
	svc, notifRepo, _ := setupNotificationService(t)
	ctx := context.Background()
	expected := []domain.Notification{{ID: 1, Message: "New approval"}}

	notifRepo.On("FindUserNotifications", ctx, uint(10)).Return(expected, nil)

	res, err := svc.GetUserNotifications(ctx, 10)
	assert.NoError(t, err)
	assert.Len(t, res, 1)
	notifRepo.AssertExpectations(t)
}

func TestMarkAsRead_Success(t *testing.T) {
	svc, notifRepo, _ := setupNotificationService(t)
	ctx := context.Background()

	notifRepo.On("MarkAsRead", ctx, uint(1), uint(10)).Return(nil)

	err := svc.MarkAsRead(ctx, 1, 10)
	assert.NoError(t, err)
	notifRepo.AssertExpectations(t)
}

func TestMarkAllAsRead_Success(t *testing.T) {
	svc, notifRepo, _ := setupNotificationService(t)
	ctx := context.Background()

	notifRepo.On("MarkAllAsRead", ctx, uint(10)).Return(nil)

	err := svc.MarkAllAsRead(ctx, 10)
	assert.NoError(t, err)
	notifRepo.AssertExpectations(t)
}

func TestDeleteNotification_Success(t *testing.T) {
	svc, notifRepo, _ := setupNotificationService(t)
	ctx := context.Background()

	notifRepo.On("Delete", ctx, uint(1), uint(10)).Return(nil)

	err := svc.DeleteNotification(ctx, 1, 10)
	assert.NoError(t, err)
	notifRepo.AssertExpectations(t)
}

func TestDeleteAllNotifications_Success(t *testing.T) {
	svc, notifRepo, _ := setupNotificationService(t)
	ctx := context.Background()

	notifRepo.On("DeleteAll", ctx, uint(10)).Return(nil)

	err := svc.DeleteAllNotifications(ctx, 10)
	assert.NoError(t, err)
	notifRepo.AssertExpectations(t)
}

func TestNotifyApprovers_NoApprovers(t *testing.T) {
	svc, _, userRepo := setupNotificationService(t)
	ctx := context.Background()

	userRepo.On("FindByID", ctx, uint(1)).Return(&domain.User{ID: 1, Name: "Alice"}, nil)
	userRepo.On("GetApprovers", ctx).Return([]domain.User{}, nil)

	err := svc.NotifyApprovers(ctx, 1, "Sarpras", "create", "APAR-001", "notes", 5)
	assert.NoError(t, err)
	userRepo.AssertExpectations(t)
}

func TestNotifyApprovers_CreatesNotifications(t *testing.T) {
	svc, notifRepo, userRepo := setupNotificationService(t)
	ctx := context.Background()

	userRepo.On("FindByID", ctx, uint(1)).Return(&domain.User{ID: 1, Name: "Alice"}, nil)
	userRepo.On("GetApprovers", ctx).Return([]domain.User{{ID: 2, Email: "qs@test.com"}}, nil)
	notifRepo.On("Create", ctx, mock.AnythingOfType("*domain.Notification")).Return(nil)

	err := svc.NotifyApprovers(ctx, 1, "Sarpras", "create", "APAR-001", "", 5)
	assert.NoError(t, err)
	notifRepo.AssertExpectations(t)
	userRepo.AssertExpectations(t)
}

func TestNotifyRequesterApprovalResult_Success(t *testing.T) {
	svc, notifRepo, userRepo := setupNotificationService(t)
	ctx := context.Background()

	// Mock userRepo.FindByID
	userRepo.On("FindByID", ctx, uint(5)).Return(&domain.User{ID: 5, Email: "test@example.com", Name: "Test"}, nil)

	// Mock notifRepo.Create
	notifRepo.On("Create", ctx, mock.AnythingOfType("*domain.Notification")).Return(nil)

	err := svc.NotifyRequesterApprovalResult(ctx, domain.ApprovalResultNotif{
		RequesterID: 5, ApprovalID: 10, Status: "approved",
		Action: "Create", EntityType: "Sarpras", Identifier: "APAR-001",
	})
	assert.NoError(t, err)
	notifRepo.AssertExpectations(t)
	userRepo.AssertExpectations(t)
}

func TestGetUserNotifications_Error(t *testing.T) {
	svc, notifRepo, _ := setupNotificationService(t)
	ctx := context.Background()

	notifRepo.On("FindUserNotifications", ctx, uint(99)).Return(nil, errors.New("db error"))

	res, err := svc.GetUserNotifications(ctx, 99)
	assert.Error(t, err)
	assert.Nil(t, res)
	notifRepo.AssertExpectations(t)
}
