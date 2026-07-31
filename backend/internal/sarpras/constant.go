package sarpras

// Common

const SearchCodeAndName_SarprasTypes = " AND (st.code ILIKE ? OR st.name ILIKE ?) "
const SearchCodeAndName_Sarpras = " AND (s.code ILIKE ? OR st.name ILIKE ?) "

// Sarpras Types
// ── CHANGED: inspection_interval → insp_interval_months in SELECT ──

const ListSarprasTypes = `
	SELECT
	    st.id,
	    st.code                    AS sarprastype_code,
	    st.name                    AS sarprastype_name,
	    st.is_apar,
	    d.code                     AS pic_department_code,
	    d.name                     AS pic_department_name,
	    st.insp_interval_months,
	    st.created_at,
	    st.updated_at
	FROM sarpras_types st
	JOIN departments d ON st.pic_dept_id = d.id
	WHERE 1=1 `

const SarprasTypesDetail = `
	SELECT
	    s.id,
	    s.code,
	    s.name                     AS sarpras_name,
	    d.name                     AS pic_department,
		s.insp_interval_months     AS insp_interval_months,
	    JSON_AGG(
	        JSON_BUILD_OBJECT(
	            'id',       p.id,
	            'name',     p.name,
	            'desc',     p.param_desc,
	            'order_no', p.order_no
	        ) ORDER BY p.order_no
	    )                          AS parameters
	FROM parameters p
	JOIN sarpras_types s ON s.id = p.sarpras_type_id
	JOIN departments   d ON d.id = s.pic_dept_id
	WHERE s.id = $1
	GROUP BY s.id, s.name, d.name `

// Sarpras

const CountByTypeAndDepts = `
	SELECT COUNT(*)
	FROM sarpras s
	JOIN sarpras_types st ON st.id = s.sarpras_type_id
	WHERE s.sarpras_type_id  = $1
	  AND s.location_dept_id = $2
	  AND st.pic_dept_id     = $3 `

const SelectIDSite = `SELECT name FROM sites WHERE id = 1`

const ListSarpras = `
	SELECT
	    s.id,
	    s.code,
	    st.name,
	    ld.name  AS location_dept_name,
		site.name as site_name,
	    pd.name  AS pic_dept_name,
	    s.location_detail,
	    s.risk_score,
	    s.risk_level,
	    s.status,
	    s.due_date
	FROM sarpras s
	JOIN sarpras_types st ON st.id = s.sarpras_type_id
	JOIN departments   ld ON ld.id = s.location_dept_id
	JOIN sites 		 site ON site.id = s.site_id
	JOIN departments   pd ON pd.id = st.pic_dept_id
	WHERE 1=1 `

const CountListSarpras = `
	SELECT COUNT(*)
	FROM sarpras s
	JOIN sarpras_types st ON st.id = s.sarpras_type_id
	JOIN departments   ld ON ld.id = s.location_dept_id
	JOIN departments   pd ON pd.id = st.pic_dept_id
	JOIN sites 		 site ON site.id = s.site_id
	WHERE 1=1 %s`

const GetCheckerAssignedSarpras = `
	SELECT
	    s.id,
	    st.name,
	    ld.name,
	    pd.name,
	    s.location_detail,
	    s.risk_score,
	    s.risk_level,
	    s.status,
	    s.due_date
	FROM sarpras s
	JOIN user_sarpras  us ON us.sarpras_id = s.id AND us.user_id = $1
	JOIN sarpras_types st ON st.id = s.sarpras_type_id
	JOIN departments   ld ON ld.id = s.location_dept_id
	JOIN departments   pd ON pd.id = st.pic_dept_id
	ORDER BY s.code
	LIMIT $2 OFFSET $3 `

const GetExpiringApar = `
	SELECT
	    s.id,
	    s.code,
	    st.name,
	    ld.name,
	    pd.name,
	    s.location_detail,
	    s.risk_score,
	    s.risk_level,
	    s.status,
	    s.expired_date
	FROM sarpras s
	JOIN sarpras_types st ON st.id = s.sarpras_type_id AND st.is_apar = true
	JOIN departments   ld ON ld.id = s.location_dept_id
	JOIN departments   pd ON pd.id = st.pic_dept_id
	WHERE s.expired_date <= $1
	  AND s.status != 'expired'
	ORDER BY s.expired_date `

// ── DueDate recalculation (used by inspection submit) ────────────────────────
// When an inspection is submitted we update sarpras.due_date using the type's
// interval in months (not days).  This query is called directly by the
// inspection service after a successful submit.
//
// $1 = sarpras_id
const UpdateDueDateByMonths = `
	UPDATE sarpras s
	SET
	    due_date       = s.last_inspected + (st.insp_interval_months * INTERVAL '1 month'),
	    updated_at     = NOW()
	FROM sarpras_types st
	WHERE st.id  = s.sarpras_type_id
	  AND s.id   = $1 `

const INVALID_ID = "ID Tidak Valid"
const FAILED_SERIALIZE_PAYLOAD = "failed to serialize payload: %w"
const DATA_NOT_FOUND = "Data tidak ditemukan"

// ── Queries that previously lived in the service layer ───────────────────────
const GetDefaultSiteID = `SELECT id FROM sites ORDER BY id ASC LIMIT 1`
const GetUserDeptID    = `SELECT department_id FROM users WHERE id = ?`
const UserHasTypeAssignment = `SELECT COUNT(*) FROM user_sarpras_types WHERE user_id = ? AND sarpras_type_id = ?`
const GetActiveScheduleID = `SELECT id FROM inspection_schedules WHERE sarpras_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`
const GetMaxSarprasSequence = `
    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '[0-9]+$') AS INTEGER)), 0)
    FROM sarpras
    WHERE sarpras_type_id = ? AND location_dept_id = ? AND code LIKE ?`
const GetUserNameByID = `SELECT name FROM users WHERE id = ?`
