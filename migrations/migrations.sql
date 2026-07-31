-- =============================================================================
-- EmerTrack: Docker DB Constraint Migration
-- Tujuan: Menyamakan constraint docker DB agar identik dengan local DB
-- Jalankan di: docker postgres (emertrack DB)
-- CATATAN: Script ini idempotent — pakai DO $$ ... IF NOT EXISTS agar aman
--          dijalankan ulang tanpa error duplikat.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. UNIQUE CONSTRAINTS (nama sesuai konvensi GORM: uni_{table}_{column})
-- =============================================================================

-- departments.code → uni_departments_code
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_code_key') THEN
    ALTER TABLE departments RENAME CONSTRAINT departments_code_key TO uni_departments_code;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uni_departments_code') THEN
    ALTER TABLE departments ADD CONSTRAINT uni_departments_code UNIQUE (code);
  END IF;
END $$;

-- sarpras.code → uni_sarpras_code
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sarpras_code_key') THEN
    ALTER TABLE sarpras RENAME CONSTRAINT sarpras_code_key TO uni_sarpras_code;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uni_sarpras_code') THEN
    ALTER TABLE sarpras ADD CONSTRAINT uni_sarpras_code UNIQUE (code);
  END IF;
END $$;

-- sarpras_types.code → uni_sarpras_types_code
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sarpras_types_code_key') THEN
    ALTER TABLE sarpras_types RENAME CONSTRAINT sarpras_types_code_key TO uni_sarpras_types_code;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uni_sarpras_types_code') THEN
    ALTER TABLE sarpras_types ADD CONSTRAINT uni_sarpras_types_code UNIQUE (code);
  END IF;
END $$;

-- sites.code → uni_sites_code
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_code_key') THEN
    ALTER TABLE sites RENAME CONSTRAINT sites_code_key TO uni_sites_code;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uni_sites_code') THEN
    ALTER TABLE sites ADD CONSTRAINT uni_sites_code UNIQUE (code);
  END IF;
END $$;

-- users.email → uni_users_email
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key') THEN
    ALTER TABLE users RENAME CONSTRAINT users_email_key TO uni_users_email;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uni_users_email') THEN
    ALTER TABLE users ADD CONSTRAINT uni_users_email UNIQUE (email);
  END IF;
END $$;

-- users.nik → uni_users_nik (belum ada di docker maupun local)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uni_users_nik') THEN
    ALTER TABLE users ADD CONSTRAINT uni_users_nik UNIQUE (nik);
  END IF;
END $$;


-- =============================================================================
-- 2. CHECK CONSTRAINTS
-- =============================================================================

-- sarpras_types.insp_interval_months BETWEEN 1 AND 12
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_insp_interval_months'
  ) THEN
    ALTER TABLE sarpras_types
      ADD CONSTRAINT chk_insp_interval_months
      CHECK (insp_interval_months >= 1 AND insp_interval_months <= 12);
  END IF;
END $$;

-- review_orders.verdict IN ('approve', 'reject')
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'review_orders_verdict_check'
  ) THEN
    ALTER TABLE review_orders
      ADD CONSTRAINT review_orders_verdict_check
      CHECK (verdict = ANY (ARRAY['approve'::text, 'reject'::text]));
  END IF;
END $$;


-- =============================================================================
-- 3. FOREIGN KEY — yang ada di docker tapi perlu di-drop & recreate
--    karena docker punya FK tanpa ON DELETE action (nama berbeda)
-- =============================================================================

