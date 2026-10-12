package db

import "context"

type userScopeKey struct{}

// WithUserScope returns a context that restricts every listen-derived read
// (top items, counts, activity, streaks, listen history...) to the listens of
// the given users. Passing no ids scopes to nobody, so the reads return empty
// results rather than falling back to every user.
//
// A context without a scope is unrestricted. That is what background work
// such as imports and exports uses.
func WithUserScope(ctx context.Context, userIDs ...int32) context.Context {
	ids := make([]int32, len(userIDs))
	copy(ids, userIDs)
	return context.WithValue(ctx, userScopeKey{}, ids)
}

// UserScope returns the user ids the context is scoped to. ok is false when
// the context carries no scope, meaning reads are unrestricted.
func UserScope(ctx context.Context) (ids []int32, ok bool) {
	ids, ok = ctx.Value(userScopeKey{}).([]int32)
	return ids, ok
}
