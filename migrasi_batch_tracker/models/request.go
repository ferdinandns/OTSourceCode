package models

type Request struct {
	Id []string `json:"id" binding:"required,min=1"`
	Ket *string `json:"ket"`
}

type NextRequest struct {
	Id []uint `json:"id" binding:"required,min=1"`
	Ket *string `json:"ket"`
}

type TankRequest struct {
	Id []uint `json:"id" binding:"required,min=1"`
	TankID uint `json:"tank_id" binding:"required"`
	Ket *string `json:"ket"`
} 

type TextInputRequest struct {
	Id []uint `json:"id" binding:"required,min=1"`
	Text string `json:"text"`
	Ket *string `json:"ket"`
}

type DeleteRequestPpic struct {
	Id string `json:"id" binding:"required,min=1"`
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Ket *string `json:"keterangan"`
}

type DeleteRequest struct {
	Id uint `json:"id" binding:"required,min=1"`
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Ket *string `json:"keterangan"`
}