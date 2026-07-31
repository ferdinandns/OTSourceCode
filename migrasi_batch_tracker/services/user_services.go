package services

import (
	"errors"
	"fmt"
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/models"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
)

func GetUserListService(db *gorm.DB, area string, level string) ([]models.User, int64, error) {
	var records []models.User

	query := db.Table("tb_admin_user").Select("*")

	if area != "Administrator" && area != "" {
		query = query.Where("status_akun != ?", "inactive")
		query = query.Where("area = ?", area)
	}

	if err := query.Find(&records).Error; err != nil {
		return nil, 0, err
	}

	idsByArea := make(map[string][]uint) // Sesuaikan tipe data ID kamu (uint/int)
	for _, user := range records {
		if user.Area != "" {
			idsByArea[user.Area] = append(idsByArea[user.Area], user.ID) // Asumsi field ID bernama 'ID'
		}
	}

	detailMap := make(map[string]string)

	for areaKey, ids := range idsByArea {
		tableName, found := mapTableName[areaKey]
		if found && len(ids) > 0 {
			// Struct sementara untuk menampung hasil query detail
			var details []struct {
				ID         uint   `gorm:"column:id"`
				DetailArea string `gorm:"column:detail_area"`
			}

			// Query ke tabel detail yang bersangkutan (misal: tb_detail_area_produksi)
			db.Table(tableName).Select("id, detail_area").Where("id IN ?", ids).Find(&details)

			// Masukkan hasil ke map
			for _, d := range details {
				key := fmt.Sprintf("%d-%s", d.ID, areaKey)
				detailMap[key] = d.DetailArea
			}
		}
	}

	// Masukkan kembali detail_area ke dalam struct records utama
	for i := range records {
		key := fmt.Sprintf("%d-%s", records[i].ID, records[i].Area)
		if detailAreaVal, ok := detailMap[key]; ok {
			records[i].Detail_area = detailAreaVal
		} else {
			records[i].Detail_area = "" // Beri string kosong jika tidak ditemukan
		}
	}

	total := int64(len(records))
	return records, total, nil
}

func CreateUserService(db *gorm.DB, req models.AddUser) error {
	return db.Transaction(func(tx *gorm.DB) error {
		hashedPw, err := helpers.HashPassword("Bintang7!@#")
		if err != nil {
			return err
		}

		var nowTime = time.Now().Truncate(time.Second)

		newUser := models.User{
			Created_date: nowTime,
			Nama:         req.Nama,
			Nik:          req.NIK,
			Username:     req.Username,
			Password:     hashedPw,
			Area:         req.Area,
			Level:        req.Level,
			Signature:    "",
			Error_count:  0,
			Status_akun:  "active",
		}

		if err := tx.Create(&newUser).Error; err != nil {
			return err
		}

		if tableName, found := mapTableName[req.Area]; found {
			dataDetail := map[string]any{
				"id":          newUser.ID,
				"nama":        req.Nama,
				"level":       req.Level,
				"area":        req.Area,
				"detail_area": nil,
				"updated_at":  nowTime,
				"updated_by":  nil,
				"sync_date":   nowTime,
			}
			if err := tx.Table(tableName).Create(dataDetail).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

func EditUserService(db *gorm.DB, req models.EditUser, idCaller, idTarget uint, nama, area, level, alamatIP string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var nowTime = time.Now().Truncate(time.Second)

		var auditTrail []models.AuditTrail
		var dataUser models.User

		if err := tx.Where("id = ?", idTarget).Find(&dataUser).Error; err != nil {
			return err
		}

		if idCaller != idTarget {
			if level != "administrator" {
				return errors.New("Anda tidak diizinkan mengedit akun!")
			}
		}

		var hashedNew string
		var err error

		if req.NewPassword != "" || req.ConfirmPassword != "" {
			if req.OldPassword == "" {
				return errors.New("Password lama harus diisi!")
			}
			if !helpers.CheckPassword(req.OldPassword, dataUser.Password) {
				return errors.New("Password lama tidak cocok")
			}
			if req.NewPassword != req.ConfirmPassword {
				return errors.New("Konfirmasi password tidak cocok")
			}

			if len(req.NewPassword) < 8 {
				return errors.New("Password minimal 8 karakter")
			}
			hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(req.NewPassword)
			hasSymbol := regexp.MustCompile(`[^a-zA-Z0-9]`).MatchString(req.NewPassword)
			if !hasUpper || !hasSymbol {
				return errors.New("Password harus mengandung huruf besar dan simbol")
			}

			hashedNew, err = helpers.HashPassword(req.NewPassword)

			if err != nil {
				return err
			}
		}

		query := tx.Model(&models.User{}).Where("id = ?", idTarget)

		if level == "administrator" {
			updateData := map[string]any{
				"nama":       req.Nama,
				"nik":        req.NIK,
				"username":   req.Username,
				"level":      req.Level,
				"area":       req.Area,
				"updated_at": nowTime,
			}
			if hashedNew != "" {
				updateData["password"] = hashedNew
			}
			query = query.Updates(updateData)
		} else {
			updateData := map[string]any{
				"nama":       req.Nama,
				"username":   req.Username,
				"updated_at": nowTime,
			}
			if hashedNew != "" {
				updateData["password"] = hashedNew
			}
			query = query.Updates(updateData)
		}

		if query.RowsAffected == 0 {
			return errors.New("Gagal memperbarui data atau tidak ada perubahan")
		}

		auditTrail = append(auditTrail, models.AuditTrail{
			Tanggal:  nowTime,
			Jam:      time.Now().Format("15:04:05"),
			AlamatIP: alamatIP,
			Nama:     nama,
			Area:     area,
			Kegiatan: nama + " melakukan perubahan data user dengan id " + strconv.Itoa(int(idTarget)),
		})
		if err := tx.Create(&auditTrail).Error; err != nil {
			return err
		}

		return nil
	})
}

func DeleteUserService(db *gorm.DB, id uint) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var nowTime = time.Now().Truncate(time.Second)

		var dataUser models.User

		if err := tx.Where("id = ?", id).Find(&dataUser).Error; err != nil {
			return err
		}

		result := tx.Model(&models.User{}).
			Where("id = ?", id).
			Updates(map[string]any{
				"nik":         "0",
				"nama":        dataUser.Nama,
				"username":    "-",
				"password":    "",
				"level":       "",
				"area":        "",
				"status_akun": "inactive",
				"error_count": 0,
				"updated_at":  nowTime,
			})
		if result.RowsAffected == 0 {
			return result.Error
		}

		return nil
	})
}

