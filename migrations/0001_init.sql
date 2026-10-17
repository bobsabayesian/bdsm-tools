-- Every "collection" (tasks, feature flags, catalogs, negotiations, ...) lives
-- in one table as a JSON document. This keeps the Worker simple and makes
-- moving data over from Mongo/Firestore a straight copy.
CREATE TABLE docs (
  collection TEXT NOT NULL,
  id         TEXT NOT NULL,
  doc        TEXT NOT NULL CHECK (json_valid(doc)),
  added      TEXT NOT NULL,
  updated    TEXT NOT NULL,
  PRIMARY KEY (collection, id)
);

CREATE INDEX docs_by_added ON docs (collection, added);

-- Catalog items have a unique, human-readable `key` within their collection
CREATE UNIQUE INDEX docs_unique_key
  ON docs (collection, json_extract(doc, '$.key'))
  WHERE json_extract(doc, '$.key') IS NOT NULL;

-- Usage statistics, e.g. 'taskSuccess' or 'tasks.fail.<taskId>.standard'
CREATE TABLE counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

-- Anonymous visitor sessions (points, streaks, completed tasks)
CREATE TABLE sessions (
  id      TEXT PRIMARY KEY,
  data    TEXT NOT NULL,
  expires INTEGER NOT NULL
);

CREATE INDEX sessions_by_expiry ON sessions (expires);
