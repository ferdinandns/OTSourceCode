package user

import (
	"context"
	"log"
	"strings"
	"time"

	"emertrack/internal/domain"
	"emertrack/pkg/util"
	"gorm.io/gorm"
)

const user_id = "user_id = ?"
const id_ = "id = ?"

type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) domain.UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) Create(ctx context.Context, user *domain.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

func (r *userRepository) Update(ctx context.Context, user *domain.User) error {
	return r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where(id_, user.ID).
		Updates(map[string]interface{}{
			"name":                 user.Name,
			"email":                user.Email,
			"site_id":              user.SiteID,
			"department_id":        user.DepartmentID,
			"is_active":            user.IsActive,
			"is_supervisor":        user.IsSupervisor,
			"password_hash":        user.PasswordHash,
			"must_change_password": user.MustChangePassword,
			"updated_at":           time.Now(),
		}).Error
}

func (r *userRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&domain.User{}).Where(id_, id).Update("is_active", false).Error; err != nil {
			return err
		}
		if err := tx.Where(user_id, id).Delete(&domain.UserRole{}).Error; err != nil {
			return err
		}
		if err := tx.Where(user_id, id).Delete(&domain.UserSarprasType{}).Error; err != nil {
			return err
		}

		return tx.Delete(&domain.User{}, id).Error
	})
}

func (r *userRepository) AssignRole(ctx context.Context, userRole *domain.UserRole) error {
	clean := &domain.UserRole{
		UserID:    userRole.UserID,
		Role:      userRole.Role,
		CreatedBy: userRole.CreatedBy,
	}
	return r.db.WithContext(ctx).
		Where(domain.UserRole{UserID: userRole.UserID, Role: userRole.Role}).
		FirstOrCreate(clean).Error
}

func (r *userRepository) RemoveRole(ctx context.Context, userID uint, role domain.Role) error {
	return r.db.WithContext(ctx).
		Where("user_id = ? AND role = ?", userID, role).
		Delete(&domain.UserRole{}).Error
}

func (r *userRepository) AssignSarpras(ctx context.Context, us *domain.UserSarprasType) error {
	clean := &domain.UserSarprasType{
		UserID:        us.UserID,
		SarprasTypeID: us.SarprasTypeID,
		CreatedBy:     us.CreatedBy,
	}
	return r.db.WithContext(ctx).
		Where(&domain.UserSarprasType{UserID: us.UserID, SarprasTypeID: us.SarprasTypeID}).
		FirstOrCreate(clean).Error
}

func (r *userRepository) RemoveSarprasAssignment(ctx context.Context, userID uint) error {
	return r.db.WithContext(ctx).
		Where(user_id, userID).
		Delete(&domain.UserSarprasType{}).Error
}

func (r *userRepository) FindByID(ctx context.Context, id uint) (*domain.User, error) {
	var u domain.User
	err := r.db.WithContext(ctx).
		Preload("Site").
		Preload("Department").
		Preload("Roles").
		Preload("Assignments.SarprasType").
		First(&u, id).Error
	return &u, err
}

func (r *userRepository) FindByDepartmentName(ctx context.Context, deptName string) ([]domain.User, error) {
	var users []domain.User
	err := r.db.WithContext(ctx).
		Joins("JOIN departments ON departments.id = users.department_id").
		Where("departments.name = ?", deptName).
		Find(&users).Error
	return users, err
}

func (r *userRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	var u domain.User
	err := r.db.WithContext(ctx).
		Preload("Department").Preload("Roles").Where("email = ?", email).First(&u).Error
	return &u, err
}

func (r *userRepository) FindByNIK(ctx context.Context, nik string) (*domain.User, error) {
	var u domain.User
	err := r.db.WithContext(ctx).Where("nik = ?", nik).First(&u).Error
	return &u, err
}

func (r *userRepository) FindDeletedByNIK(ctx context.Context, nik string) (*domain.User, error) {
	var user domain.User
	err := r.db.WithContext(ctx).Unscoped().Where("nik = ?", nik).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) Restore(ctx context.Context, id uint, updates *domain.User) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return tx.Unscoped().Model(&domain.User{}).Where(id, id).Updates(map[string]interface{}{
			"deleted_at":    nil,
			"is_active":     true,
			"name":          updates.Name,
			"email":         updates.Email,
			"site_id":       updates.SiteID,
			"department_id": updates.DepartmentID,
		}).Error
	})
}

func (r *userRepository) ListUsers(ctx context.Context, filter domain.UserFilter) ([]domain.UserRow, int64, error) {
	var users []domain.User
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.User{}).
		Preload("Site").Preload("Department").Preload("Roles")

	if filter.DepartmentID != nil {
		query = query.Where("department_id = ?", *filter.DepartmentID)
	}

	if filter.Role != nil {
		query = query.Joins(JOIN_USER_ROLES).
			Where("user_roles.role = ?", *filter.Role)
	}

	if filter.Search != "" {
		search := "%" + filter.Search + "%"
		query = query.Where("users.name ILIKE ? OR users.email ILIKE ? OR users.nik ILIKE ?", search, search, search)
	}

	query.Count(&total)

	page, ps := filter.Page, filter.PageSize
	if page < 1 {
		page = 1
	}
	if ps < 1 {
		ps = 20
	}

	validSortColumns := map[string]string{
		"name":       "users.name",
		"status":     "users.is_active",
		"department": "departments.name",
	}

	orderClause := util.BuildOrderClause(filter.SortBy, filter.SortOrder, "users.name", "ASC", validSortColumns)
	// BuildOrderClause returns an "ORDER BY col DIR" string, but GORM's .Order() already prepends "ORDER BY".
	// Strip the prefix to avoid duplicate ORDER BY clauses.
	orderClause = strings.TrimPrefix(orderClause, "ORDER BY ")

	if filter.SortBy == "department" {
		query = query.Joins("LEFT JOIN departments ON departments.id = users.department_id")
	}

	err := query.Limit(ps).Offset((page - 1) * ps).Order(orderClause).Find(&users).Error
	if err != nil {
		return nil, 0, err
	}

	var rows []domain.UserRow
	for _, u := range users {
		var roles []domain.Role
		for _, r := range u.Roles {
			roles = append(roles, r.Role)
		}
		rows = append(rows, domain.UserRow{
			ID:             u.ID,
			NIK:            u.NIK,
			Name:           u.Name,
			Email:          u.Email,
			SiteName:       u.Site.Name,
			DepartmentName: u.Department.Name,
			Roles:          roles,
			IsActive:       u.IsActive,
			IsSupervisor:   u.IsSupervisor,
		})
	}

	return rows, total, nil
}

