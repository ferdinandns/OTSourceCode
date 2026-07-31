package mytask

// Inspection tasks for checkers.
const GET_CHECKER_TASK = `
        SELECT DISTINCT ON (s.id)
            ins.id, 
            s.code AS title, 
            d.name AS location,
            st.name AS sarpras_type,
            CASE
                WHEN ins.due_date IS NULL THEN 'HIGH'
                WHEN ins.due_date < NOW() THEN 'HIGH'
                ELSE 'MEDIUM'
            END AS priority
        FROM inspection_schedules ins
        JOIN sarpras s ON s.id = ins.sarpras_id
        JOIN departments d ON d.id = s.location_dept_id
        JOIN sarpras_types st ON st.id = s.sarpras_type_id
        WHERE ins.status IN ('pending', 'overdue')
         
          AND s.location_dept_id = (SELECT department_id FROM users WHERE id = $1)
    `

const IS_SUPERVISOR = ` AND s.sarpras_type_id IN (SELECT sarpras_type_id FROM user_sarpras_types WHERE user_id = $1)`

const INSPECTION_ORDER_BY = `
        ORDER BY s.id,
            CASE
                WHEN ins.due_date IS NULL THEN 0
                WHEN ins.due_date < NOW() THEN 0
                ELSE 1
            END,
            ins.due_date ASC,
            ins.created_at ASC`

// Repair tasks for PIC responsibility – uses active submission for due date.
const GET_PIC_RESP_TASKS = `
        SELECT 
            ro.id, 
            s.code AS title, 
            d.name AS location,
            CASE
                WHEN rs.due_date IS NULL THEN 'MEDIUM'
                WHEN rs.due_date < NOW() THEN 'HIGH'
                ELSE 'MEDIUM'
            END AS priority
        FROM repair_orders ro
        JOIN sarpras s ON s.id = ro.sarpras_id
        JOIN departments d ON d.id = s.location_dept_id
        LEFT JOIN repair_submissions rs ON rs.id = ro.active_submission_id
        WHERE ro.pic_id = $1 
          AND ro.status IN ('assigned', 'in_progress', 'rejected')
        ORDER BY 
            CASE
                WHEN rs.due_date IS NULL THEN 1
                WHEN rs.due_date < NOW() THEN 0
                ELSE 1
            END,
            rs.due_date ASC,
            ro.updated_at DESC`

// Verification tasks for QS.
const GET_QS_TASKS = `
    SELECT 
        ro.id, 
        s.code AS title, 
        d.name AS location,
        CASE
            WHEN rs.due_date IS NULL THEN 'HIGH'
            WHEN rs.due_date < NOW() THEN 'HIGH'
            ELSE 'MEDIUM'
        END AS priority
    FROM repair_orders ro
    JOIN sarpras s ON s.id = ro.sarpras_id
    JOIN departments d ON d.id = s.location_dept_id
    LEFT JOIN repair_submissions rs ON rs.id = ro.active_submission_id
    WHERE 
        (ro.status = 'submitted' OR (ro.status = 'in_review' AND ro.reviewer_id = $1))
        AND (
            NOT EXISTS (
                SELECT 1 FROM review_orders rev WHERE rev.repair_order_id = ro.id
            )
            OR 
            'reject' = (
                SELECT rev.verdict 
                FROM review_orders rev 
                WHERE rev.repair_order_id = ro.id 
                ORDER BY rev.created_at DESC 
                LIMIT 1
            )
        )
    ORDER BY 
        CASE
            WHEN rs.due_date IS NULL THEN 0
            WHEN rs.due_date < NOW() THEN 0
            ELSE 1
        END,
        rs.due_date ASC,
        ro.created_at ASC`

// Approval tasks for QS supervisor.
const GET_APPROVALS = `
            SELECT 
                ar.id,
                ar.entity_type || ' - ' || 
                CASE ar.action
                    WHEN 'create' THEN 'create'
                    WHEN 'edit' THEN 'edit'
                    WHEN 'delete' THEN 'delete'
                    ELSE ar.action
                END AS title,
                COALESCE(ar.notes, '') AS subtitle,
                'HIGH' AS priority
            FROM approval_requests ar
            WHERE ar.status = 'pending'
            ORDER BY ar.created_at DESC`

// Refill tasks for GA and QS.
const GET_REFILL_TASKS_GA = `
    SELECT 
        st.id,
        stt.name AS title,
        st.code AS subtitle,
        CASE 
            WHEN st.expired_date < NOW()::date THEN 'HIGH'
            ELSE 'MEDIUM'
        END AS priority
    FROM sarpras st
    JOIN sarpras_types stt ON stt.id = st.sarpras_type_id
    WHERE stt.is_apar = true
      AND (
          st.expired_date < NOW()::date
          OR EXISTS (
              SELECT 1 FROM refill_order_items roi
              WHERE roi.sarpras_id = st.id
                AND roi.status IN ('waiting_evidence', 'rejected')
          )
      )
    ORDER BY st.expired_date ASC
    LIMIT 100
`

const GET_REFILL_TASKS_QS = `
    SELECT 
        st.id,
        stt.name AS title,
        st.code AS subtitle,
        'MEDIUM' AS priority
    FROM sarpras st
    JOIN sarpras_types stt ON stt.id = st.sarpras_type_id
    WHERE stt.is_apar = true
      AND EXISTS (
          SELECT 1 FROM refill_order_items roi
          WHERE roi.sarpras_id = st.id
            AND roi.status = 'waiting_review'
      )
    ORDER BY st.expired_date ASC
    LIMIT 100
`
