package domain

import "strings"

type FieldError struct {
	Field 	string
	Message string
}

func (e *FieldError) Error() string {
	return e.Message
}

func NewFieldError(field, message string) *FieldError {
	return &FieldError{
		Field: field,
		Message: message,
	}
}

type FieldErrors []*FieldError

func (e FieldErrors) Error() string {
	msgs := make([]string, len(e))
	for i, fe := range e {
		msgs[i] = fe.Message
	}
	return strings.Join(msgs, "; ")
}