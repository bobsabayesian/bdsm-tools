-- How long the person doing a task lets their partner see what they submitted,
-- per kind of proof ({"photo": 14, ...}; anything not listed uses the default).
ALTER TABLE users ADD COLUMN data_retention TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(data_retention));
-- The policy in force when a task was assigned, copied so later changes only
-- affect new tasks (like the task text itself).
ALTER TABLE assignments ADD COLUMN retention_days INTEGER;
