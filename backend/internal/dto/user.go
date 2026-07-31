package dto

type LoginRequest struct {
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required"`
	RememberMe bool   `json:"remember_me"`
}

type CreateUserRequest struct {
	NIK            string   `json:"nik" binding:"required"`
	Name           string   `json:"name" binding:"required"`
	Email          string   `json:"email" binding:"required,email"`
	SiteID         uint     `json:"site_id" binding:"required"`
	DepartmentID   uint     `json:"department_id" binding:"required"`
	Roles          []string `json:"roles" binding:"required,min=1"`
	IsSupervisor   bool     `json:"is_supervisor"`
	SarprasTypeIDs []uint   `json:"sarpras_type_ids"`
}

type EditUserRequest struct {
	Name           string   `json:"name" binding:"required"`
	Email          string   `json:"email" binding:"required,email"`
	SiteID         uint     `json:"site_id" binding:"required"`
	DepartmentID   uint     `json:"department_id" binding:"required"`
	IsActive       *bool    `json:"is_active" binding:"required"`     // Gunakan pointer
	IsSupervisor   *bool    `json:"is_supervisor" binding:"required"` // Gunakan pointer
	Roles          []string `json:"roles" binding:"required,min=1"`
	SarprasTypeIDs []uint   `json:"sarpras_type_ids"`
}

type UserResponse struct {
	ID             uint     `json:"id"`
	NIK            string   `json:"nik"`
	Name           string   `json:"name"`
	Email          string   `json:"email"`
	SiteID         uint     `json:"site_id"`
	SiteName       string   `json:"site_name"`
	DepartmentID   uint     `json:"department_id"`
	DepartmentName string   `json:"department_name"`
	Roles          []string `json:"roles"`
	IsSupervisor   bool     `json:"is_supervisor"`
	IsActive       bool     `json:"is_active"`
}

type UserListResponse struct {
	ID             uint     `json:"id"`
	Name           string   `json:"name"`
	Email          string   `json:"email"`
	DepartmentName string   `json:"department_name"`
	Roles          []string `json:"roles"`
	IsSupervisor   bool     `json:"is_supervisor"`
	IsActive       bool     `json:"is_active"`
}

type UserDetailResponse struct {
	ID             uint     `json:"id"`
	NIK            string   `json:"nik"`
	Name           string   `json:"name"`
	Email          string   `json:"email"`
	SiteID         uint     `json:"site_id"`
	SiteName       string   `json:"site_name"`
	DepartmentID   uint     `json:"department_id"`
	DepartmentName string   `json:"department_name"`
	IsActive       bool     `json:"is_active"`
	IsSupervisor   bool     `json:"is_supervisor"`
	Roles          []string `json:"roles"`

	AssignedSarpras []AssignedSarprasResponse `json:"assigned_sarpras"`
}

type AssignedSarprasResponse struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}
