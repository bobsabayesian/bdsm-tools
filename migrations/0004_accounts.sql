-- Accounts, and the "dynamics" (pairings) between them.
--
-- Privacy: a person can be in many dynamics and the people in them are never
-- told about each other. So partners only ever see the alias a person chose for
-- that dynamic - never their username or user id.

CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT NOT NULL,
  recovery_hash  TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  deleted_at     TEXT
);

-- Login sessions. Only a hash of the cookie's token is stored.
CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX auth_sessions_by_user ON auth_sessions (user_id);

-- Throttling for logins, sign-ups and invite codes
CREATE TABLE rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

CREATE TABLE dynamics (
  id             TEXT PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('pair', 'solo')),
  status         TEXT NOT NULL CHECK (status IN ('invited', 'active', 'paused', 'ended')),
  invite_hash    TEXT UNIQUE,
  invite_expires INTEGER,
  resume_on      TEXT,
  created_at     TEXT NOT NULL,
  ended_at       TEXT
);

CREATE TABLE dynamic_members (
  dynamic_id         TEXT NOT NULL REFERENCES dynamics (id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL REFERENCES users (id),
  role               TEXT NOT NULL CHECK (role IN ('dom', 'sub', 'self')),
  alias              TEXT NOT NULL,
  joined_at          TEXT NOT NULL,
  -- Copied from the user when the dynamic ends, so the other person's
  -- "last active" stops updating once someone has left
  last_active_frozen TEXT,
  PRIMARY KEY (dynamic_id, user_id)
);
CREATE INDEX dynamic_members_by_user ON dynamic_members (user_id);

-- Pauses, resumes and endings, with the optional reason and note
CREATE TABLE dynamic_events (
  id         TEXT PRIMARY KEY,
  dynamic_id TEXT NOT NULL REFERENCES dynamics (id) ON DELETE CASCADE,
  user_id    TEXT REFERENCES users (id), -- NULL when the system did it
  type       TEXT NOT NULL CHECK (type IN ('paused', 'resumed', 'ended')),
  reason     TEXT,
  note       TEXT,
  resume_on  TEXT,
  at         TEXT NOT NULL
);
CREATE INDEX dynamic_events_by_dynamic ON dynamic_events (dynamic_id, at);
