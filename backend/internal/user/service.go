package user

import (
	"context"
	"fmt"
	"log"
	"slices"
	"strings"
	"time"

	"emertrack/internal/domain"
	"emertrack/pkg/ws"

	"golang.org/x/crypto/bcrypt"
)

type userService struct {
	userRepo        domain.UserRepository
	sarprasTypeRepo domain.SarprasTypeRepository
	auditSvc        domain.AuditService
}

func NewUserService(ur domain.UserRepository, str domain.SarprasTypeRepository, as domain.AuditService) domain.UserService {
	return &userService{
		userRepo:        ur,
		sarprasTypeRepo: str,
		auditSvc:        as,
	}
}

func (s *userService) ValidateLogin(ctx context.Context, email, password string) (*domain.User, error) {
	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("Email atau password salah")
	}

	if !user.IsActive {
		return nil, fmt.Errorf("akun tidak aktif")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("Email atau password salah")
	}

	return user, nil
}

func (s *userService) CreateUser(ctx context.Context, actorID uint, user *domain.User, roles []domain.Role, sarprasTypeIDs []uint) (*domain.User, error) {
	var fieldErrs domain.FieldErrors

	// Check if NIK already exists (active, non-deleted user)
	existingByNIK, err := s.userRepo.FindByNIK(ctx, user.NIK)
	if err == nil && existingByNIK != nil {
		fieldErrs = append(fieldErrs, domain.NewFieldError("nik", fmt.Sprintf("NIK %s sudah terdaftar", user.NIK)))
	}

	// Check if EMAIL already exists (active, non-deleted user)
	existingByEmail, err := s.userRepo.FindByEmail(ctx, user.Email)
	if err == nil && existingByEmail != nil {
		fieldErrs = append(fieldErrs, domain.NewFieldError("email", fmt.Sprintf("Email %s sudah digunakan", user.Email)))
	}

	if len(fieldErrs) > 0 {
		return nil, fieldErrs
	}

	// Check if NIK belongs to a soft-deleted user (restore flow)
	existingUser, err := s.userRepo.FindDeletedByNIK(ctx, user.NIK)
	if err == nil && existingUser != nil {
		return s.RestoreUser(ctx, actorID, existingUser.ID, user, roles, sarprasTypeIDs)
	}

	if err := s.validateCheckerSarprasRequirement(roles, user, sarprasTypeIDs); err != nil {
		return nil, err
	}

	year := time.Now().Year()
	defaultPassword := fmt.Sprintf("EMERTRACK@%d", year)
	newHash, err := bcryptHash(defaultPassword)
	if err != nil {
		return nil, fmt.Errorf("hash password error: %w", err)
	}

	user.PasswordHash = newHash
	user.MustChangePassword = true

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}

	s.syncUserRoles(ctx, actorID, user.ID, nil, roles)
	s.syncUserSarpras(ctx, actorID, user, roles, sarprasTypeIDs)

	// Enforce department‑level uniqueness for PIC Responsibility and Supervisor
	s.enforceDepartmentUniqueness(ctx, user.ID, user.DepartmentID, roles, user.IsSupervisor)

	_ = s.auditSvc.Log(ctx, actorID, "create", "user", fmt.Sprintf("User dibuat: %s (%s)", user.Name, user.Email), &user.ID)

	go ws.BroadcastUserUpdated()

	return s.GetUser(ctx, user.ID)
}

func (s *userService) UpdateUser(ctx context.Context, actorID, userID uint, updates *domain.User, newRoles []domain.Role, newSarprasIDs []uint) (*domain.User, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Check if new EMAIL is already used by another user
	if updates.Email != "" && updates.Email != user.Email {
		existingByEmail, err := s.userRepo.FindByEmail(ctx, updates.Email)
		if err == nil && existingByEmail != nil && existingByEmail.ID != userID {
			return nil, domain.NewFieldError("email", fmt.Sprintf("Email %s sudah digunakan oleh pengguna lain", updates.Email))
		}
	}

	effectiveRoles := s.resolveEffectiveRoles(user, newRoles)

	if err := s.validateSarprasIDs(ctx, newSarprasIDs); err != nil {
		return nil, err
	}

	if err := s.validateCheckerSarprasRequirement(effectiveRoles, updates, newSarprasIDs); err != nil {
		return nil, err
	}

	s.applyUserFieldUpdates(user, updates)

	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, err
	}

	s.syncUserRoles(ctx, actorID, userID, user.Roles, newRoles)
	s.syncUserSarpras(ctx, actorID, user, newRoles, newSarprasIDs)

	// Enforce department‑level uniqueness for PIC Responsibility and Supervisor
	s.enforceDepartmentUniqueness(ctx, user.ID, user.DepartmentID, effectiveRoles, user.IsSupervisor)

	_ = s.auditSvc.Log(ctx, actorID, "update", "user", fmt.Sprintf("User diperbarui: %s (%s)", user.Name, user.Email), &userID)
	go ws.BroadcastUserUpdated()
	// Force logout the updated user so client reloads session and data
	go ws.GlobalHub.SendToUser(user.ID, "FORCE_LOGOUT", map[string]string{
		"reason":  "profile_changed",
		"message": "Akun Anda telah diubah oleh admin. Silakan login kembali.",
	})

	return s.GetUser(ctx, user.ID)
}

