package dashboard

const COUNT_SUMMARY_BASE = `
	SELECT COUNT(s.id), COALESCE(SUM(s.risk_score), 0)
	FROM sarpras s
	LEFT JOIN sarpras_types st ON s.sarpras_type_id = st.id
	LEFT JOIN departments   d  ON d.id = s.location_dept_id`

const STATUS_STATISTIC_BASE = `
	SELECT s.status, COUNT(s.id), COALESCE(SUM(s.risk_score), 0)
	FROM sarpras s
	LEFT JOIN sarpras_types st ON s.sarpras_type_id = st.id
	LEFT JOIN departments   d  ON d.id = s.location_dept_id`

const SARPRAS_STATISTIC_BASE = `
	SELECT
	    COALESCE(st.name, 'Unknown') AS type_name,
	    COUNT(s.id) AS count
	FROM sarpras s
	LEFT JOIN sarpras_types st ON s.sarpras_type_id = st.id
	LEFT JOIN departments   d  ON d.id = s.location_dept_id`

const SUMMARY_STATUS_FILTER = `s.status = $%d`

const SUMMARY_DEPT_FILTER = `d.id = $%d`

const SUMMARY_TYPE_FILTER = `st.id = $%d`

const STATUS_FILTER = ` s.status = $%d `

const PERIOD_FILTER = ` TO_CHAR(s.due_date, 'YYYY-MM') = $%d `

const DEPTID_FILTER = ` d.id = $%d `

const SARPRAS_TYPES_FILTER = ` st.id = $%d `

const SEARCH_FILTER = ` (LOWER(st.name) LIKE $%d OR LOWER(s.code) LIKE $%d OR LOWER(d.name) LIKE $%d)`

const BASE_JOIN = ` FROM sarpras s 
					LEFT JOIN sarpras_types st ON s.sarpras_type_id = st.id 
					LEFT JOIN departments d ON d.id = s.location_dept_id `

const LIST_TABLE = ` SELECT
			s.id,
			COALESCE(st.name, 'Unknown') as sarpras_name,
			s.code as sarpras_code,
			COALESCE(d.name, '-') as department_name,
			COALESCE(u.name, 'Belum Diperiksa') as checker_name,
			s.status,
            COALESCE(TO_CHAR(s.last_inspected, 'DD-MM-YYYY'), '-') as last_inspected,
			COALESCE(TO_CHAR(s.due_date, 'DD-MM-YYYY'), '-') as next_check
		%s
		LEFT JOIN LATERAL (
			SELECT checker_id FROM inspections
			WHERE sarpras_id = s.id
			ORDER BY inspected_at DESC LIMIT 1
		) last_insp ON true
		LEFT JOIN users u ON u.id = last_insp.checker_id
		%s
		%s
		LIMIT $%d OFFSET $%d `

const DEPARTMENT_COMPLIANCE_STATS = `SELECT COALESCE(d.name, 'Unknown') AS department_name,
       COUNT(sch.id) AS total_scheduled,
       COUNT(sch.id) FILTER (
         WHERE sch.status = 'overdue'
            OR (sch.status = 'done' AND i.inspected_at::date > sch.due_date)
       ) AS overdue_count
FROM inspection_schedules sch
JOIN sarpras s ON s.id = sch.sarpras_id
LEFT JOIN departments d ON d.id = s.location_dept_id
LEFT JOIN inspections i ON i.schedule_id = sch.id
WHERE EXTRACT(YEAR FROM sch.due_date) = $1
GROUP BY d.name
ORDER BY department_name ASC`