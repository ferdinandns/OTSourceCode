package helpers

import (
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"
)

// ValidRoles mirrors structs.ValidRoles to avoid import cycle
var validRoles = []string{
	"superadmin",
	"administrator",
	"andev_manager",
	"qcts_manager",
	"qa_manager",
	"qc_supervisor",
	"andev_supervisor",
	"qa_supervisor",
	"ts_supervisor",
	"qc_analyst_mikro",
	"qc_analyst_rm",
	"qc_analyst_pm",
	"qc_analyst_oj_stabtest",
	"qc_analyst_ehm",
	"qc_analyst_ipc",
	"andev_staff",
	"qa_staff",
	"ts_staff",
	"user",
}

// ValidateRole returns an error if the role is not in the allowed list
func ValidateRole(role string) error {
	for _, r := range validRoles {
		if role == r {
			return nil
		}
	}
	return fmt.Errorf("role must be one of: %s", strings.Join(validRoles, ", "))
}

// TranslateErrorMessage handles validator.v10 and GORM errors
func TranslateErrorMessage(err error) map[string]string {
	errorsMap := make(map[string]string)

	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		for _, fieldError := range validationErrors {
			field := fieldError.Field()
			switch fieldError.Tag() {
			case "required":
				errorsMap[field] = fmt.Sprintf("%s is required", field)
			case "email":
				errorsMap[field] = "Invalid email format"
			case "unique":
				errorsMap[field] = fmt.Sprintf("%s already exists", field)
			case "min":
				errorsMap[field] = fmt.Sprintf("%s must be at least %s characters", field, fieldError.Param())
			case "max":
				errorsMap[field] = fmt.Sprintf("%s must be at most %s characters", field, fieldError.Param())
			case "numeric":
				errorsMap[field] = fmt.Sprintf("%s must be a number", field)
			default:
				errorsMap[field] = "Invalid value"
			}
		}
	}

	if err != nil {
		errMsg := strings.ToLower(err.Error())

		if strings.Contains(errMsg, "duplicate key") || strings.Contains(errMsg, "violates unique constraint") {
			if strings.Contains(errMsg, "username") || strings.Contains(errMsg, "uni_users_username") {
				errorsMap["Username"] = "Username already exists"
			}
			if strings.Contains(errMsg, "email") || strings.Contains(errMsg, "uni_users_email") {
				errorsMap["Email"] = "Email already exists"
			}
			if len(errorsMap) == 0 {
				errorsMap["General"] = "Data already exists"
			}
		}

		if strings.Contains(errMsg, "duplicate entry") {
			if strings.Contains(errMsg, "username") {
				errorsMap["Username"] = "Username already exists"
			}
			if strings.Contains(errMsg, "email") {
				errorsMap["Email"] = "Email already exists"
			}
			if len(errorsMap) == 0 {
				errorsMap["General"] = "Data already exists"
			}
		}

		if err == gorm.ErrRecordNotFound {
			errorsMap["Error"] = "Record not found"
		}
	}

	return errorsMap
}

func IsDuplicateEntryError(err error) bool {
	if err == nil {
		return false
	}
	errMsg := strings.ToLower(err.Error())
	return strings.Contains(errMsg, "duplicate key") ||
		strings.Contains(errMsg, "violates unique constraint") ||
		strings.Contains(errMsg, "duplicate entry")
}