func ResetPasswordUserService(db *gorm.DB, req models.EditUser, idCaller, idTarget uint, level string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var dataUser models.User
		if err := tx.Where("id = ?", idTarget).Find(&dataUser).Error; err != nil {
			return err
		}

		if idCaller != idTarget {
			if level != "administrator" {
				return errors.New("Anda tidak diizinkan mengedit akun!")
			}
		}

		query := tx.Model(&models.User{}).Where("id = ?", idTarget)

		hashedPw, err := helpers.HashPassword("Bintang7!@#")
		if err != nil {
			return err
		}

		query = query.Updates(models.User{
			Password: hashedPw,
		})
		if query.RowsAffected == 0 {
			return query.Error
		}

		return nil
	})
}

var mapTableName = map[string]string{
	"Production":        "tb_detail_area_produksi",
	"Warehouse":         "tb_detail_area_warehouse",
	"PPIC":              "tb_detail_area_ppic",
	"Quality Assurance": "tb_detail_area_qa",
	"Quality Control":   "tb_detail_area_qc",
}

func DetailAreaService(db *gorm.DB, userId int, areaName string, areaDetail ...string) bool {
	tableName, found := mapTableName[areaName]

	if !found || len(areaDetail) == 0 {
		return false
	}

	var count int64
	err := db.Table(tableName).
		Where("id = ? AND detail_area IN ?", userId, areaDetail).
		Count(&count).Error

	if err != nil {
		return false
	}

	return count > 0
}

// user_services.go
func UpdateDetailAreaService(db *gorm.DB, idTarget int, req models.Login, idCaller uint, callerLevel string, caller models.User, ipAddress string) error {
	// Admin tidak perlu re-auth (JWT sudah cukup). Manager/supervisor tetap wajib.
	if callerLevel != "administrator" {
		var activeUser models.User
		if err := db.Where("id = ?", idCaller).First(&activeUser).Error; err != nil {
			return errors.New("Sesi tidak valid, silakan login ulang!")
		}
		if !strings.EqualFold(activeUser.Username, req.Username) {
			return errors.New("Username atau password salah!")
		}
		if !helpers.CheckPassword(req.Password, activeUser.Password) {
			return errors.New("Username atau password salah!")
		}
	}

	var targetUser models.User
	if err := db.Where("id = ?", idTarget).First(&targetUser).Error; err != nil {
		return errors.New("User yang akan diubah tidak ditemukan")
	}

	tableName, found := mapTableName[targetUser.Area]
	if !found {
		return errors.New("Department user ini tidak memiliki tabel detail area")
	}

	if err := db.Table(tableName).Where("id = ?", idTarget).Updates(map[string]interface{}{
		"detail_area": req.Area,
		"updated_by":  caller.Nama,
		"updated_at":  time.Now(),
	}).Error; err != nil {
		return err
	}

	detailArea := ""
	if req.Area != nil {
		detailArea = *req.Area
	}
	kegiatan := caller.Nama + " mengubah detail area user ID " + strconv.Itoa(idTarget) + " menjadi " + detailArea

	db.Table("tb_admin_audit_trail").Create(map[string]interface{}{
		"tanggal":   time.Now().Format("2006-01-02"),
		"jam":       time.Now().Format("15:04:05"),
		"alamat_ip": ipAddress,
		"nama":      caller.Nama,
		"area":      caller.Area,
		"kegiatan":  kegiatan,
	})

	return nil
}