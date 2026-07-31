package user

const WhereUserID = "user_id = ?"

const GetUserRoles = ` SELECT role FROM user_roles WHERE user_id = $1`

const GetUserPermissoins = ` SELECT DISTINCT p.name, FROM user_roles ur
		JOIN roles r ON r.id = ur.role_id 
		JOIN role_permissions rp ON rp.role_id = r.id 
		JOIN permissions p ON p.id = rp.permission_id 
		WHERE ur.user_id = $1 `

const GetCheckerSarprasTypeList = ` SELECT sarpras_type_id FROM user_sarpras WHERE user_id = $1`

const JOIN_USER_ROLES = "JOIN user_roles ON user_roles.user_id = users.id"
