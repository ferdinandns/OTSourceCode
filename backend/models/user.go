package models

import "time"

type User struct {
	ID              int       `json:"id" db:"id"`
	Name            string    `json:"name" db:"name"`
	Email           string    `json:"email" db:"email"`
	Password        string    `json:"password,omitempty" db:"password"`
	PasswordEncoded string    `json:"passwordEncoded,omitempty" db:"password_encoded"`
	Division        string    `json:"division" db:"division"`
	CreatedAt       time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time `json:"updatedAt" db:"updated_at"`
}

type UserResponse struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	Email           string `json:"email"`
	Division        string `json:"division"`
	PasswordEncoded string `json:"passwordEncoded"`
	CreatedAt       string `json:"createdAt"`
	UpdatedAt       string `json:"updatedAt"`
}

type CreateUserRequest struct {
	Name            string `json:"name" binding:"required"`
	Email           string `json:"email" binding:"required,email"`
	Password        string `json:"password" binding:"required"`
	PasswordEncoded string `json:"passwordEncoded" binding:"required"`
	Division        string `json:"division" binding:"required"`
}

type UpdateUserRequest struct {
	Name            string `json:"name" binding:"required"`
	Email           string `json:"email" binding:"required,email"`
	Password        string `json:"password"`
	PasswordEncoded string `json:"passwordEncoded"`
	Division        string `json:"division" binding:"required"`
}
