-- Kink choices have a side: how someone feels about GIVING something can differ
-- from how they feel about RECEIVING it. Body parts keep an empty direction.
-- (SQLite cannot change a primary key, so the table is rebuilt.)
CREATE TABLE user_selections_new (
  user_id    TEXT NOT NULL REFERENCES users (id),
  catalog    TEXT NOT NULL,
  key        TEXT NOT NULL,
  direction  TEXT NOT NULL DEFAULT '',
  state      TEXT NOT NULL DEFAULT 'yes',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, catalog, key, direction)
);

INSERT INTO user_selections_new (user_id, catalog, key, state, updated_at)
  SELECT user_id, catalog, key, state, updated_at FROM user_selections;

DROP TABLE user_selections;
ALTER TABLE user_selections_new RENAME TO user_selections;
