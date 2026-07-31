package models

type LabelBiruResult struct {
	KodeProduk string
	BatchNo    string
	FirstTime  string
}

type NotFoundBatch struct {
	KodeProduk string   `json:"kode_produk"`
	BatchNo    string   `json:"batch_no"`
	Expanded   []string `json:"expanded"`
	Missing    []string `json:"missing"`
}

type TimbangResponse struct {
	NotFoundBatches []NotFoundBatch `json:"not_found_batches"`
	TotalLabels     int             `json:"total_labels"`
}