-- ── departments ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_department') THEN
    ALTER TABLE users DROP CONSTRAINT fk_users_department;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_department_id_fkey') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sarpras_location_dept') THEN
    ALTER TABLE sarpras DROP CONSTRAINT fk_sarpras_location_dept;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sarpras_location_dept_id_fkey') THEN
    ALTER TABLE sarpras
      ADD CONSTRAINT sarpras_location_dept_id_fkey
      FOREIGN KEY (location_dept_id) REFERENCES departments(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sarpras_types_pic_dept') THEN
    ALTER TABLE sarpras_types DROP CONSTRAINT fk_sarpras_types_pic_dept;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sarpras_types_pic_dept_id_fkey') THEN
    ALTER TABLE sarpras_types
      ADD CONSTRAINT sarpras_types_pic_dept_id_fkey
      FOREIGN KEY (pic_dept_id) REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── inspection_schedules ──────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inspections_schedule') THEN
    ALTER TABLE inspections
      ADD CONSTRAINT fk_inspections_schedule
      FOREIGN KEY (schedule_id) REFERENCES inspection_schedules(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inspection_schedules_checker') THEN
    ALTER TABLE inspection_schedules DROP CONSTRAINT fk_inspection_schedules_checker;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_schedules_checker') THEN
    ALTER TABLE inspection_schedules
      ADD CONSTRAINT fk_schedules_checker
      FOREIGN KEY (checker_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inspection_schedules_sarpras') THEN
    ALTER TABLE inspection_schedules DROP CONSTRAINT fk_inspection_schedules_sarpras;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_schedules_sarpras') THEN
    ALTER TABLE inspection_schedules
      ADD CONSTRAINT fk_schedules_sarpras
      FOREIGN KEY (sarpras_id) REFERENCES sarpras(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── inspections ───────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_repair_orders_inspection') THEN
    ALTER TABLE repair_orders
      ADD CONSTRAINT fk_repair_orders_inspection
      FOREIGN KEY (inspection_id) REFERENCES inspections(id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inspections_items') THEN
    ALTER TABLE inspection_items DROP CONSTRAINT fk_inspections_items;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inspection_items_inspection') THEN
    ALTER TABLE inspection_items
      ADD CONSTRAINT fk_inspection_items_inspection
      FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inspections_checker') THEN
    ALTER TABLE inspections DROP CONSTRAINT fk_inspections_checker;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inspections_checker') THEN
    ALTER TABLE inspections
      ADD CONSTRAINT fk_inspections_checker
      FOREIGN KEY (checker_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inspections_sarpras') THEN
    ALTER TABLE inspections DROP CONSTRAINT fk_inspections_sarpras;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inspections_sarpras') THEN
    ALTER TABLE inspections
      ADD CONSTRAINT fk_inspections_sarpras
      FOREIGN KEY (sarpras_id) REFERENCES sarpras(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── parameters ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inspection_items_parameter') THEN
    ALTER TABLE inspection_items DROP CONSTRAINT fk_inspection_items_parameter;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inspection_items_param') THEN
    ALTER TABLE inspection_items
      ADD CONSTRAINT fk_inspection_items_param
      FOREIGN KEY (parameter_id) REFERENCES parameters(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sarpras_types_expiry_param') THEN
    ALTER TABLE sarpras_types
      ADD CONSTRAINT fk_sarpras_types_expiry_param
      FOREIGN KEY (expiry_param_id) REFERENCES parameters(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── refill_orders ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refill_order_items_refill_order_id_fkey') THEN
    ALTER TABLE refill_order_items
      ADD CONSTRAINT refill_order_items_refill_order_id_fkey
      FOREIGN KEY (refill_order_id) REFERENCES refill_orders(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refill_orders_submitted_by_fkey') THEN
    ALTER TABLE refill_orders
      ADD CONSTRAINT refill_orders_submitted_by_fkey
      FOREIGN KEY (submitted_by) REFERENCES users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refill_order_items_sarpras_id_fkey') THEN
    ALTER TABLE refill_order_items
      ADD CONSTRAINT refill_order_items_sarpras_id_fkey
      FOREIGN KEY (sarpras_id) REFERENCES sarpras(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refill_order_items_reviewed_by_fkey') THEN
    ALTER TABLE refill_order_items
      ADD CONSTRAINT refill_order_items_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refill_order_items_evidence_by_fkey') THEN
    ALTER TABLE refill_order_items
      ADD CONSTRAINT refill_order_items_evidence_by_fkey
      FOREIGN KEY (evidence_by) REFERENCES users(id);
  END IF;
END $$;

-- ── repair_orders ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_repair_orders_submissions') THEN
    ALTER TABLE repair_submissions DROP CONSTRAINT fk_repair_orders_submissions;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'repair_submissions_repair_order_id_fkey') THEN
    ALTER TABLE repair_submissions
      ADD CONSTRAINT repair_submissions_repair_order_id_fkey
      FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_review_orders_repair_order') THEN
    ALTER TABLE review_orders DROP CONSTRAINT fk_review_orders_repair_order;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_orders_repair_order_id_fkey') THEN
    ALTER TABLE review_orders
      ADD CONSTRAINT review_orders_repair_order_id_fkey
      FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_repair_orders_sarpras') THEN
    ALTER TABLE repair_orders DROP CONSTRAINT fk_repair_orders_sarpras;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_repair_orders_sarpras') THEN
    ALTER TABLE repair_orders
      ADD CONSTRAINT fk_repair_orders_sarpras
      FOREIGN KEY (sarpras_id) REFERENCES sarpras(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_repair_orders_pic') THEN
    ALTER TABLE repair_orders DROP CONSTRAINT fk_repair_orders_pic;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_repair_orders_pic') THEN
    ALTER TABLE repair_orders
      ADD CONSTRAINT fk_repair_orders_pic
      FOREIGN KEY (pic_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'repair_orders_reviewer_id_fkey') THEN
    ALTER TABLE repair_orders
      ADD CONSTRAINT repair_orders_reviewer_id_fkey
      FOREIGN KEY (reviewer_id) REFERENCES users(id);
  END IF;
END $$;

-- ── repair_submissions ────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_repair_submissions_evidences') THEN
    ALTER TABLE repair_evidences DROP CONSTRAINT fk_repair_submissions_evidences;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'repair_evidences_submission_id_fkey') THEN
    ALTER TABLE repair_evidences
      ADD CONSTRAINT repair_evidences_submission_id_fkey
      FOREIGN KEY (submission_id) REFERENCES repair_submissions(id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_review_orders_submission') THEN
    ALTER TABLE review_orders DROP CONSTRAINT fk_review_orders_submission;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_orders_submission_id_fkey') THEN
    ALTER TABLE review_orders
      ADD CONSTRAINT review_orders_submission_id_fkey
      FOREIGN KEY (submission_id) REFERENCES repair_submissions(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'repair_orders_active_submission_id_fkey') THEN
    ALTER TABLE repair_orders
      ADD CONSTRAINT repair_orders_active_submission_id_fkey
      FOREIGN KEY (active_submission_id) REFERENCES repair_submissions(id);
  END IF;
END $$;

-- ── review_orders ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_review_orders_attachments') THEN
    ALTER TABLE review_attachments DROP CONSTRAINT fk_review_orders_attachments;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_attachments_review_order_id_fkey') THEN
    ALTER TABLE review_attachments
      ADD CONSTRAINT review_attachments_review_order_id_fkey
      FOREIGN KEY (review_order_id) REFERENCES review_orders(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_orders_reviewer_id_fkey') THEN
    ALTER TABLE review_orders
      ADD CONSTRAINT review_orders_reviewer_id_fkey
      FOREIGN KEY (reviewer_id) REFERENCES users(id);
  END IF;
END $$;

-- ── sarpras ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sarpras_usage_logs_sarpras_id_fkey') THEN
    ALTER TABLE sarpras_usage_logs
      ADD CONSTRAINT sarpras_usage_logs_sarpras_id_fkey
      FOREIGN KEY (sarpras_id) REFERENCES sarpras(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sarpras_usage_logs_marked_by_fkey') THEN
    ALTER TABLE sarpras_usage_logs
      ADD CONSTRAINT sarpras_usage_logs_marked_by_fkey
      FOREIGN KEY (marked_by) REFERENCES users(id);
  END IF;
END $$;

-- ── sarpras_types ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_sarpras_types_sarpras_type') THEN
    ALTER TABLE user_sarpras_types DROP CONSTRAINT fk_user_sarpras_types_sarpras_type;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sarpras_types_sarpras_type_id_fkey') THEN
    ALTER TABLE user_sarpras_types
      ADD CONSTRAINT user_sarpras_types_sarpras_type_id_fkey
      FOREIGN KEY (sarpras_type_id) REFERENCES sarpras_types(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sarpras_types_parameters') THEN
    ALTER TABLE parameters DROP CONSTRAINT fk_sarpras_types_parameters;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parameters_sarpras_type_id_fkey') THEN
    ALTER TABLE parameters
      ADD CONSTRAINT parameters_sarpras_type_id_fkey
      FOREIGN KEY (sarpras_type_id) REFERENCES sarpras_types(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sarpras_sarpras_type') THEN
    ALTER TABLE sarpras DROP CONSTRAINT fk_sarpras_sarpras_type;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sarpras_sarpras_type_id_fkey') THEN
    ALTER TABLE sarpras
      ADD CONSTRAINT sarpras_sarpras_type_id_fkey
      FOREIGN KEY (sarpras_type_id) REFERENCES sarpras_types(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ── sites ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sarpras_site') THEN
    ALTER TABLE sarpras
      ADD CONSTRAINT fk_sarpras_site
      FOREIGN KEY (site_id) REFERENCES sites(id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_site') THEN
    ALTER TABLE users DROP CONSTRAINT fk_users_site;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_site_id_fkey') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_site_id_fkey
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_departments_site') THEN
    ALTER TABLE departments DROP CONSTRAINT fk_departments_site;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_site_id_fkey') THEN
    ALTER TABLE departments
      ADD CONSTRAINT departments_site_id_fkey
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ── users ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_logs_user') THEN
    ALTER TABLE audit_logs DROP CONSTRAINT fk_audit_logs_user;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_user_id_fkey') THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_requests_requester') THEN
    ALTER TABLE approval_requests DROP CONSTRAINT fk_approval_requests_requester;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_requests_requested_by_fkey') THEN
    ALTER TABLE approval_requests
      ADD CONSTRAINT approval_requests_requested_by_fkey
      FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_requests_reviewer') THEN
    ALTER TABLE approval_requests DROP CONSTRAINT fk_approval_requests_reviewer;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_requests_reviewed_by_fkey') THEN
    ALTER TABLE approval_requests
      ADD CONSTRAINT approval_requests_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_user') THEN
    ALTER TABLE notifications DROP CONSTRAINT fk_notifications_user;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey') THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_roles') THEN
    ALTER TABLE user_roles DROP CONSTRAINT fk_users_roles;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_fkey') THEN
    ALTER TABLE user_roles
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_assignments') THEN
    ALTER TABLE user_sarpras_types DROP CONSTRAINT fk_users_assignments;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sarpras_types_user_id_fkey') THEN
    ALTER TABLE user_sarpras_types
      ADD CONSTRAINT user_sarpras_types_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_repair_evidences_user') THEN
    ALTER TABLE repair_evidences
      ADD CONSTRAINT fk_repair_evidences_user
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- FK: users.created_by/updated_by → users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_created_by') THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_created_by
      FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_updated_by') THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_updated_by
      FOREIGN KEY (updated_by) REFERENCES users(id);
  END IF;
END $$;

-- ADD COLUMN created_by/updated_by ke departments jika belum ada
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'departments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE departments ADD COLUMN created_by BIGINT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'departments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE departments ADD COLUMN updated_by BIGINT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_departments_created_by') THEN
    ALTER TABLE departments
      ADD CONSTRAINT fk_departments_created_by
      FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_departments_updated_by') THEN
    ALTER TABLE departments
      ADD CONSTRAINT fk_departments_updated_by
      FOREIGN KEY (updated_by) REFERENCES users(id);
  END IF;
END $$;

-- ADD COLUMN created_by/updated_by ke sites jika belum ada
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sites ADD COLUMN created_by BIGINT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sites ADD COLUMN updated_by BIGINT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sites_created_by') THEN
    ALTER TABLE sites
      ADD CONSTRAINT fk_sites_created_by
      FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sites_updated_by') THEN
    ALTER TABLE sites
      ADD CONSTRAINT fk_sites_updated_by
      FOREIGN KEY (updated_by) REFERENCES users(id);
  END IF;
END $$;

-- FK: user_roles.created_by → users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_roles_created_by') THEN
    ALTER TABLE user_roles
      ADD CONSTRAINT fk_user_roles_created_by
      FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;

-- FK: user_sarpras_types.created_by → users(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_sarpras_types_created_by') THEN
    ALTER TABLE user_sarpras_types
      ADD CONSTRAINT fk_user_sarpras_types_created_by
      FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- Verifikasi setelah run:
-- SELECT pgc.conname, ccu.table_name, pgc.contype, pg_get_constraintdef(pgc.oid)
-- FROM pg_constraint pgc
-- JOIN pg_namespace nsp ON nsp.oid = pgc.connamespace
-- JOIN pg_class cls ON pgc.conrelid = cls.oid
-- LEFT JOIN information_schema.constraint_column_usage ccu
--     ON pgc.conname = ccu.constraint_name AND nsp.nspname = ccu.constraint_schema
-- WHERE nsp.nspname = 'public'
-- ORDER BY ccu.table_name, pgc.contype;
-- 