package sqlite

import (
	"context"
	"testing"
	"time"

	"github.com/gabehf/koito/internal/db"
)

func TestScopeListens(t *testing.T) {
	cases := []struct {
		name string
		in   string
		ids  []int32
		want string
	}{
		{
			"aliased read",
			"SELECT COUNT(*) FROM listens l WHERE l.track_id = ?",
			[]int32{1, 2},
			"SELECT COUNT(*) FROM (SELECT * FROM listens WHERE user_id IN (1,2)) l WHERE l.track_id = ?",
		},
		{
			"read without alias",
			"SELECT COUNT(*) FROM listens WHERE listened_at BETWEEN ? AND ?",
			[]int32{7},
			"SELECT COUNT(*) FROM (SELECT * FROM listens WHERE user_id IN (7)) WHERE listened_at BETWEEN ? AND ?",
		},
		{
			"join",
			"SELECT 1 FROM tracks t JOIN listens l ON l.track_id = t.id",
			[]int32{3},
			"SELECT 1 FROM tracks t JOIN (SELECT * FROM listens WHERE user_id IN (3)) l ON l.track_id = t.id",
		},
		{
			"no users sees nothing",
			"SELECT COUNT(*) FROM listens",
			nil,
			"SELECT COUNT(*) FROM (SELECT * FROM listens WHERE 0)",
		},
		{
			"insert is not a read",
			"INSERT OR IGNORE INTO listens (track_id) VALUES (?)",
			[]int32{1},
			"INSERT OR IGNORE INTO listens (track_id) VALUES (?)",
		},
		{
			"update is not a read",
			"UPDATE OR IGNORE listens SET track_id = ? WHERE track_id = ?",
			[]int32{1},
			"UPDATE OR IGNORE listens SET track_id = ? WHERE track_id = ?",
		},
		{
			"other tables with listens in the name are untouched",
			"SELECT * FROM listens_archive",
			[]int32{1},
			"SELECT * FROM listens_archive",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := scopeListens(c.in, c.ids); got != c.want {
				t.Errorf("scopeListens()\n got: %s\nwant: %s", got, c.want)
			}
		})
	}
}

// Two users listen to the same track at the same second. Each one must keep
// their own listen, and every read must only see the scoped users' listens.
func TestUserScopedReads(t *testing.T) {
	s, err := NewInMemory()
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	defer s.Close(ctx)

	mustExec := func(q string, args ...any) {
		t.Helper()
		if err := s.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	mustExec(`INSERT INTO users (id, username, role, password) VALUES (1, 'alice', 'admin', x'00'), (2, 'bob', 'user', x'00')`)
	mustExec(`INSERT INTO releases (id) VALUES (1)`)
	mustExec(`INSERT INTO tracks (id, release_id) VALUES (1, 1), (2, 1)`)
	// alice: track 1 twice. bob: track 2 once, and track 1 at the same second as alice.
	mustExec(`INSERT INTO listens (track_id, listened_at, user_id) VALUES (1, 100, 1), (1, 200, 1), (2, 300, 2), (1, 100, 2)`)

	allTime := db.Timeframe{Period: db.PeriodAllTime}
	count := func(c context.Context) int64 {
		t.Helper()
		n, err := s.CountListens(c, allTime)
		if err != nil {
			t.Fatal(err)
		}
		return n
	}

	if got := count(ctx); got != 4 {
		t.Errorf("unscoped: got %d listens, want 4", got)
	}
	if got := count(db.WithUserScope(ctx, 1)); got != 2 {
		t.Errorf("alice: got %d listens, want 2", got)
	}
	if got := count(db.WithUserScope(ctx, 2)); got != 2 {
		t.Errorf("bob: got %d listens, want 2", got)
	}
	if got := count(db.WithUserScope(ctx, 1, 2)); got != 4 {
		t.Errorf("both: got %d listens, want 4", got)
	}
	if got := count(db.WithUserScope(ctx)); got != 0 {
		t.Errorf("nobody: got %d listens, want 0", got)
	}
}

// SaveListen deduplicates per user, and DeleteListen from a scoped context only
// removes that user's listen.
func TestListenWritesArePerUser(t *testing.T) {
	s, err := NewInMemory()
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	defer s.Close(ctx)

	mustExec := func(q string) {
		t.Helper()
		if err := s.Exec(q); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	mustExec(`INSERT INTO users (id, username, role, password) VALUES (1, 'alice', 'admin', x'00'), (2, 'bob', 'user', x'00')`)
	mustExec(`INSERT INTO releases (id) VALUES (1)`)
	mustExec(`INSERT INTO tracks (id, release_id) VALUES (1, 1)`)

	at := time.Unix(1000, 0)
	for _, uid := range []int32{1, 2, 2} { // bob's second submit is a duplicate
		if err := s.SaveListen(ctx, db.SaveListenOpts{TrackID: 1, Time: at, UserID: uid}); err != nil {
			t.Fatal(err)
		}
	}
	n, err := s.Count(`SELECT COUNT(*) FROM listens`)
	if err != nil || n != 2 {
		t.Fatalf("after saves: count = %d (err %v), want 2", n, err)
	}

	// bob deleting the shared timestamp must leave alice's listen alone.
	if err := s.DeleteListen(db.WithUserScope(ctx, 2), 1, at); err != nil {
		t.Fatal(err)
	}
	n, err = s.Count(`SELECT COUNT(*) FROM listens WHERE user_id = 1`)
	if err != nil || n != 1 {
		t.Errorf("alice's listens after bob's delete = %d (err %v), want 1", n, err)
	}
	n, err = s.Count(`SELECT COUNT(*) FROM listens WHERE user_id = 2`)
	if err != nil || n != 0 {
		t.Errorf("bob's listens after his delete = %d (err %v), want 0", n, err)
	}
}
