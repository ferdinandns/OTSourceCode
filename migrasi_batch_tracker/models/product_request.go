package models

// SyncTankRequest menampung payload untuk edit mixing tank produk
type SyncTankRequest struct {
	ConfirmUsername string `json:"confirm_username" binding:"required"`
	ConfirmPassword string `json:"confirm_password" binding:"required"`
	MixingTankIDs   []uint `json:"mixing_tank_id" binding:"required,min=1"`
}

// UpdateAutoRilisRequest menampung payload untuk edit auto rilis
type UpdateAutoRilisRequest struct {
	ProduksiAutoRilis string `json:"produksi_auto_rilis" binding:"required,oneof=Ya Tidak"`
	ConfirmUsername   string `json:"confirm_username" binding:"required"`
	ConfirmPassword   string `json:"confirm_password" binding:"required"`
}

// UpdateStatusRequest menampung payload untuk edit status produk (listing/delisting)
type UpdateStatusRequest struct {
	Status                string `json:"status" binding:"required,oneof=listing delisting"`
	ConfirmUsernameStatus string `json:"confirm_username_status" binding:"required"`
	ConfirmPasswordStatus string `json:"confirm_password_status" binding:"required"`
}