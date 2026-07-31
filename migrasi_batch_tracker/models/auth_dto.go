package models

import "time"

type User struct {
	ID          	uint 		`gorm:"primaryKey" json:"id"`
	Created_date	time.Time	`gorm:"column:created_date" json:"created_date"`
	Username    	string		`gorm:"column:username" json:"username"`
	Password    	string		`gorm:"column:password" json:"-"`
	Nama 			string		`gorm:"column:nama" json:"nama"`
	Nik 			string		`gorm:"column:nik" json:"nik"`
	Level 			string		`gorm:"column:level" json:"level"`
	Detail_area 	string		`gorm:"-" json:"detail_area"`
	Area 			string		`gorm:"column:area" json:"area"`
	Signature 		string		`gorm:"column:signature" json:"signature"`
	Error_count 	int 		`gorm:"column:error_count" json:"error_count"`
	Status_akun		string		`gorm:"column:status_akun" json:"status_akun"`
	Updated_at 		time.Time 	`gorm:"column:updated_at" json:"updated_at"`
}

type Login struct {
	Username    	string		`gorm:"column:username" json:"username"`
	Password    	string		`gorm:"column:password" json:"password"`
	Area            *string 	`gorm:"column:detail_area" json:"detail_area"`
}

func (User) TableName() string {return "tb_admin_user"}
func (Login) TableName() string {return "tb_admin_user"}
