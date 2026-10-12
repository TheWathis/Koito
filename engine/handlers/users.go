package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gabehf/koito/engine/middleware"
	"github.com/gabehf/koito/internal/db"
	"github.com/gabehf/koito/internal/logger"
	"github.com/gabehf/koito/internal/memkv"
	"github.com/gabehf/koito/internal/models"
	"github.com/gabehf/koito/internal/utils"
)

// ListUsersHandler returns the users the viewer is allowed to see. It feeds the
// user switcher of the web UI.
func ListUsersHandler(store db.UserStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		l := logger.FromContext(ctx)
		viewer := middleware.GetUserFromContext(ctx)

		users, err := store.ListUsers(ctx)
		if err != nil {
			l.Err(err).Msg("ListUsersHandler: Failed to list users")
			utils.WriteError(w, "failed to list users", http.StatusInternalServerError)
			return
		}

		visible := make([]*models.User, 0, len(users))
		for _, u := range users {
			if models.CanView(viewer, u) {
				visible = append(visible, u)
			}
		}
		utils.WriteJSON(w, http.StatusOK, visible)
	}
}

type createUserResponse struct {
	User   *models.User   `json:"user"`
	ApiKey *models.ApiKey `json:"api_key"`
}

// CreateUserHandler lets an admin add a family member. The new user gets a
// first API key, which is what Multi-Scrobbler (or any ListenBrainz client)
// uses to submit that person's listens.
func CreateUserHandler(store db.UserStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		l := logger.FromContext(ctx)

		body, err := utils.DecodeBody[struct {
			Username   string `json:"username"`
			Password   string `json:"password"`
			Role       string `json:"role"`
			Visibility string `json:"visibility"`
		}](r)
		if err != nil || body.Username == "" || body.Password == "" {
			utils.WriteError(w, "username and password are required", http.StatusBadRequest)
			return
		}

		role := models.UserRole(body.Role)
		if role == "" {
			role = models.UserRoleUser
		}
		if role != models.UserRoleUser && role != models.UserRoleAdmin {
			utils.WriteError(w, "role must be 'user' or 'admin'", http.StatusBadRequest)
			return
		}

		// New accounts default to members-only: a family member's listening
		// history is not shown to anonymous visitors unless they choose so.
		visibility := models.Visibility(body.Visibility)
		if visibility == "" {
			visibility = models.VisibilityMembers
		}
		if !visibility.Valid() {
			utils.WriteError(w, "visibility must be 'public', 'members' or 'private'", http.StatusBadRequest)
			return
		}

		existing, err := store.GetUserByUsername(ctx, body.Username)
		if err != nil {
			l.Err(err).Msg("CreateUserHandler: Failed to check for an existing user")
			utils.WriteError(w, "internal server error", http.StatusInternalServerError)
			return
		}
		if existing != nil {
			utils.WriteError(w, "username is already taken", http.StatusConflict)
			return
		}

		user, err := store.SaveUser(ctx, db.SaveUserOpts{
			Username:   body.Username,
			Password:   body.Password,
			Role:       role,
			Visibility: visibility,
		})
		if err != nil {
			l.Err(err).Msg("CreateUserHandler: Failed to save user")
			// SaveUser reports rule violations (length, characters) before it
			// touches the database; anything that reached the insert is ours.
			if strings.Contains(err.Error(), "insert") {
				utils.WriteError(w, "failed to create user", http.StatusInternalServerError)
			} else {
				utils.WriteError(w, "invalid username or password", http.StatusBadRequest)
			}
			return
		}

		token, err := utils.GenerateRandomString(48)
		if err != nil {
			l.Err(err).Msg("CreateUserHandler: Failed to generate API key")
			utils.WriteError(w, "failed to generate api key", http.StatusInternalServerError)
			return
		}
		key, err := store.SaveApiKey(ctx, db.SaveApiKeyOpts{
			Key:    token,
			UserID: user.ID,
			Label:  "Default",
		})
		if err != nil {
			l.Err(err).Msg("CreateUserHandler: Failed to save API key")
			utils.WriteError(w, "user created, but failed to save api key", http.StatusInternalServerError)
			return
		}

		l.Debug().Msgf("CreateUserHandler: Created user %d", user.ID)
		utils.WriteJSON(w, http.StatusCreated, createUserResponse{User: user, ApiKey: key})
	}
}

