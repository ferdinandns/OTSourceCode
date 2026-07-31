package approval

const CountListPending = ` SELECT COUNT(*) FROM approval_requests WHERE status = 'pending'`

const ListPending = ` SELECT 
			ar.id, 
			ar.entity_type, 
			ar.action, 
			u.name, 
			u.email, 
			d.name as department_name, 
			ar.status, 
			ar.created_at,
			ar.notes,
			ar.payload_json
		FROM approval_requests ar 
		JOIN users u ON u.id = ar.requested_by 
		JOIN departments d ON d.id = u.department_id
		WHERE ar.status = 'pending' 
		ORDER BY ar.created_at DESC 
		LIMIT $1 OFFSET $2 `

const GetRequesterName = `SELECT name FROM users WHERE id = ?`

const CountBulkItems = `
	SELECT COUNT(*)
	FROM jsonb_array_elements(
		(SELECT payload_json::jsonb FROM approval_requests WHERE id = ?)
	) AS elem
	WHERE elem->>'items' IS NOT NULL
`

const GetSiteName = `SELECT name FROM sites ORDER BY id ASC LIMIT 1`

const GetSarprasTypeName = `SELECT name FROM sarpras_types WHERE id = ?`

const GetSarprasName = `SELECT name FROM sarpras WHERE id = ?`

const GetDepartmentName = `SELECT name FROM departments WHERE id = ?`
