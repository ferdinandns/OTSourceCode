package structs

// ============================================
// ROLE & GROUP CONSTANTS
// ============================================

const (
	GroupSuperadmin = 1
	GroupManager    = 2
	GroupSupervisor = 3
	GroupAnalyst    = 4
	GroupUser       = 5
)

var ValidRoles = []string{
	"superadmin",
	"administrator",
	"andev_manager",
	"qcts_manager",
	"qa_manager",
	"qc_supervisor",
	"andev_supervisor",
	"qa_supervisor",
	"ts_supervisor",
	"qc_analyst_mikro",
	"qc_analyst_rm",
	"qc_analyst_pm",
	"qc_analyst_oj_stabtest",
	"qc_analyst_ehm",
	"qc_analyst_ipc",
	"andev_staff",
	"qa_staff",
	"ts_staff",
	"user",
}

var RoleToGroup = map[string]int{
	"superadmin":             GroupSuperadmin,
	"administrator":          GroupManager,
	"andev_manager":          GroupManager,
	"qcts_manager":           GroupManager,
	"qa_manager":             GroupManager,
	"qc_supervisor":          GroupSupervisor,
	"andev_supervisor":       GroupSupervisor,
	"qa_supervisor":          GroupSupervisor,
	"ts_supervisor":          GroupSupervisor,
	"qc_analyst_mikro":       GroupAnalyst,
	"qc_analyst_rm":          GroupAnalyst,
	"qc_analyst_pm":          GroupAnalyst,
	"qc_analyst_oj_stabtest": GroupAnalyst,
	"qc_analyst_ehm":         GroupAnalyst,
	"qc_analyst_ipc":         GroupAnalyst,
	"andev_staff":            GroupAnalyst,
	"qa_staff":               GroupAnalyst,
	"ts_staff":               GroupAnalyst,
	"user":                   GroupUser,
}

// ============================================
// USER STRUCTS
// ============================================

type UserResponse struct {
	Id                 uint             `json:"id"`
	Name               string           `json:"name"`
	Username           string           `json:"username"`
	Email              string           `json:"email"`
	UserGroup          int              `json:"user_group"`
	Role               string           `json:"role"`
	Status             string           `json:"status,omitempty"`
	MustChangePassword bool             `json:"must_change_password,omitempty"`
	LokasiUtamaId      *uint            `json:"lokasi_utama_id,omitempty"`
	LokasiAktifId      *uint            `json:"lokasi_aktif_id,omitempty"`
	LokasiUtama        *LokasiResponse  `json:"lokasi_utama,omitempty"`
	LokasiAktif        *LokasiResponse  `json:"lokasi_aktif,omitempty"`
	LokasiTambahan     []LokasiResponse `json:"lokasi_tambahan,omitempty"`
	Token              *string          `json:"token,omitempty"`
	CreatedAt          string           `json:"created_at"`
	UpdatedAt          string           `json:"updated_at"`
}

type UserCreateRequest struct {
	Name string `json:"name" binding:"required"`
	// Username is optional — auto-generated from Name if blank.
	// Remove binding:"required" so the auto-gen branch in CreateUser is reachable.
	Username          string `json:"username"`
	Email             string `json:"email" binding:"required,email"`
	Password          string `json:"password" binding:"required,min=6"`
	Role              string `json:"role" binding:"required"`
	LokasiUtamaId     uint   `json:"lokasi_utama_id" binding:"required"`
	LokasiTambahanIds []uint `json:"lokasi_tambahan_ids"`
}

type UserUpdateRequest struct {
	Name              string  `json:"name" binding:"required"`
	Username          string  `json:"username" binding:"required"`
	Email             string  `json:"email" binding:"required,email"`
	Password          *string `json:"password,omitempty"`
	Role              string  `json:"role" binding:"required"`
	Status            string  `json:"status"`
	LokasiUtamaId     *uint   `json:"lokasi_utama_id"`
	LokasiAktifId     *uint   `json:"lokasi_aktif_id"`
	LokasiTambahanIds []uint  `json:"lokasi_tambahan_ids"`
}

type UserLoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	LokasiId *uint  `json:"lokasi_id,omitempty"`
}

type RegisterRequest struct {
	Name string `json:"name" binding:"required"`
	// Username optional — auto-generated from Name if blank.
	Username          string `json:"username"`
	Email             string `json:"email" binding:"required,email"`
	Password          string `json:"password" binding:"required,min=6"`
	LokasiUtamaId     uint   `json:"lokasi_utama_id" binding:"required"`
	LokasiTambahanIds []uint `json:"lokasi_tambahan_ids"`
}

type ProfileUpdateRequest struct {
	Username        string  `json:"username"`
	CurrentPassword string  `json:"current_password" binding:"required"`
	NewPassword     *string `json:"new_password,omitempty"`
}

type ForgotPasswordRequest struct {
	Username string `json:"username" binding:"required"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=active pending deactive"`
}
