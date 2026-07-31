package master

const ListDepartments = ` SELECT d.id, d.code as department_code, d.name as department_name, d.is_qs, s.code as site_code, s.name as site_name, d.created_at, d.updated_at FROM departments d 
		JOIN sites s ON s.id = d.site_id WHERE d.deleted_at IS NULL `

const SearchCodeName_Departments = ` AND (d.name ILIKE ? OR d.code ILIKE ?)`

const SearchCodeName_Sites = ` AND (code ILIKE ? OR name ILIKE ?) `

const ListSites = ` SELECT id, code, name, created_at, updated_at FROM sites WHERE 1=1 `
