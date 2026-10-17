-- Who may sign up, and the one-time codes the site owner hands out.
-- Codes are never stored: only their SHA-256 hash, like recovery codes.

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- 'invite' (needs a code), 'open', or 'closed'. A new install starts closed to
-- strangers: nobody can sign up without a code until the owner says otherwise.
INSERT INTO settings (key, value) VALUES ('signup_mode', 'invite');

CREATE TABLE invite_codes (
  id         TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL UNIQUE,
  note       TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  used_at    TEXT,
  used_by    TEXT
);

-- A code the owner makes for one account after checking it really is them
CREATE TABLE reset_codes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL UNIQUE,
  note       TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);
CREATE INDEX reset_codes_by_user ON reset_codes (user_id);

-- A plain record of things that matter for account safety
CREATE TABLE account_events (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type    TEXT NOT NULL,   -- 'password-reset'
  detail  TEXT,            -- e.g. 'recovery code', 'reset code from the site owner'
  at      TEXT NOT NULL
);
CREATE INDEX account_events_by_time ON account_events (at);
