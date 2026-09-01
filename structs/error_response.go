package structs

type ErrorResponse struct {
	Status  string      `json:"status"`
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Errors  interface{} `json:"errors,omitempty"`
	Details interface{} `json:"details,omitempty"`
}
