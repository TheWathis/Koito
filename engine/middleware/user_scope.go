package middleware

import (
	"net/http"
	"strings"

	"github.com/gabehf/koito/internal/db"
	"github.com/gabehf/koito/internal/logger"
	"github.com/gabehf/koito/internal/models"
	"github.com/gabehf/koito/internal/utils"
)

// ScopeUser limits everything that reads listening data to the user(s) the
// request asks for, after checking that the viewer is allowed to see them.
//
// The "user" query parameter selects whose data to show:
//   - omitted: the viewer's own data. An anonymous visitor gets the first
//     admin's data, which keeps single-user instances working as before.
//   - a username: that user's data.
//   - "all": the combined data of every user the viewer is allowed to see.
//
// A user the viewer may not see is reported as not found, so private profiles
// cannot be discovered by guessing usernames.
func ScopeUser(store db.UserStore) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			l := logger.FromContext(ctx)
			viewer := GetUserFromContext(ctx)
			target := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("user")))

			var ids []int32
			switch target {
			case "all":
				users, err := store.ListUsers(ctx)
				if err != nil {
					l.Err(err).Msg("ScopeUser: failed to list users")
					utils.WriteError(w, "internal server error", http.StatusInternalServerError)
					return
				}
				for _, u := range users {
					if models.CanView(viewer, u) {
						ids = append(ids, u.ID)
					}
				}

			case "":
				owner := viewer
				if owner == nil {
					var err error
					owner, err = store.GetAdminUser(ctx)
					if err != nil {
						l.Err(err).Msg("ScopeUser: failed to get default user")
						utils.WriteError(w, "internal server error", http.StatusInternalServerError)
						return
					}
				}
				if owner != nil && !models.CanView(viewer, owner) {
					// Only reachable by an anonymous visitor when the default
					// profile is not public: ask them to log in.
					utils.WriteError(w, "unauthorized", http.StatusUnauthorized)
					return
				}
				if owner != nil {
					ids = []int32{owner.ID}
				}

			default:
				owner, err := store.GetUserByUsername(ctx, target)
				if err != nil {
					l.Err(err).Msg("ScopeUser: failed to get user")
					utils.WriteError(w, "internal server error", http.StatusInternalServerError)
					return
				}
				if owner == nil || !models.CanView(viewer, owner) {
					utils.WriteError(w, "user not found", http.StatusNotFound)
					return
				}
				ids = []int32{owner.ID}
			}

			next.ServeHTTP(w, r.WithContext(db.WithUserScope(ctx, ids...)))
		})
	}
}

// ScopeSelf limits reads and writes of listens to the authenticated user's own
// listens. It is meant for routes that modify listening data.
func ScopeSelf(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromContext(r.Context())
		if user == nil {
			utils.WriteError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(db.WithUserScope(r.Context(), user.ID)))
	})
}

// RequireAdmin only lets admins through. Merging and deleting artists, albums
// and tracks changes the catalog every user shares, so those routes use it.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromContext(r.Context())
		if user == nil {
			utils.WriteError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if user.Role != models.UserRoleAdmin {
			utils.WriteError(w, "this action is reserved to admins", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
