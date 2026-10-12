package models

import "testing"

func TestCanView(t *testing.T) {
	admin := &User{ID: 1, Role: UserRoleAdmin, Visibility: VisibilityPublic}
	alice := &User{ID: 2, Role: UserRoleUser, Visibility: VisibilityMembers}
	bob := &User{ID: 3, Role: UserRoleUser, Visibility: VisibilityPrivate}
	carol := &User{ID: 4, Role: UserRoleUser, Visibility: VisibilityPublic}

	cases := []struct {
		name   string
		viewer *User
		owner  *User
		want   bool
	}{
		{"anonymous sees public", nil, carol, true},
		{"anonymous cannot see members-only", nil, alice, false},
		{"anonymous cannot see private", nil, bob, false},
		{"member sees public", alice, carol, true},
		{"member sees members-only", carol, alice, true},
		{"member cannot see another private profile", alice, bob, false},
		{"owner sees their own private profile", bob, bob, true},
		{"admin sees a private profile", admin, bob, true},
		{"admin sees a members-only profile", admin, alice, true},
		{"nobody sees a missing user", admin, nil, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := CanView(c.viewer, c.owner); got != c.want {
				t.Errorf("CanView() = %v, want %v", got, c.want)
			}
		})
	}
}

func TestVisibilityValid(t *testing.T) {
	for _, v := range []Visibility{VisibilityPublic, VisibilityMembers, VisibilityPrivate} {
		if !v.Valid() {
			t.Errorf("%q should be valid", v)
		}
	}
	for _, v := range []Visibility{"", "friends", "PUBLIC"} {
		if v.Valid() {
			t.Errorf("%q should be invalid", v)
		}
	}
}
