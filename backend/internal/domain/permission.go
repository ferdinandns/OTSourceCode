package domain

type Permission string

const (
	PermManageUser       Permission = "manage:user"
	PermViewUser         Permission = "view:user"
	PermManageMaster     Permission = "manage:master"
	PermViewMaster       Permission = "view:master"
	PermManageSarpras    Permission = "manage:sarpras"
	PermViewSarpras      Permission = "view:sarpras"
	PermApproveRequest   Permission = "approve:request"
	PermViewApproval     Permission = "view:approval"
	PermViewAuditLog     Permission = "view:audit"
	PermViewNotification Permission = "view:notification"
	PermViewTask         Permission = "view:task"
	PermViewRefill       Permission = "view:refill"
	PermViewReportInsp   Permission = "view:report"
	PermViewInspection   Permission = "view:inspection"
	PermViewRepair       Permission = "view:repair"

	// NEW: Permissions for Inspection and Repair
	PermManageInspection Permission = "manage:inspection"
	PermManageRepair     Permission = "manage:repair"
	PermManageReview     Permission = "manage:review"
	PermManageRefill     Permission = "manage:refill"
)

type AppMenu struct {
	ID         string     `json:"id"`
	Title      string     `json:"title"`
	Path       string     `json:"path"`
	Icon       string     `json:"icon"`
	Permission Permission `json:"-"`
	IsGlobal   bool       `json:"-"`
}

var Menus = []AppMenu{
	// Global (All can access)
	{ID: "dashboard", Title: "Dashboard", Path: "/dashboard", Icon: "layout-dashboard", IsGlobal: true},
	{ID: "sarpras_list", Title: "Daftar Sarpras", Path: "/sarpras", Icon: "package", IsGlobal: true},
	{ID: "my_task", Title: "My Task", Path: "/my-task", Icon: "clipboard-check", IsGlobal: true},
	{ID: "audit_trail", Title: "Audit Trail", Path: "/audit", Icon: "", IsGlobal: true},
	{ID: "notification", Title: "Notification Center", Path: "/notifications", Icon: "bell", Permission: PermViewNotification},
	{ID: "inspection_report", Title: "Report Pemeriksaan", Path: "/report", IsGlobal: true, Permission: PermViewReportInsp},

	// Needs Permission
	{ID: "inspection", Title: "Inspection", Path: "/inspections", Icon: "clipboard-list", Permission: PermManageInspection}, // Added Inspection Menu
	{ID: "repair", Title: "Repair Center", Path: "/repairs", Icon: "wrench", Permission: PermManageRepair},
	{ID: "review", Title: "Verifikasi Perbaikan", Path: "/reviews", Icon: "shield-check", Permission: PermManageReview}, // Added Repair Menu
	{ID: "approval", Title: "Approval Center", Path: "/approvals", Icon: "check-square", Permission: PermApproveRequest},
	{ID: "refill", Title: "Monitoring ED APAR", Path: "/refill", Icon: "droplet", Permission: PermManageRefill}, // Example menu for master data management
	{ID: "audit_log", Title: "Audit Log", Path: "/audit-log", Icon: "history", Permission: PermViewAuditLog},    // Fixed to use PermViewAuditLog
	{ID: "user_mgmt", Title: "User Management", Path: "/users", Icon: "users", Permission: PermManageUser},
	{ID: "master_data", Title: "Master Data", Path: "/master", Icon: "database", Permission: PermManageMaster},
	{ID: "master_jenis_sarpras", Title: "Master Jenis Sarpras", Path: "/sarpras_types", Icon: "database", Permission: PermManageSarpras},
}

var baseRolePermissions = map[Role][]Permission{
	RoleAdmin: {
		PermManageUser, PermViewUser, PermManageMaster, PermViewMaster,
		PermViewSarpras, PermViewApproval, PermViewAuditLog, PermViewNotification, PermViewTask, PermManageSarpras, PermViewReportInsp, PermViewInspection,
	},
	RoleQS: {
		PermManageSarpras, PermViewSarpras, PermViewAuditLog, PermManageReview, PermViewMaster, PermViewNotification, PermViewTask, PermViewApproval, PermManageRefill, PermViewRefill, PermViewReportInsp, PermViewInspection, PermManageInspection, PermManageRepair,
	},
	RoleChecker: {
		PermViewSarpras,
		PermManageInspection, // Checker can manage inspections
		PermViewMaster, PermViewNotification, PermViewTask, PermViewReportInsp, PermViewInspection,
	},
	RolePICResponsibility: {
		PermViewSarpras,
		PermManageRepair, // PIC can manage repairs
		PermViewMaster, PermViewNotification, PermViewTask, PermViewReportInsp,
	},
}

func GetEffectivePermissions(roles []Role, isSupervisor bool) []Permission {
	permMap := make(map[Permission]bool)
	isQS := false

	for _, role := range roles {
		if role == RoleQS {
			isQS = true
		}

		if perms, exists := baseRolePermissions[role]; exists {
			for _, p := range perms {
				permMap[p] = true
			}
		}
	}

	if isQS && isSupervisor {
		permMap[PermApproveRequest] = true
		permMap[PermViewApproval] = true
	}

	var result []Permission
	for p := range permMap {
		result = append(result, p)
	}
	return result
}

func GetAvailableMenus(userPerms []Permission) []AppMenu {
	hasPerm := make(map[Permission]bool)
	for _, p := range userPerms {
		hasPerm[p] = true
	}

	var available []AppMenu
	for _, m := range Menus {
		if m.IsGlobal || hasPerm[m.Permission] {
			available = append(available, m)
		}
	}
	return available
}