func (s *userService) DeleteUser(ctx context.Context, actorID, userID uint) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if err := s.userRepo.Delete(ctx, userID); err != nil {
		return err
	}
	_ = s.auditSvc.Log(ctx, actorID, "delete", "user", fmt.Sprintf("User dihapus: %s (%s)", user.Name, user.Email), &userID)

	go ws.BroadcastUserUpdated()

	return nil
}

func (s *userService) GetUser(ctx context.Context, id uint) (*domain.User, error) {
	return s.userRepo.FindByID(ctx, id)
}

func (s *userService) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	return s.userRepo.FindByEmail(ctx, email)
}

func (s *userService) ListUsers(ctx context.Context, filter domain.UserFilter) ([]domain.UserRow, int64, error) {
	return s.userRepo.ListUsers(ctx, filter)
}

func (s *userService) GetApproversEmail(ctx context.Context) ([]string, error) {
	approvers, err := s.userRepo.GetApprovers(ctx)
	if err != nil {
		return nil, err
	}

	emails := make([]string, 0, len(approvers))
	for _, u := range approvers {
		if u.Email != "" {
			emails = append(emails, u.Email)
		}
	}
	return emails, nil
}


func (s *userService) ChangePassword(ctx context.Context, userID uint, oldPassword, newPassword string) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	if !user.MustChangePassword {
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(oldPassword)); err != nil {
			log.Printf("[DEBUG service.ChangePassword] old password mismatch: %v", err)
			return fmt.Errorf("Password lama salah")
		}
	} else {
		log.Printf("[DEBUG service.ChangePassword] MustChangePassword is true, skipping old password check")
	}

	newHash, err := bcryptHash(newPassword)
	if err != nil {
		return err
	}

	user.PasswordHash = newHash
	user.MustChangePassword = false 
	return s.userRepo.Update(ctx, user)
}

func (s *userService) ForceResetPassword(ctx context.Context, userID uint, newPassword string) error {
	hashedPassword, err := bcryptHash(newPassword)
	if err != nil {
		return fmt.Errorf("gagal mengenkripsi password: %w", err)
	}

	return s.userRepo.UpdatePassword(ctx, userID, hashedPassword)
}

// --- HELPER FUNCTIONS ---

func (s *userService) applyUserFieldUpdates(user, updates *domain.User) {
	if updates.Name != "" {
		user.Name = updates.Name
	}
	if updates.Email != "" {
		user.Email = updates.Email
	}
	if updates.SiteID != 0 {
		user.SiteID = updates.SiteID
	}
	if updates.DepartmentID != 0 {
		user.DepartmentID = updates.DepartmentID
	}
	user.IsActive = updates.IsActive
	user.IsSupervisor = updates.IsSupervisor
}

func (s *userService) resolveEffectiveRoles(user *domain.User, newRoles []domain.Role) []domain.Role {
	if len(newRoles) > 0 {
		return newRoles
	}
	effectiveRoles := make([]domain.Role, 0, len(user.Roles))
	for _, r := range user.Roles {
		effectiveRoles = append(effectiveRoles, r.Role)
	}
	return effectiveRoles
}

