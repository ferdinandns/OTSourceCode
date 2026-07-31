package domain

import (
	"context"
	"gorm.io/gorm"
	"time"
)

type Role string

const (
	RoleAdmin             Role = "admin"
	RoleChecker           Role = "checker"
	RolePICResponsibility Role = "pic_responsibility"
	RoleQS                Role = "qs"
)

// RolesFromStrings converts a slice of role names to domain.Role values.
func RolesFromStrings(ss []string) []Role {
	rs := make([]Role, 0, len(ss))
	for _, s := range ss {
		rs = append(rs, Role(s))
	}
	return rs
}

// RolesToStrings converts domain.Role values to their string representations.
func RolesToStrings(rs []Role) []string {
	ss := make([]string, 0, len(rs))
	for _, r := range rs {
		ss = append(ss, string(r))
	}
	return ss
}

type User struct {
	ID                 uint   `gorm:"primaryKey"`
	NIK                string `gorm:"uniqueIndex;not null;size:20"`
	Name               string `gorm:"not null;size:100"`
	Email              string `gorm:"uniqueIndex;not null;size:100"`
	PasswordHash       string `gorm:"not null"`
	MustChangePassword bool   `gorm:"default:true"`
	SiteID             uint   `gorm:"not null;index"`
	DepartmentID       uint   `gorm:"not null;index"`
	IsActive           bool   `gorm:"default:true"`
	IsSupervisor       bool   `gorm:"default:false"`
	CreatedAt          time.Time
	UpdatedAt          time.Time
	DeletedAt          gorm.DeletedAt `gorm:"index"`
	CreatedBy          *uint          `json:"created_by" gorm:"column:created_by"`
	UpdatedBy          *uint          `json:"updated_by" gorm:"column:updated_by"`

	Site        Site              `gorm:"foreignKey:SiteID;constraint:OnDelete:RESTRICT"`
	Department  Department        `gorm:"foreignKey:DepartmentID;constraint:OnDelete:RESTRICT"`
	Roles       []UserRole        `gorm:"foreignKey:UserID"`
	Assignments []UserSarprasType `gorm:"foreignKey:UserID"`
}

type UserRole struct {
    ID        uint `gorm:"primaryKey"`
    UserID    uint `gorm:"not null;index"`
    Role      Role `gorm:"type:user_role_enum;not null"`
    CreatedBy uint `gorm:"not null"`

    User          User `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE" json:"-"`
}

type UserSarprasType struct {
    ID            uint `gorm:"primaryKey"`
    UserID        uint `gorm:"not null;index"`
    SarprasTypeID uint `gorm:"not null;index"`
    CreatedBy     uint `gorm:"not null"`

    SarprasType   SarprasType `gorm:"foreignKey:SarprasTypeID;references:ID;constraint:OnDelete:CASCADE" json:"-"`
    User          User        `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"        json:"-"`
}

type UserFilter struct {
	DepartmentID *uint
	Role         *Role
	Search       string
	Page         int
	PageSize     int
	SortBy       string
	SortOrder    string
}

type UserRow struct {
	ID             uint
	NIK            string
	Name           string
	Email          string
	SiteName       string
	DepartmentName string
	Roles          []Role
	IsActive       bool
	IsSupervisor   bool
}

// Buka internal/domain/user.go
type UserProfile struct {
	ID                 uint              `json:"id"`
	Email              string            `json:"email"`
	FullName           string            `json:"full_name"`
	IsSupervisor       bool              `json:"is_supervisor"`
	Roles              []Role            `json:"roles"`
	DepartmentName     string            `json:"department_name"`
	DepartmentID       uint              `json:"department_id"`
	AssignedSarpras    []AssignedSarpras `json:"assigned_sarpras"`
	MustChangePassword bool              `json:"must_change_password"`
}

type UserCompact struct {
	ID             uint   `json:"id"`
	Name           string `json:"name"`
	Email          string `json:"email"`
	DepartmentName string `json:"department_name"`
}

type LoginResponse struct {
	User        UserProfile  `json:"user"`
	Permissions []Permission `json:"permissions"`
	Menus       []string     `json:"menus"`
}

type AssignedSarpras struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
	Code string `json:"code,omitempty"`
}

type UserRepository interface {
	Create(ctx context.Context, user *User) error
	Update(ctx context.Context, user *User) error
	Delete(ctx context.Context, id uint) error
	AssignRole(ctx context.Context, userRole *UserRole) error
	RemoveRole(ctx context.Context, userID uint, role Role) error
	AssignSarpras(ctx context.Context, us *UserSarprasType) error
	RemoveSarprasAssignment(ctx context.Context, userID uint) error
	FindDeletedByNIK(ctx context.Context, nik string) (*User, error)
	Restore(ctx context.Context, id uint, updates *User) error
	FindByID(ctx context.Context, id uint) (*User, error)
	FindByEmail(ctx context.Context, email string) (*User, error)
	FindByNIK(ctx context.Context, nik string) (*User, error)
	FindByDepartmentName(ctx context.Context, deptName string) ([]User, error)
	ListUsers(ctx context.Context, filter UserFilter) ([]UserRow, int64, error)
	FindByRole(ctx context.Context, role Role) ([]User, error)
	GetUserRoles(ctx context.Context, userID uint) ([]Role, error)
	GetApprovers(ctx context.Context) ([]User, error)
	GetCheckerSarprasTypeList(ctx context.Context, userID uint) ([]uint, error)
	FindCheckersByDeptAndType(ctx context.Context, deptID, typeID uint) ([]User, error)
	FindDefaultPICByDepartmentID(ctx context.Context, tx *gorm.DB, departmentID uint) (*User, error)
	UpdatePassword(ctx context.Context, userID uint, newPasswordHash string) error

	// New methods for department‑level uniqueness
	FindUsersByDepartmentAndRole(ctx context.Context, departmentID uint, role Role) ([]User, error)
	FindSupervisorsByDepartment(ctx context.Context, departmentID uint) ([]User, error)
	UpdateSupervisorStatus(ctx context.Context, userID uint, supervisor bool) error
}

type UserService interface {
	ValidateLogin(ctx context.Context, email, password string) (*User, error)
	CreateUser(ctx context.Context, actorID uint, user *User, roles []Role, sarprasTypeIDs []uint) (*User, error)
	UpdateUser(ctx context.Context, actorID, userID uint, updates *User, newRoles []Role, newSarprasIDs []uint) (*User, error)
	DeleteUser(ctx context.Context, actorID, userID uint) error

	GetUser(ctx context.Context, id uint) (*User, error)
	ListUsers(ctx context.Context, filter UserFilter) ([]UserRow, int64, error)
	GetApproversEmail(ctx context.Context) ([]string, error)
	ChangePassword(ctx context.Context, userID uint, oldPassword, newPassword string) error
	GetUserByEmail(ctx context.Context, email string) (*User, error)
	ForceResetPassword(ctx context.Context, userID uint, newPassword string) error
}