func (r *userRepository) FindByRole(ctx context.Context, role domain.Role) ([]domain.User, error) {
	var users []domain.User
	err := r.db.WithContext(ctx).
		Joins(JOIN_USER_ROLES).
		Where("user_roles.role = ?", role).
		Find(&users).Error
	return users, err
}

func (r *userRepository) GetUserRoles(ctx context.Context, userID uint) ([]domain.Role, error) {
	var roles []domain.UserRole
	err := r.db.WithContext(ctx).Where(user_id, userID).Find(&roles).Error
	var res []domain.Role
	for _, r := range roles {
		res = append(res, r.Role)
	}
	return res, err
}

func (r *userRepository) GetCheckerSarprasTypeList(ctx context.Context, userID uint) ([]uint, error) {
	var assignments []domain.UserSarprasType
	err := r.db.WithContext(ctx).Where(user_id, userID).Find(&assignments).Error
	var res []uint
	for _, a := range assignments {
		res = append(res, a.SarprasTypeID)
	}
	return res, err
}

func (r *userRepository) GetApprovers(ctx context.Context) ([]domain.User, error) {
	var users []domain.User

	result := r.db.WithContext(ctx).
		Distinct("users.*").
		Joins("LEFT JOIN user_roles ON user_roles.user_id = users.id").
		Where("user_roles.role = ? AND users.is_supervisor = ?", domain.RoleQS, true).
		Find(&users)

	log.Printf("GetApprovers: found %d users, error: %v", len(users), result.Error)
	for _, u := range users {
		log.Printf("  - ID:%d Name:%s IsSupervisor:%v", u.ID, u.Name, u.IsSupervisor)
	}

	return users, result.Error
}

func (r *userRepository) FindCheckersByDeptAndType(ctx context.Context, deptID, typeID uint) ([]domain.User, error) {
	var checkers []domain.User

	subQuery := r.db.
		Table("user_roles ur").
		Select("ur.user_id").
		Where("ur.role = ? AND EXISTS (SELECT 1 FROM user_sarpras_types ust WHERE ust.user_id = ur.user_id AND ust.sarpras_type_id = ?)", "checker", typeID)

	err := r.db.WithContext(ctx).
		Where("department_id = ?", deptID).
		Where("id IN (?) OR is_supervisor = ?", subQuery, true).
		Find(&checkers).Error

	return checkers, err
}

func (r *userRepository) FindApprovers(ctx context.Context) ([]domain.User, error) {
	var users []domain.User
	err := r.db.WithContext(ctx).
		Where("role = ? AND is_supervisor = ?", domain.RoleQS, true).
		Find(&users).Error
	return users, err
}

func (r *userRepository) FindDefaultPICByDepartmentID(ctx context.Context, tx *gorm.DB, departmentID uint) (*domain.User, error) {
	db := r.db
	if tx != nil {
		db = tx
	}
	var user domain.User
	err := db.WithContext(ctx).
		Joins(JOIN_USER_ROLES).
		Where("users.department_id = ? AND user_roles.role = ? AND users.is_active = ?", departmentID, domain.RolePICResponsibility, true).
		First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) UpdatePassword(ctx context.Context, userID uint, newPasswordHash string) error {
	return r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"password_hash":        newPasswordHash,
			"must_change_password": false,
		}).Error
}

// FindUsersByDepartmentAndRole returns all users in the given department that have the specified role.
func (r *userRepository) FindUsersByDepartmentAndRole(ctx context.Context, departmentID uint, role domain.Role) ([]domain.User, error) {
	var users []domain.User
	err := r.db.WithContext(ctx).
		Joins("JOIN user_roles ON user_roles.user_id = users.id").
		Where("users.department_id = ? AND user_roles.role = ?", departmentID, role).
		Find(&users).Error
	return users, err
}

// FindSupervisorsByDepartment returns all users in the given department that are supervisors.
func (r *userRepository) FindSupervisorsByDepartment(ctx context.Context, departmentID uint) ([]domain.User, error) {
	var users []domain.User
	err := r.db.WithContext(ctx).
		Where("department_id = ? AND is_supervisor = ?", departmentID, true).
		Find(&users).Error
	return users, err
}

// UpdateSupervisorStatus sets the is_supervisor flag for a user.
func (r *userRepository) UpdateSupervisorStatus(ctx context.Context, userID uint, supervisor bool) error {
	return r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("id = ?", userID).
		Update("is_supervisor", supervisor).Error
}
