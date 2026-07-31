package models

type PpicResponseStep struct {
	SheetPPIC
	LeadTime  *float64 `json:"leadtime" gorm:"column:leadtime"`
	Threshold *int     `json:"threshold" gorm:"column:threshold"`
}

type ResponseStep struct {
	WorkOrders
	LeadTime   *float64 `json:"leadtime" gorm:"column:leadtime"`
	Threshold  *float64 `json:"threshold" gorm:"column:threshold"`
	StatusLead string   `json:"status_lead" gorm:"-"`
}

type TimbangResponseStep struct {
	ResponseStep
	JumlahMaterial   int `json:"jumlah_material" gorm:"-"`
	TotalLabelClosed int `json:"total_label_closed" gorm:"-"`
}