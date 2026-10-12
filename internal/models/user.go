package models

import (
	"time"

	"github.com/google/uuid"
)

type UserRole string

const (
	UserRoleUser  UserRole = "user"
	UserRoleAdmin UserRole = "admin"
)

// Visibility controls who can see a user's listening data.
type Visibility string

const (
	// VisibilityPublic: anyone, including anonymous visitors.
	VisibilityPublic Visibility = "public"
	// VisibilityMembers: any logged-in user of this instance.
	VisibilityMembers Visibility = "members"
	// VisibilityPrivate: the owner and admins only.
	VisibilityPrivate Visibility = "private"
)

func (v Visibility) Valid() bool {
	switch v {
	case VisibilityPublic, VisibilityMembers, VisibilityPrivate:
		return true
	}
	return false
}

type User struct {
	ID         int32      `json:"id"`
	Username   string     `json:"username"`
	Role       UserRole   `json:"role"` // 'admin' | 'user'
	Visibility Visibility `json:"visibility"`
	Password   []byte     `json:"-"`
}

// CanView reports whether viewer (nil for an anonymous visitor) may see the
// listening data of owner.
func CanView(viewer *User, owner *User) bool {
	if owner == nil {
		return false
	}
	if viewer != nil && (viewer.ID == owner.ID || viewer.Role == UserRoleAdmin) {
		return true
	}
	switch owner.Visibility {
	case VisibilityPublic:
		return true
	case VisibilityMembers:
		return viewer != nil
	default:
		return false
	}
}

type ApiKey struct {
	ID        int32     `json:"id"`
	Key       string    `json:"key"`
	Label     string    `json:"label"`
	UserID    int32     `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Session struct {
	ID         uuid.UUID
	UserID     int32
	CreatedAt  time.Time
	ExpiresAt  time.Time
	Persistent bool
}