func (s *userService) validateSarprasIDs(ctx context.Context, sarprasIDs []uint) error {
	if len(sarprasIDs) == 0 {
		return nil
	}

	foundIDs, err := s.sarprasTypeRepo.FindExistingIDs(ctx, sarprasIDs)
	if err != nil {
		return fmt.Errorf("gagal validasi sarpras: %w", err)
	}

	foundMap := make(map[uint]bool)
	for _, id := range foundIDs {
		foundMap[id] = true
	}

	var missingIDs []string
	for _, requestedID := range sarprasIDs {
		if !foundMap[requestedID] {
			missingIDs = append(missingIDs, fmt.Sprintf("'%d'", requestedID))
		}
	}

	if len(missingIDs) > 0 {
		return fmt.Errorf("ID %s jenis sarpras tidak ditemukan di sistem", strings.Join(missingIDs, ", "))
	}
	return nil
}

func (s *userService) validateCheckerSarprasRequirement(roles []domain.Role, updates *domain.User, sarprasIDs []uint) error {
	if slices.Contains(roles, domain.RoleChecker) && !updates.IsSupervisor && len(sarprasIDs) == 0 {
		return fmt.Errorf("checker yang bukan supervisor wajib memilih minimal 1 sarpras")
	}
	return nil
}

func (s *userService) syncUserRoles(ctx context.Context, actorID, userID uint, currentRoles []domain.UserRole, newRoles []domain.Role) {
	if len(newRoles) == 0 {
		return
	}
	for _, old := range currentRoles {
		_ = s.userRepo.RemoveRole(ctx, userID, old.Role)
	}
	for _, role := range newRoles {
		_ = s.userRepo.AssignRole(ctx, &domain.UserRole{UserID: userID, Role: role, CreatedBy: actorID})
	}
}

func (s *userService) RestoreUser(ctx context.Context, actorID, existingID uint, user *domain.User, roles []domain.Role, sarprasTypeIDs []uint) (*domain.User, error) {
	isChecker := slices.Contains(roles, domain.RoleChecker)
	if isChecker && !user.IsSupervisor && len(sarprasTypeIDs) == 0 {
		return nil, fmt.Errorf("checker yang bukan supervisor wajib memilih minimal 1 sarpras")
	}

	if err := s.userRepo.Restore(ctx, existingID, user); err != nil {
		return nil, err
	}

	s.syncUserRoles(ctx, actorID, existingID, nil, roles)

	restoredUser, _ := s.userRepo.FindByID(ctx, existingID)
	s.syncUserSarpras(ctx, actorID, restoredUser, roles, sarprasTypeIDs)

	// 4. Log Audit
	_ = s.auditSvc.Log(ctx, actorID, "restore", "user", fmt.Sprintf("User dipulihkan: %s (%s)", restoredUser.Name, restoredUser.Email), &existingID)

	go ws.BroadcastUserUpdated()

	return s.GetUser(ctx, existingID)
}

func (s *userService) syncUserSarpras(ctx context.Context, actorID uint, user *domain.User, reqRoles []domain.Role, reqSarprasIDs []uint) {
	if user.IsSupervisor {
		_ = s.userRepo.RemoveSarprasAssignment(ctx, user.ID)
		return
	}
	isChecker := slices.Contains(reqRoles, domain.RoleChecker)
	if len(reqRoles) == 0 {
		for _, r := range user.Roles {
			if r.Role == domain.RoleChecker {
				isChecker = true
				break
			}
		}
	}

	if isChecker && !user.IsSupervisor {
		_ = s.userRepo.RemoveSarprasAssignment(ctx, user.ID)
		for _, sid := range reqSarprasIDs {
			_ = s.userRepo.AssignSarpras(ctx, &domain.UserSarprasType{UserID: user.ID, SarprasTypeID: sid, CreatedBy: actorID})
		}
	}
}

// enforceDepartmentUniqueness ensures that only one user per department holds the PIC Responsibility role
// and only one user per department is a supervisor.
func (s *userService) enforceDepartmentUniqueness(ctx context.Context, userID, departmentID uint, roles []domain.Role, isSupervisor bool) {
	if slices.Contains(roles, domain.RolePICResponsibility) {
		users, err := s.userRepo.FindUsersByDepartmentAndRole(ctx, departmentID, domain.RolePICResponsibility)
		if err == nil {
			for _, u := range users {
				if u.ID != userID {
					_ = s.userRepo.RemoveRole(ctx, u.ID, domain.RolePICResponsibility)
				}
			}
		}
	}

	if isSupervisor {
		supervisors, err := s.userRepo.FindSupervisorsByDepartment(ctx, departmentID)
		if err == nil {
			for _, sup := range supervisors {
				if sup.ID != userID {
					_ = s.userRepo.UpdateSupervisorStatus(ctx, sup.ID, false)
				}
			}
		}
	}
}

func bcryptHash(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}
