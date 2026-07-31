package master

import (
	"context"
	"emertrack/internal/domain"

	"gorm.io/gorm"
)

type masterRepository struct {
	db *gorm.DB
}

func NewMasterRepository(db *gorm.DB) domain.MasterRepository {
	return &masterRepository{db: db}
}

func (r *masterRepository) CreateSite(ctx context.Context, s *domain.Site) error {
	return r.db.WithContext(ctx).Create(s).Error
}

func (r *masterRepository) UpdateSite(ctx context.Context, s *domain.Site) error {
	return r.db.WithContext(ctx).Save(s).Error
}

func (r *masterRepository) DeleteSite(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&domain.Site{}, id).Error
}

func (r *masterRepository) FindByIdSite(ctx context.Context, id uint) (*domain.Site, error) {
	var s domain.Site
	return &s, r.db.WithContext(ctx).First(&s, id).Error
}

func (r *masterRepository) FindByCodeSite(ctx context.Context, code string) (*domain.Site, error) {
	var s domain.Site
	err := r.db.WithContext(ctx).Where("code = ?", code).First(&s).Error

	if err != nil {
		return nil, err
	}

	return &s, nil
}

func (r *masterRepository) ListSite(ctx context.Context, filter map[string]interface{}) ([]domain.Site, error) {
	var sites []domain.Site
	var args []interface{}
	query := ListSites 

	if v, ok := filter["search"]; ok {
		query += SearchCodeName_Sites
		keyword := "%" + v.(string) + "%"
		args = append(args, keyword, keyword)
	}
	query += " ORDER BY code "

	err := r.db.WithContext(ctx).Raw(query, args...).Scan(&sites).Error
	return sites, err
}

func (r *masterRepository) CreateDepartment(ctx context.Context, d *domain.Department) error {
	return r.db.WithContext(ctx).Create(d).Error
}

func (r *masterRepository) UpdateDepartment(ctx context.Context, d *domain.Department) error {
	return r.db.WithContext(ctx).Save(d).Error
}

func (r *masterRepository) DeleteDepartment(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&domain.Department{}, id).Error
}

func (r *masterRepository) FindByIdDepartment(ctx context.Context, id uint) (*domain.Department, error) {
	var d domain.Department
	return &d, r.db.WithContext(ctx).First(&d, id).Error
}

func (r *masterRepository) FindByCodeDepartment(ctx context.Context, code string) (*domain.Department, error) {
	var d domain.Department
	err := r.db.WithContext(ctx).Where("code = ?", code).First(&d).Error

	if err != nil {
		return nil, err
	}

	return &d, nil
}

func (r *masterRepository) ListDepartment(ctx context.Context, filter map[string]interface{}) ([]domain.DepartmentRow, error) {
	var deps []domain.DepartmentRow
	var args []interface{}
	query := ListDepartments

	if v, ok := filter["site_id"]; ok {
		query += " AND d.site_id = ?"
		args = append(args, v)
	}

	if v, ok := filter["search"]; ok {
		query += SearchCodeName_Departments
		keyword := "%" + v.(string) + "%"
		args = append(args, keyword, keyword)
	}

	query += " ORDER BY department_code"

	err := r.db.WithContext(ctx).Raw(query, args...).Scan(&deps).Error
	return deps, err
}

func (r *masterRepository) CreateGenericTx(tx *gorm.DB, entity interface{}) error {
	return tx.Omit("PICDept").Create(entity).Error
}

func (r *masterRepository) UpdateGenericTx(tx *gorm.DB, id uint, entity interface{}) error {
	return tx.Model(entity).Where("id = ?", id).Omit("PICDept", "Parameters").Updates(entity).Error
}

func (r *masterRepository) DeleteGenericTx(tx *gorm.DB, entity interface{}, id uint) error {
	return tx.Delete(entity, id).Error
}

func (r *masterRepository) CheckDepartmentReferences(ctx context.Context, id uint) (*domain.DepartmentReferences, error) {
	refs := &domain.DepartmentReferences{}

	// Count users in this department (excluding soft-deleted)
	if err := r.db.WithContext(ctx).Model(&domain.User{}).
		Where("department_id = ?", id).
		Count(&refs.Users).Error; err != nil {
		return nil, err
	}

	// Count sarpras types with this department as PIC
	if err := r.db.WithContext(ctx).Model(&domain.SarprasType{}).
		Where("pic_dept_id = ?", id).
		Count(&refs.SarprasTypes).Error; err != nil {
		return nil, err
	}

	// Count sarpras located in this department
	if err := r.db.WithContext(ctx).Model(&domain.Sarpras{}).
		Where("location_dept_id = ?", id).
		Count(&refs.Sarpras).Error; err != nil {
		return nil, err
	}

	return refs, nil
}

func (r *masterRepository) CheckSiteReferences(ctx context.Context, id uint) (*domain.SiteReferences, error) {
	refs := &domain.SiteReferences{}

	// Count users in this site
	if err := r.db.WithContext(ctx).Model(&domain.User{}).
		Where("site_id = ?", id).
		Count(&refs.Users).Error; err != nil {
		return nil, err
	}

	// Count departments in this site (excluding soft-deleted)
	if err := r.db.WithContext(ctx).Model(&domain.Department{}).
		Where("site_id = ?", id).
		Count(&refs.Departments).Error; err != nil {
		return nil, err
	}

	// Count sarpras at this site
	if err := r.db.WithContext(ctx).Model(&domain.Sarpras{}).
		Where("site_id = ?", id).
		Count(&refs.Sarpras).Error; err != nil {
		return nil, err
	}

	return refs, nil
}
