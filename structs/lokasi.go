package structs

type LokasiResponse struct {
	Id   uint   `json:"id"`
	Nama string `json:"nama"`
	Kode string `json:"kode"`
}

type LokasiCreateRequest struct {
	Nama string `json:"nama" binding:"required"`
	Kode string `json:"kode" binding:"required"`
}
