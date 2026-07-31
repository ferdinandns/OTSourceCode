package models

type AddUser struct {
	Nama     string `json:"nama" binding:"required,max=45"`
	NIK      string `json:"nik" binding:"required,max=45"`
	Username string `json:"username" binding:"required,max=45"`
	Area     string `json:"area" binding:"required,max=45"`
	Level    string `json:"level" binding:"required,max=45"`
}

type EditUser struct {
	Nama            string `json:"nama" binding:"max=45"`
	NIK             string `json:"nik" binding:"max=45"`
	Username        string `json:"username" binding:"max=45"`
	Area            string `json:"area" binding:"max=45"`
	Level           string `json:"level" binding:"max=45"`
	OldPassword     string `json:"old_password"`
	NewPassword     string `json:"new_password"`
	ConfirmPassword string `json:"confirm_password"`
}