// DeleteUserHandler lets an admin remove a user together with their listens,
// sessions and API keys.
func DeleteUserHandler(store db.UserStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		l := logger.FromContext(ctx)
		admin := middleware.GetUserFromContext(ctx)

		id, err := utils.ParseIDParam(r, "id")
		if err != nil {
			utils.WriteError(w, "invalid id", http.StatusBadRequest)
			return
		}
		// Only admins reach this handler, so refusing self-deletion also
		// guarantees the instance keeps at least one admin.
		if admin != nil && admin.ID == int32(id) {
			utils.WriteError(w, "you cannot delete your own account", http.StatusBadRequest)
			return
		}

		target, err := store.GetUserByID(ctx, int32(id))
		if err != nil {
			l.Err(err).Msg("DeleteUserHandler: Failed to get user")
			utils.WriteError(w, "internal server error", http.StatusInternalServerError)
			return
		}
		if target == nil {
			utils.WriteError(w, "user not found", http.StatusNotFound)
			return
		}

		if err := store.DeleteUser(ctx, target.ID); err != nil {
			l.Err(err).Msg("DeleteUserHandler: Failed to delete user")
			utils.WriteError(w, "failed to delete user", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// FamilyMember is one line of the family overview.
type FamilyMember struct {
	User           *models.User   `json:"user"`
	ListensAllTime int64          `json:"listens_all_time"`
	ListensWeek    int64          `json:"listens_week"`
	MinutesWeek    int64          `json:"minutes_week"`
	TopArtistWeek  *models.Artist `json:"top_artist_week,omitempty"`
	NowPlaying     *models.Track  `json:"now_playing,omitempty"`
}

type familyStore interface {
	db.UserStore
	db.ListenStore
	db.ArtistStore
	db.TrackStore
}

// FamilyHandler returns an overview of every user the viewer is allowed to see:
// how much each of them listened to, their top artist this week and what they
// are playing right now.
func FamilyHandler(store familyStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		l := logger.FromContext(ctx)
		viewer := middleware.GetUserFromContext(ctx)

		users, err := store.ListUsers(ctx)
		if err != nil {
			l.Err(err).Msg("FamilyHandler: Failed to list users")
			utils.WriteError(w, "failed to list users", http.StatusInternalServerError)
			return
		}

		allTime := db.Timeframe{Period: db.PeriodAllTime}
		week := db.Timeframe{Period: db.PeriodWeek}

		members := make([]FamilyMember, 0, len(users))
		for _, u := range users {
			if !models.CanView(viewer, u) {
				continue
			}
			// Every query for this member only sees their own listens.
			uctx := db.WithUserScope(ctx, u.ID)
			m := FamilyMember{User: u}

			if m.ListensAllTime, err = store.CountListens(uctx, allTime); err != nil {
				l.Err(err).Msg("FamilyHandler: Failed to count listens")
				utils.WriteError(w, "failed to build family overview", http.StatusInternalServerError)
				return
			}
			if m.ListensWeek, err = store.CountListens(uctx, week); err != nil {
				l.Err(err).Msg("FamilyHandler: Failed to count weekly listens")
				utils.WriteError(w, "failed to build family overview", http.StatusInternalServerError)
				return
			}
			seconds, err := store.CountTimeListened(uctx, week)
			if err != nil {
				l.Err(err).Msg("FamilyHandler: Failed to count time listened")
				utils.WriteError(w, "failed to build family overview", http.StatusInternalServerError)
				return
			}
			m.MinutesWeek = seconds / 60

			if m.ListensWeek > 0 {
				top, err := store.GetTopArtistsPaginated(uctx, db.GetItemsOpts{Limit: 1, Page: 1, Timeframe: week})
				if err != nil {
					l.Err(err).Msg("FamilyHandler: Failed to get top artist")
					utils.WriteError(w, "failed to build family overview", http.StatusInternalServerError)
					return
				}
				if top != nil && len(top.Items) > 0 {
					m.TopArtistWeek = top.Items[0].Item
				}
			}

			if trackID, ok := memkv.Store.Get(strconv.Itoa(int(u.ID))); ok {
				if id, ok := trackID.(int32); ok {
					if track, err := store.GetTrack(ctx, db.GetTrackOpts{ID: id}); err == nil {
						m.NowPlaying = track
					}
				}
			}

			members = append(members, m)
		}

		utils.WriteJSON(w, http.StatusOK, members)
	}
}
