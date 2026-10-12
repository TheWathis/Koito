package handlers

import (
	"net/http"
	"strconv"

	"github.com/gabehf/koito/internal/db"
	"github.com/gabehf/koito/internal/logger"
	"github.com/gabehf/koito/internal/memkv"
	"github.com/gabehf/koito/internal/models"
	"github.com/gabehf/koito/internal/utils"
)

type NowPlayingResponse struct {
	CurrentlyPlaying bool         `json:"currently_playing"`
	Track            models.Track `json:"track"`
}

func NowPlayingHandler(store db.TrackStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		l := logger.FromContext(ctx)

		l.Debug().Msg("NowPlayingHandler: Got request")

		// Now playing is tracked per user, so it is only shown when the request is
		// scoped to exactly one user (not for the combined "all" view).
		ids, _ := db.UserScope(ctx)
		if len(ids) != 1 {
			utils.WriteJSON(w, http.StatusOK, NowPlayingResponse{CurrentlyPlaying: false})
			return
		}
		if trackIdI, ok := memkv.Store.Get(strconv.Itoa(int(ids[0]))); !ok {
			utils.WriteJSON(w, http.StatusOK, NowPlayingResponse{CurrentlyPlaying: false})
		} else if trackId, ok := trackIdI.(int32); !ok {
			l.Debug().Msg("NowPlayingHandler: Failed type assertion for trackIdI")
			utils.WriteError(w, "internal server error", http.StatusInternalServerError)
		} else {
			track, err := store.GetTrack(ctx, db.GetTrackOpts{ID: trackId})
			if err != nil {
				l.Error().Err(err).Msg("NowPlayingHandler: Failed to get track from database")
				utils.WriteError(w, "failed to fetch currently playing track from database", http.StatusInternalServerError)
			} else {
				utils.WriteJSON(w, http.StatusOK, NowPlayingResponse{CurrentlyPlaying: true, Track: *track})
			}
		}
	}
}
