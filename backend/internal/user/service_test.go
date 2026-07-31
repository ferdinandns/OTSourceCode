package user_test

import (
	"context"
	"errors"
	"testing"

	"emertrack/internal/domain"
	"emertrack/internal/user"
	"emertrack/mocks" // Points to your root mocks folder

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// setupService initializes the service with your generated mocks[cite: 1, 2]
func setupService(t *testing.T) (
	domain.UserService,
	*mocks.UserRepository,
	*mocks.SarprasTypeRepository,
	*mocks.AuditService,
) {
	userRepo := new(mocks.UserRepository)
	sarprasTypeRepo := new(mocks.SarprasTypeRepository)
	auditSvc := new(mocks.AuditService)

	// Passing mocks as dependencies to the real service implementation
	svc := user.NewUserService(userRepo, sarprasTypeRepo, auditSvc)

	return svc, userRepo, sarprasTypeRepo, auditSvc
}

func baseUser() *domain.User {
	return &domain.User{
		ID:       10,
		NIK:      "123456789",
		Name:     "Bintang Toedjoe User",
		Email:    "user@b7.com",
		IsActive: true,
	}
}

// ─── Create User Tests ────────────────────────────────────────────────────────

func TestCreateUser_Success(t *testing.T) {
	svc, userRepo, _, auditSvc := setupService(t)
	ctx := context.Background()
	newUser := baseUser()

	// Mock Expectations for a brand-new user[cite: 1]
	userRepo.On("FindDeletedByNIK", ctx, newUser.NIK).Return(nil, errors.New("not found"))
	userRepo.On("Create", ctx, mock.AnythingOfType("*domain.User")).Return(nil)
	userRepo.On("AssignRole", ctx, mock.AnythingOfType("*domain.UserRole")).Return(nil)
	userRepo.On("FindByID", ctx, mock.Anything).Return(newUser, nil)
	auditSvc.On("Log", ctx, uint(1), "create", "user", mock.Anything, mock.Anything).Return(nil)

	// Execute
	result, err := svc.CreateUser(ctx, 1, newUser, []domain.Role{domain.RoleQS}, nil)

	// Assertions
	assert.NoError(t, err)
	assert.NotNil(t, result)
	userRepo.AssertExpectations(t)
}

func TestCreateUser_AlreadyExists_Active(t *testing.T) {
	svc, userRepo, _, auditSvc := setupService(t)
	ctx := context.Background()
	existing := baseUser()
	existing.ID = 10

	// Your service logic flows into RestoreUser because a record was found[cite: 1]
	userRepo.On("FindDeletedByNIK", ctx, existing.NIK).Return(existing, nil)

	// We must mock these because the service calls them regardless of active status[cite: 1]
	userRepo.On("Restore", ctx, uint(10), mock.AnythingOfType("*domain.User")).Return(nil)
	userRepo.On("AssignRole", ctx, mock.Anything).Return(nil)
	userRepo.On("FindByID", ctx, uint(10)).Return(existing, nil)
	auditSvc.On("Log", ctx, uint(1), "restore", "user", mock.Anything, mock.Anything).Return(nil)

	result, err := svc.CreateUser(ctx, 1, existing, []domain.Role{domain.RoleQS}, nil)

	// Assertions
	assert.NoError(t, err)
	assert.NotNil(t, result)
	userRepo.AssertExpectations(t)
}

func TestCreateUser_RestoreDeleted(t *testing.T) {
	svc, userRepo, _, auditSvc := setupService(t)
	ctx := context.Background()
	deletedUser := baseUser()
	deletedUser.ID = 10

	// A. Find the deleted user[cite: 1]
	userRepo.On("FindDeletedByNIK", ctx, deletedUser.NIK).Return(deletedUser, nil)

	// B. Mock the restore sequence[cite: 1]
	userRepo.On("Restore", ctx, uint(10), mock.AnythingOfType("*domain.User")).Return(nil)
	userRepo.On("AssignRole", ctx, mock.Anything).Return(nil)
	userRepo.On("FindByID", ctx, uint(10)).Return(deletedUser, nil)
	auditSvc.On("Log", ctx, uint(1), "restore", "user", mock.Anything, mock.Anything).Return(nil)

	result, err := svc.CreateUser(ctx, 1, deletedUser, []domain.Role{domain.RoleQS}, nil)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	userRepo.AssertExpectations(t)
}

// ─── Get User Tests ──────────────────────────────────────────────────────────

func TestGetUser_Success(t *testing.T) {
	svc, userRepo, _, _ := setupService(t)
	ctx := context.Background()
	existingUser := baseUser()

	userRepo.On("FindByID", ctx, uint(10)).Return(existingUser, nil)

	result, err := svc.GetUser(ctx, 10)

	assert.NoError(t, err)
	assert.Equal(t, "Bintang Toedjoe User", result.Name)
	userRepo.AssertExpectations(t)
}

func TestGetUser_NotFound(t *testing.T) {
	svc, userRepo, _, _ := setupService(t)
	ctx := context.Background()

	userRepo.On("FindByID", ctx, uint(99)).Return(nil, errors.New("user not found"))

	_, err := svc.GetUser(ctx, 99)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "user not found")
}

// ─── Delete User Tests ───────────────────────────────────────────────────────

func TestDeleteUser_Success(t *testing.T) {
	svc, userRepo, _, auditSvc := setupService(t)
	ctx := context.Background()

	userRepo.On("Delete", ctx, uint(10)).Return(nil)
	auditSvc.On("Log", ctx, uint(1), "delete", "user", mock.Anything, mock.Anything).Return(nil)

	err := svc.DeleteUser(ctx, 1, 10)

	assert.NoError(t, err)
	userRepo.AssertExpectations(t)
}
