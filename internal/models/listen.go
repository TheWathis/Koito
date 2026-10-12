package models

import (
	"time"
)

// a Listen is the same thing as a 'scrobble' but i despise the word scrobble so i will not use it
type Listen struct {
	Time  time.Time   `json:"time"`
	Track SimpleTrack `json:"track"`
	// User is the username of whoever listened.
	User string `json:"user,omitempty"`
}
