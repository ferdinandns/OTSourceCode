package response

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/go-playground/validator/v10"
	"emertrack/internal/domain"
)

type CommonResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

const ContentType = "Content-Type"
const appjson = "application/json"

func SuccessMessage(w http.ResponseWriter, message string) {
	w.Header().Set(ContentType, appjson)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(CommonResponse{
		Success: true,
		Message: message,
	})
}

// --------------------------------

func JSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set(ContentType, appjson)
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(APIResponse{
		Success: code < 400,
		Data:    data,
	})
}

func Success(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusOK, data)
}

func Created(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusCreated, data)
}

func Error(w http.ResponseWriter, code int, message string) {
	w.Header().Set(ContentType, appjson)
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(APIResponse{
		Success: false,
		Error:   message,
	})
}

func BadRequest(w http.ResponseWriter, message interface{}) {
	w.Header().Set(ContentType, appjson)
	w.WriteHeader(http.StatusBadRequest)

	res := map[string]any{
		"success": false,
		"error":   message,
	}

	json.NewEncoder(w).Encode(res)
}

func Unauthorized(w http.ResponseWriter) {
	Error(w, http.StatusUnauthorized, "unauthorized")
}

func Forbidden(w http.ResponseWriter) {
	Error(w, http.StatusForbidden, "Forbidden")
}

func NotFound(w http.ResponseWriter, message string) {
	Error(w, http.StatusNotFound, message)
}

func InternalError(w http.ResponseWriter) {
	Error(w, http.StatusInternalServerError, "Internal Server Error")
}

func ValidationError(w http.ResponseWriter, err error) bool {
	var ve validator.ValidationErrors
	if errors.As(err, &ve) {
		errMsgs := []string{}
		for _, fe := range ve {
			switch fe.Tag() {
			case "required":
				errMsgs = append(errMsgs, fmt.Sprintf("Kolom %s wajib diisi", fe.Field()))
			case "numeric":
				errMsgs = append(errMsgs, fmt.Sprintf("Kolom %s harus berupa angka", fe.Field()))
			default:
				errMsgs = append(errMsgs, fmt.Sprintf("Kolom %s tidak valid", fe.Field()))
			}
		}
		BadRequest(w, errMsgs)
		return true
	}
	return false
}

func FieldValidationError(w http.ResponseWriter, err error) bool {
	var fe *domain.FieldError
	if errors.As(err, &fe) {
		writeFieldErrors(w, map[string]string{
			fe.Field: fe.Message,
		})
		return true
	}

	var fes domain.FieldErrors
	if errors.As(err, &fes) {
		fieldMap := make(map[string]string, len(fes))
		for _, e := range fes {
			fieldMap[e.Field] = e.Message
		}
		writeFieldErrors(w, fieldMap)
		return true
	}
	return false
}


func writeFieldErrors(w http.ResponseWriter, fields map[string]string) {
	w.Header().Set(ContentType, appjson)
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(map[string]any {
		"success": false,
		"errors": fields,
	})
}