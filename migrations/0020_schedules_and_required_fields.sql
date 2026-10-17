-- Repeating tasks. A schedule makes one assignment per matching day, created
-- the first time anyone opens the dynamic's tasks that day (no background job,
-- and nothing piles up while nobody is looking: missed days are not backfilled).
CREATE TABLE task_schedules (
  id                       TEXT PRIMARY KEY,
  dynamic_id               TEXT NOT NULL REFERENCES dynamics (id) ON DELETE CASCADE,
  created_by               TEXT NOT NULL REFERENCES users (id),
  assigned_to              TEXT NOT NULL REFERENCES users (id),
  task                     TEXT NOT NULL CHECK (json_valid(task)),
  attested_soft_limits     TEXT NOT NULL DEFAULT '[]',
  requires_review          INTEGER NOT NULL DEFAULT 0,
  retention_days_requested INTEGER,
  frequency                TEXT NOT NULL CHECK (frequency IN ('daily', 'weekdays', 'weekly')),
  weekday                  INTEGER,           -- 0 (Sunday) to 6, for weekly
  start_date               TEXT NOT NULL,     -- the creator's local date, YYYY-MM-DD
  end_date                 TEXT,              -- inclusive; null: no end
  tz_offset                INTEGER NOT NULL,  -- minutes, as JavaScript's getTimezoneOffset()
  due_end_of_day           INTEGER NOT NULL DEFAULT 0,
  last_date                TEXT,              -- the last local date it was made for
  note                     TEXT,              -- why the latest occurrence was skipped, if it was
  status                   TEXT NOT NULL CHECK (status IN ('active', 'stopped')),
  created_at               TEXT NOT NULL
);
CREATE INDEX task_schedules_by_dynamic ON task_schedules (dynamic_id, status);

ALTER TABLE assignments ADD COLUMN schedule_id TEXT;

-- Parts of a task the person doing it requires to be filled in before it can be
-- assigned to them, from ["guardrails", "kinks", "due"].
ALTER TABLE users ADD COLUMN required_task_fields TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(required_task_fields));
