package structs

// RetryItemResponse is returned by POST /usage/:id/retry-item
type RetryItemResponse struct {
	Success         bool                   `json:"success"`
	RetriedItem     int                    `json:"retried_item"`
	NewResultID     uint                   `json:"new_result_id"`
	ResumedFromItem int                    `json:"resumed_from_item"`
	ResultData      map[string]interface{} `json:"result_data"`
	Message         string                 `json:"message"`
}
