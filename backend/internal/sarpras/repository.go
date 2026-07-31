package sarpras

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"emertrack/internal/domain"
	"emertrack/pkg/paginator"
	"emertrack/pkg/sort"
)

const id_ = "id = ?"

type sarprasTypeRepository struct{ db *gorm.DB }

func NewSarprasTypeRepository(db *gorm.DB) domain.SarprasTypeRepository {
	return &sarprasTypeRepository{db: db}
}

func (r *sarprasTypeRepository) Create(ctx context.Context, st *domain.SarprasType) error {
	return r.db.WithContext(ctx).Omit(clause.Associations).Create(st).Error
}

func (r *sarprasTypeRepository) Update(ctx context.Context, st *domain.SarprasType) error {
	return r.db.WithContext(ctx).Save(st).Error
}

func (r *sarprasTypeRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&domain.SarprasType{}, id).Error
}

func (r *sarprasTypeRepository) FindByID(ctx context.Context, id uint) (*domain.SarprasType, error) {
	var st domain.SarprasType
	return &st, r.db.WithContext(ctx).Preload("Parameters").First(&st, id).Error
}

func (r *sarprasTypeRepository) FindByCode(ctx context.Context, code string) (*domain.SarprasType, error) {
	var st domain.SarprasType
	err := r.db.WithContext(ctx).Where("code = ?", code).First(&st).Error
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func (r *sarprasTypeRepository) FindByName(ctx context.Context, name string) (*domain.SarprasType, error) {
	var st domain.SarprasType
	err := r.db.WithContext(ctx).Where("name = ?", name).First(&st).Error
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func (r *sarprasTypeRepository) FindByNameExcludingID(ctx context.Context, name string, excludeID uint) (*domain.SarprasType, error) {
	var st domain.SarprasType
	err := r.db.WithContext(ctx).Where("name = ? AND id != ?", name, excludeID).First(&st).Error
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func (r *sarprasTypeRepository) Detail(ctx context.Context, id uint) (*domain.SarprasTypeDetail, error) {
	query := SarprasTypesDetail

	var result domain.SarprasTypeDetail
	var paramsJSON []byte

	err := r.db.WithContext(ctx).Raw(query, id).Row().Scan(
		&result.ID,
		&result.Code,
		&result.SarprasName,
		&result.PICDepartment,
		&result.InspIntervalMonths,
		&paramsJSON,
	)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(paramsJSON, &result.Parameters); err != nil {
		return nil, err
	}
	return &result, nil
}

func (r *sarprasTypeRepository) List(ctx context.Context, filter map[string]interface{}) ([]domain.SarprasTypeRow, error) {
	var types []domain.SarprasTypeRow
	var args []interface{}

	query := ListSarprasTypes

	if v, ok := filter["search"]; ok {
		query += SearchCodeAndName_SarprasTypes
		keyword := "%" + v.(string) + "%"
		args = append(args, keyword, keyword)
	}

	query += " ORDER BY st.code "

	err := r.db.WithContext(ctx).Raw(query, args...).Scan(&types).Error
	return types, err
}

func (r *sarprasTypeRepository) FindExistingIDs(ctx context.Context, ids []uint) ([]uint, error) {
	var existingIDs []uint
	err := r.db.WithContext(ctx).
		Model(&domain.SarprasType{}).
		Where("id IN ?", ids).
		Pluck("id", &existingIDs).Error
	return existingIDs, err
}

func (r *sarprasTypeRepository) FindExpiryParamID(ctx context.Context, typeID uint) (*uint, error) {
	var expiryParamID *uint
	err := r.db.WithContext(ctx).
		Model(&domain.SarprasType{}).
		Select("expiry_param_id").
		Where("id = ?", typeID).
		Scan(&expiryParamID).Error
	return expiryParamID, err
}

// --- Parameter Handling ---

func (r *sarprasTypeRepository) CreateParameter(ctx context.Context, p *domain.Parameter) error {
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *sarprasTypeRepository) UpdateParameter(ctx context.Context, p *domain.Parameter) error {
	return r.db.WithContext(ctx).Save(p).Error
}

func (r *sarprasTypeRepository) DeleteParameter(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&domain.Parameter{}, id).Error
}

func (r *sarprasTypeRepository) GetParametersByType(ctx context.Context, typeID uint) ([]domain.Parameter, error) {
	var params []domain.Parameter
	return params, r.db.WithContext(ctx).
		Where("sarpras_type_id = ?", typeID).
		Order("order_no").Find(&params).Error
}

// --- Transaction Methods (Called by Approval Service) ---

func (r *sarprasTypeRepository) CreateTx(tx *gorm.DB, st *domain.SarprasType) error {
	return tx.Omit("PICDept", "Parameters").Create(st).Error
}

func (r *sarprasTypeRepository) DeleteTx(tx *gorm.DB, id uint) error {
	return tx.Delete(&domain.SarprasType{}, id).Error
}

func (r *sarprasTypeRepository) UpdateWithParamsTx(tx *gorm.DB, id uint, st *domain.SarprasType) error {
	if err := tx.Model(st).Where(id_, id).Select("Name", "InspInterval").Updates(st).Error; err != nil {
		return err
	}
	return r.syncSarprasTypeParameters(tx, id, st.Parameters)
}

func (r *sarprasTypeRepository) syncSarprasTypeParameters(tx *gorm.DB, parentID uint, parameters []domain.Parameter) error {
	var incomingIDs []uint
	for _, p := range parameters {
		if p.ID != 0 {
			incomingIDs = append(incomingIDs, p.ID)
		}
	}

	deleteQuery := tx.Where("sarpras_type_id = ?", parentID)
	if len(incomingIDs) > 0 {
		deleteQuery = deleteQuery.Where("id NOT IN ?", incomingIDs)
	}
	if err := deleteQuery.Delete(&domain.Parameter{}).Error; err != nil {
		return err
	}

	for i := range parameters {
		parameters[i].SarprasTypeID = parentID
		if parameters[i].ID == 0 {
			if err := tx.Create(&parameters[i]).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Model(&domain.Parameter{}).
				Where(id_, parameters[i].ID).
				Select("Name", "Desc", "OrderNo").
				Updates(&parameters[i]).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

// ==========================================
// SARPRAS REPOSITORY IMPLEMENTATION
// ==========================================

type sarprasRepository struct {
	db    *gorm.DB
	rawDB *sql.DB
}

func NewSarprasRepository(db *gorm.DB, rawDB *sql.DB) domain.SarprasRepository {
	return &sarprasRepository{
		db:    db,
		rawDB: rawDB,
	}
}

func (r *sarprasRepository) Create(ctx context.Context, s *domain.Sarpras) error {
	return r.db.WithContext(ctx).Omit(clause.Associations).Create(s).Error
}

func (r *sarprasRepository) Update(ctx context.Context, s *domain.Sarpras) error {
	return r.db.WithContext(ctx).Save(s).Error
}

func (r *sarprasRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&domain.Sarpras{}, id).Error
}

func (r *sarprasRepository) UpdateStatus(ctx context.Context, id uint, status domain.SarprasStatus) error {
	return r.db.WithContext(ctx).
		Model(&domain.Sarpras{}).
		Where(id_, id).
		Update("status", status).Error
}

func (r *sarprasRepository) FindByID(ctx context.Context, id uint) (*domain.Sarpras, error) {
	var s domain.Sarpras
	err := r.db.WithContext(ctx).Preload("SarprasType").Preload("SarprasType.Parameters").Preload("LocationDept").Preload("SarprasType.PICDept").First(&s, id).Error
	return &s, err
}

func (r *sarprasRepository) FindByCode(ctx context.Context, code string) (*domain.Sarpras, error) {
	var data domain.Sarpras
	err := r.db.WithContext(ctx).
		Preload("SarprasType.PICDept").
		Preload("LocationDept.Site").
		Where("code = ?", code).
		First(&data).Error
	return &data, err
}

func (r *sarprasRepository) CountByTypeAndDepts(ctx context.Context, typeID, locationDeptID, picDeptID uint) (int, error) {
	var count int
	err := r.rawDB.QueryRowContext(
		ctx,
		CountByTypeAndDepts,
		typeID,
		locationDeptID,
		picDeptID,
	).Scan(&count)
	return count, err
}

func (r *sarprasRepository) List(ctx context.Context, f domain.SarprasFilter) ([]domain.SarprasRow, int64, error) {
	limit, offset := paginator.ValidateLimitOffset(f.Limit, f.Offset)
	where, args := buildWhere(f)

	// Hitung total
	var total int64
	if err := r.rawDB.QueryRowContext(ctx, fmt.Sprintf(CountListSarpras, where), args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Sorting
	sortable := map[string]string{
		"code":               "s.code",
		"sarpras_type_name":  "st.name",
		"location_dept_name": "ld.name",
		"site":               "site.name",
		"pic_dept":           "pic_dept_name",
		"risk_score":         "s.risk_score",
		"risk_level":         "s.risk_score",
		"status":             "s.status",
		"due_date":           "s.due_date",
		"last_inspected":     "s.last_inspected",
	}
	defaultSort := "s.code ASC"
	sortBy := f.SortBy
	sortOrder := f.SortOrder
	if sortBy == "" {
		sortBy = "code"
		sortOrder = "ASC"
	}
	orderClause := sort.BuildOrderBy(sortable, sortBy, sortOrder, defaultSort)

	// Bangun query
	query := fmt.Sprintf(ListSarpras+"%s"+orderClause, where)

	if !f.ExportMode {
		args = append(args, limit, offset)
		query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", len(args)-1, len(args))
	}

	rows, err := r.rawDB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	result, _, err := scanRows(rows)
	return result, total, err
}

func (r *sarprasRepository) GetCheckerAssignedSarpras(ctx context.Context, userID uint, f domain.SarprasFilter) ([]domain.SarprasRow, int64, error) {
	limit, offset := paginator.ValidateLimitOffset(f.Limit, f.Offset)

	rows, err := r.rawDB.QueryContext(
		ctx,
		GetCheckerAssignedSarpras,
		userID,
		limit,
		offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	result, _, err := scanRows(rows)
	return result, int64(len(result)), err
}

func (r *sarprasRepository) GetExpiringAPAR(ctx context.Context, before time.Time) ([]domain.SarprasRow, error) {
	rows, err := r.rawDB.QueryContext(ctx, GetExpiringApar, before)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result, _, err := scanRows(rows)
	return result, err
}

func (r *sarprasRepository) FindEligibleChecker(tx *gorm.DB, typeID uint, deptID uint) (uint, error) {
	var user domain.User
	err := tx.Model(&domain.User{}).
		Select("users.id").
		Joins("JOIN user_roles ur ON ur.user_id = users.id").
		Joins("JOIN user_sarpras_types ust ON ust.user_id = users.id").
		Where("ur.role = ?", "checker").
		Where("ust.sarpras_type_id = ?", typeID).
		Where("users.department_id = ?", deptID).
		First(&user).Error
	return user.ID, err
}

func (r *sarprasRepository) GetLastChecker(ctx context.Context, sarprasID uint) (string, error) {
	var checkerName string
	query := `
		SELECT u.name 
		FROM inspections i
		JOIN users u ON i.checker_id = u.id
		WHERE i.sarpras_id = $1
		ORDER BY i.inspected_at DESC
		LIMIT 1`
	err := r.rawDB.QueryRowContext(ctx, query, sarprasID).Scan(&checkerName)
	if err == sql.ErrNoRows {
		return "Belum Diperiksa", nil
	}
	return checkerName, err
}

// --- Transaction Methods (Called by Approval Service) ---

func (r *sarprasRepository) GetLatestCodeTx(tx *gorm.DB, typeID uint, locID uint) (string, error) {
	var last domain.Sarpras
	err := tx.Model(&domain.Sarpras{}).
		Where("sarpras_type_id = ? AND location_dept_id = ?", typeID, locID).
		Order("id desc").
		First(&last).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", nil
		}
		return "", err
	}
	return last.Code, nil
}

func (r *sarprasRepository) CreateTx(tx *gorm.DB, s *domain.Sarpras) error {
	return tx.Omit("SarprasType", "LocationDept").Create(s).Error
}

func (r *sarprasRepository) UpdateTx(tx *gorm.DB, id uint, s *domain.Sarpras) error {
	return tx.Model(&domain.Sarpras{}).
		Where(id_, id).
		Omit("SarprasType", "LocationDept").
		Updates(s).Error
}

func (r *sarprasRepository) DeleteTx(tx *gorm.DB, id uint) error {
	return tx.Delete(&domain.Sarpras{}, id).Error
}

// Scheduler
func (r *sarprasRepository) UpdateStatusByExpiry(ctx context.Context) error {
	query := `
		UPDATE sarpras 
		SET status = CASE 
			WHEN expired_date < NOW()::date THEN 'need_repair'::sarpras_status_enum
			WHEN expired_date >= NOW()::date THEN 'ready'::sarpras_status_enum
		END,
		updated_at = NOW()
		WHERE status IN ('ready', 'need_repair')
		  AND (
			  (expired_date < NOW()::date AND status != 'need_repair')
			  OR
			  (expired_date >= NOW()::date AND status != 'ready')
		  )
	`
	result := r.db.WithContext(ctx).Exec(query)
	return result.Error
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

func buildWhere(f domain.SarprasFilter) (string, []interface{}) {
	var where string
	var args []interface{}
	idx := 1
	if f.LocationDeptID != nil {
		where += fmt.Sprintf(" AND s.location_dept_id = $%d", idx)
		args = append(args, *f.LocationDeptID)
		idx++
	}
	if f.SarprasTypeID != nil {
		where += fmt.Sprintf(" AND s.sarpras_type_id = $%d", idx)
		args = append(args, *f.SarprasTypeID)
		idx++
	}
	if f.Status != nil {
		where += fmt.Sprintf(" AND s.status = $%d", idx)
		args = append(args, *f.Status)
		idx++
	}
	if f.Search != "" {
		where += fmt.Sprintf(" AND (s.code ILIKE $%d OR s.location_detail ILIKE $%d)", idx, idx)
		args = append(args, "%"+f.Search+"%")
		idx++
	}
	return where, args
}

func scanRows(rows *sql.Rows) ([]domain.SarprasRow, int64, error) {
	var result []domain.SarprasRow
	for rows.Next() {
		var row domain.SarprasRow
		if err := rows.Scan(
			&row.ID, &row.Code, &row.SarprasTypeName, &row.LocationDeptName,
			&row.SiteName, &row.PICDeptName, &row.LocationDetail, &row.RiskScore,
			&row.RiskLevel, &row.Status, &row.DueDate,
		); err != nil {
			return nil, 0, err
		}
		result = append(result, row)
	}
	return result, int64(len(result)), rows.Err()
}

// ─── Query Helper (contains raw queries previously placed in the service layer) ───
type sarprasQueryHelper struct {
	db *gorm.DB
}

func newSarprasQueryHelper(db *gorm.DB) *sarprasQueryHelper {
	return &sarprasQueryHelper{db: db}
}

func (h *sarprasQueryHelper) getDefaultSiteID(ctx context.Context) (uint, error) {
	var id uint
	if err := h.db.WithContext(ctx).Raw(GetDefaultSiteID).Scan(&id).Error; err != nil {
		return 0, fmt.Errorf("gagal mengambil default site: %w", err)
	}
	return id, nil
}

func (h *sarprasQueryHelper) getUserDepartmentID(ctx context.Context, userID uint) (uint, error) {
	var deptID uint
	if err := h.db.WithContext(ctx).Raw(GetUserDeptID, userID).Scan(&deptID).Error; err != nil {
		return 0, fmt.Errorf("gagal mengambil department user: %w", err)
	}
	return deptID, nil
}

func (h *sarprasQueryHelper) isCheckerAssigned(ctx context.Context, userID, typeID uint) (bool, error) {
	var count int64
	if err := h.db.WithContext(ctx).Raw(UserHasTypeAssignment, userID, typeID).Scan(&count).Error; err != nil {
		return false, fmt.Errorf("gagal cek penugasan checker: %w", err)
	}
	return count > 0, nil
}

func (h *sarprasQueryHelper) getActiveScheduleID(ctx context.Context, sarprasID uint) (uint, error) {
	var id uint
	if err := h.db.WithContext(ctx).Raw(GetActiveScheduleID, sarprasID).Scan(&id).Error; err != nil {
		return 0, fmt.Errorf("gagal mengambil jadwal aktif: %w", err)
	}
	return id, nil
}

// getNextSarprasSequence is designed to be called inside an active gorm transaction.
// It uses the supplied tx (which already embeds the context) to get the next sequence number.
func (h *sarprasQueryHelper) getNextSarprasSequence(tx *gorm.DB, typeID, locDeptID uint, codePrefix string) (int, error) {
	var maxNum int
	if err := tx.Raw(GetMaxSarprasSequence, typeID, locDeptID, codePrefix+"-%").Scan(&maxNum).Error; err != nil {
		return 0, fmt.Errorf("gagal mendapatkan nomor urut sarpras: %w", err)
	}
	return maxNum, nil
}

func (h *sarprasQueryHelper) getUserFullName(ctx context.Context, userID uint) (string, error) {
	var name string
	if err := h.db.WithContext(ctx).Raw(GetUserNameByID, userID).Scan(&name).Error; err != nil {
		return "", fmt.Errorf("gagal mengambil nama pengguna: %w", err)
	}
	return name, nil
}
