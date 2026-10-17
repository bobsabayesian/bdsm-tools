-- Tasks assigned within a dynamic, the dynamic's rules, and comments on both.
-- Only members of a dynamic can ever see these (and not once it has ended).

CREATE TABLE assignments (
  id                    TEXT PRIMARY KEY,
  dynamic_id            TEXT NOT NULL REFERENCES dynamics (id) ON DELETE CASCADE,
  assigned_by           TEXT NOT NULL REFERENCES users (id),
  assigned_to           TEXT NOT NULL REFERENCES users (id),
  template_id           TEXT,  -- the library task it came from, if any
  task                  TEXT NOT NULL CHECK (json_valid(task)), -- a copy, so later edits never rewrite history
  status                TEXT NOT NULL CHECK (status IN ('pending', 'submitted', 'done', 'not-done', 'cancelled')),
  requires_review       INTEGER NOT NULL DEFAULT 0,
  due_at                TEXT,
  -- soft limits the assigner attested they had talked about, as [{key, direction}]
  attested_soft_limits  TEXT NOT NULL DEFAULT '[]',
  started_at            TEXT,  -- when a timer task was started
  response              TEXT,
  feedback              TEXT,
  created_at            TEXT NOT NULL,
  submitted_at          TEXT,
  completed_at          TEXT,
  reviewed_at           TEXT
);
CREATE INDEX assignments_by_dynamic ON assignments (dynamic_id, created_at);

CREATE TABLE dynamic_rules (
  id          TEXT PRIMARY KEY,
  dynamic_id  TEXT NOT NULL REFERENCES dynamics (id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('active', 'retired')),
  created_by  TEXT NOT NULL REFERENCES users (id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  -- when the person making or changing the rule attested they had discussed it
  -- with their partner (always set in a pair; not asked in solo mode)
  attested_at TEXT
);
CREATE INDEX dynamic_rules_by_dynamic ON dynamic_rules (dynamic_id, created_at);

CREATE TABLE dynamic_comments (
  id          TEXT PRIMARY KEY,
  dynamic_id  TEXT NOT NULL REFERENCES dynamics (id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('rule', 'assignment')),
  target_id   TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users (id),
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX dynamic_comments_by_target ON dynamic_comments (target_type, target_id, created_at);
