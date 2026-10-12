-- +goose Up
PRAGMA foreign_keys = OFF;

-- Profile visibility, per user:
--   'public'  : anyone, including anonymous visitors
--   'members' : any logged-in user of this instance
--   'private' : the owner (and admins) only
-- Existing users keep today's behavior (visible to everyone).
ALTER TABLE users ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'members', 'private'));

-- listens: the primary key now includes user_id, so two people can listen to
-- the same track in the same second without one listen being dropped.
-- Every existing listen already carries the user_id of the account that
-- submitted it, so no data needs to be reassigned.
CREATE TABLE listens_new (
    track_id    INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    listened_at INTEGER NOT NULL,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client      TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (user_id, track_id, listened_at)
);
INSERT INTO listens_new (track_id, listened_at, user_id, client)
    SELECT track_id, listened_at, user_id, client FROM listens;
DROP TABLE listens;
ALTER TABLE listens_new RENAME TO listens;

CREATE INDEX IF NOT EXISTS idx_listens_listened_at          ON listens(listened_at);
CREATE INDEX IF NOT EXISTS idx_listens_track_id             ON listens(track_id);
CREATE INDEX IF NOT EXISTS idx_listens_track_id_listened_at ON listens(track_id, listened_at);
CREATE INDEX IF NOT EXISTS idx_listens_user_id_listened_at  ON listens(user_id, listened_at);

PRAGMA foreign_keys = ON;

-- +goose Down
-- Not reversible without losing listens that share (track_id, listened_at)
-- across users, so the down migration only drops the visibility column.
ALTER TABLE users DROP COLUMN visibility;
