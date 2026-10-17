-- Kinds of task (how they are proven) someone is not up for, e.g. ["media","location"].
-- Tasks of those kinds cannot be assigned to them; the default is willing to do any.
ALTER TABLE users ADD COLUMN unwilling_task_types TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(unwilling_task_types));
