package helpers

// Response adalah format standar payload API agar frontend menerima struktur response yang konsisten.
type Response struct {
	Meta Meta        `json:"meta"`
	Data interface{} `json:"data"`
}

// Meta menyimpan metadata response seperti pesan, status code, dan jumlah data.
type Meta struct {
	Message string `json:"message"`
	Code    int    `json:"code"`
	Status  string `json:"status"`
	Count   int64  `json:"count"`
}

// APIResponse membuat response standar untuk endpoint yang tidak memerlukan pagination atau count.
func APIResponse(message string, code int, status string, data interface{}) Response {
	meta := Meta{
		Message: message,
		Code:    code,
		Status:  status,
	}

	jsonResponse := Response{
		Meta: meta,
		Data: data,
	}

	return jsonResponse
}

// APIResponseList membuat response standar untuk endpoint yang mengembalikan daftar data dengan jumlah total.
func APIResponseList(message string, code int, status string, count int64, data interface{}) Response {
	meta := Meta{
		Message: message,
		Code:    code,
		Status:  status,
		Count:   count,
	}

	jsonResponse := Response{
		Meta: meta,
		Data: data,
	}

	return jsonResponse
}
