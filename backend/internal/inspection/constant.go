package inspection

const (
	LIST_ALL = `
        SELECT 
        COALESCE(curr.id, 0) AS schedule_id,
        s.id AS sarpras_id,
        s.code AS sarpras_code,
        st.name AS sarpras_type_name,
        d.name AS department_name,
        COALESCE(u_curr.name, '-') AS checker_name,
        COALESCE(curr.checker_id, 0) AS checker_id,
        s.created_at,
        COALESCE(curr.status, 'pending') AS schedule_status,
        s.status AS sarpras_status,
        curr.due_date
    FROM sarpras s
    JOIN sarpras_types st ON st.id = s.sarpras_type_id
    JOIN departments d ON d.id = s.location_dept_id

    LEFT JOIN LATERAL (
        SELECT id, status, checker_id, due_date
        FROM inspection_schedules 
        WHERE sarpras_id = s.id AND status IN ('pending', 'in_progress', 'overdue')
        ORDER BY due_date ASC 
        LIMIT 1
    ) curr ON true

    LEFT JOIN users u_curr ON u_curr.id = curr.checker_id

    WHERE curr.id IS NOT NULL %s
    ORDER BY
        CASE
            WHEN curr.due_date IS NULL THEN 0
            WHEN curr.due_date <= NOW() THEN 1
            WHEN curr.due_date <= NOW() + INTERVAL '10 days' THEN 2
            ELSE 3
        END ASC,
        curr.due_date ASC NULLS FIRST
    LIMIT $%d OFFSET $%d
`

	COUNT_ALL = `
		SELECT COUNT(*)
		FROM sarpras s
		JOIN sarpras_types st ON st.id = s.sarpras_type_id
		JOIN departments d ON d.id = s.location_dept_id
		WHERE 1=1 %s`

	// History

	LIST_HISTORY = `
        SELECT 
            i.id AS inspection_id,
            s.id AS sarpras_id,
            s.code AS sarpras_code,
            st.name AS sarpras_name,
            d.name AS department_name,
            COALESCE(u.name, '-') AS checker_name,
            i.inspected_at,
            i.overall_status,
            ro.id AS repair_order_id,
            ro.status AS repair_status
        FROM inspections i
        JOIN sarpras s ON s.id = i.sarpras_id
        JOIN sarpras_types st ON st.id = s.sarpras_type_id
        JOIN departments d ON d.id = s.location_dept_id
        LEFT JOIN users u ON u.id = i.checker_id
        LEFT JOIN repair_orders ro ON ro.inspection_id = i.id
        WHERE 1=1 %s
        ORDER BY i.inspected_at DESC
        LIMIT $%d OFFSET $%d
    `

	COUNT_HISTORY = `
        SELECT COUNT(*)
        FROM inspections i
        JOIN sarpras s ON s.id = i.sarpras_id
        JOIN sarpras_types st ON st.id = s.sarpras_type_id
        JOIN departments d ON d.id = s.location_dept_id
        WHERE 1=1 %s
    `

	// LIST_MONITORING - for QS, only sarpras with non-ready status
	LIST_MONITORING = `
        SELECT 
            COALESCE(curr.id, 0) AS inspection_id,
            s.id AS sarpras_id,
            s.code AS sarpras_code,
            st.name AS sarpras_name,
            d.name AS department_name,
            COALESCE(u_curr.name, '-') AS checker_name,
            COALESCE(curr.checker_id, 0) AS checker_id,
            s.created_at,
            COALESCE(curr.status, 'pending') AS schedule_status,
            s.status AS sarpras_status,
            curr.due_date AS next_due_date
        FROM sarpras s
        JOIN sarpras_types st ON st.id = s.sarpras_type_id
        JOIN departments d ON d.id = s.location_dept_id
        
        LEFT JOIN LATERAL (
            SELECT id, status, checker_id, due_date
            FROM inspection_schedules 
            WHERE sarpras_id = s.id 
            AND status IN ('pending', 'in_progress', 'overdue')
            ORDER BY due_date ASC 
            LIMIT 1
        ) curr ON true

        LEFT JOIN users u_curr ON u_curr.id = curr.checker_id

        WHERE curr.id IS NOT NULL 
        AND s.status IN ('not_ready', 'need_repair', 'will_be_repaired', 'waiting_verification')
        %s
        ORDER BY
            CASE
                WHEN curr.due_date IS NULL THEN 0
                WHEN curr.due_date <= NOW() THEN 1
                WHEN curr.due_date <= NOW() + INTERVAL '10 days' THEN 2
                ELSE 3
            END ASC,
            curr.due_date ASC NULLS FIRST
        LIMIT %s OFFSET %s
    `

	COUNT_MONITORING = `
        SELECT COUNT(*)
        FROM sarpras s
        JOIN sarpras_types st ON st.id = s.sarpras_type_id
        JOIN departments d ON d.id = s.location_dept_id
        WHERE EXISTS (
            SELECT 1 FROM inspection_schedules 
            WHERE sarpras_id = s.id AND status IN ('pending', 'in_progress', 'overdue')
        )
        AND s.status IN ('not_ready', 'need_repair', 'will_be_repaired', 'waiting_verification')
        %s
    `

	GET_SCHEDULES_FOR_REMINDER = ` SELECT 
                id,
                sarpras_id,
                checker_id,
                due_date,
                status,
                created_at 
            FROM inspection_schedules
                WHERE status IN ('pending', 'overdue') 
                AND due_date <= CURRENT_DATE + INTERVAL '10 days' `
)

// Reminder Message

const OVERDUE_REMINDER = "PERINGATAN OVERDUE: Pemeriksaan untuk Sarpras %s sudah melewati jadwal pemeriksaan selanjutnya. Segera lakukan pemeriksaan !"

const INSPECTION_REMINDER = "Pemeriksaan untuk Sarpras %s akan jatuh tempo dalam %d hari. Segera lakukan pemeriksaan."

// List Active Tasks

const SARPRAS_ID = ` AND s.id = $%d`

const SEARCH = ` AND (s.code ILIKE $%d OR st.name ILIKE $%d)`

const USER_ID = ` AND s.location_dept_id = (SELECT department_id FROM users WHERE id = $%d)`

const IS_USER_SUPERVISOR = ` AND (
	(SELECT is_supervisor FROM users WHERE id = $%d) = true
	OR 
	s.sarpras_type_id IN (select sarpras_type_id FROM user_sarpras_types WHERE user_id = $%d)
)`

const COUNT_ACTIVE_TASKS = ` SELECT COUNT(*) FROM sarpras s JOIN sarpras_types st ON st.id = s.sarpras_type_id %s`
