package sqlite

import (
	"context"
	"database/sql"
	"regexp"
	"strconv"
	"strings"

	"github.com/gabehf/koito/internal/db"
)

// listensTable matches a read from the listens table: "FROM listens" or
// "JOIN listens", with or without an alias after it. It is only ever applied
// to queries run through QueryContext and QueryRowContext. Writes go through
// ExecContext, which is never rewritten, so "DELETE FROM listens" is safe.
var listensTable = regexp.MustCompile(`(?i)\b(FROM|JOIN)(\s+)listens\b`)

// userCondition returns an SQL condition that is true only for rows whose
// user_id is one of userIDs, and always false when the list is empty. The ids
// are integers that come from our own database, so they are inlined into the
// SQL rather than bound, which keeps the positional parameters of the original
// query untouched.
func userCondition(userIDs []int32) string {
	if len(userIDs) == 0 {
		return "0"
	}
	ids := make([]string, len(userIDs))
	for i, id := range userIDs {
		ids[i] = strconv.FormatInt(int64(id), 10)
	}
	return "user_id IN (" + strings.Join(ids, ",") + ")"
}

// scopeListens rewrites every read of the listens table in query so that it
// only sees the listens of the given users.
func scopeListens(query string, userIDs []int32) string {
	sub := "(SELECT * FROM listens WHERE " + userCondition(userIDs) + ")"
	return listensTable.ReplaceAllString(query, "${1}${2}"+sub)
}

// scopedDB wraps *sql.DB so that reads made with a user-scoped context (see
// db.WithUserScope) only see the listens of those users. Every other method,
// including Exec and transactions, is the plain *sql.DB one.
type scopedDB struct {
	*sql.DB
}

func (d *scopedDB) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	if ids, ok := db.UserScope(ctx); ok {
		query = scopeListens(query, ids)
	}
	return d.DB.QueryContext(ctx, query, args...)
}

func (d *scopedDB) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	if ids, ok := db.UserScope(ctx); ok {
		query = scopeListens(query, ids)
	}
	return d.DB.QueryRowContext(ctx, query, args...)
}
