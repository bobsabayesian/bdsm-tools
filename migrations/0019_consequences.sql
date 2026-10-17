-- A consequence is an ordinary task that the person with control chooses to add
-- after marking another task "not done". Nothing adds one automatically.
-- It can wait in a queue (visible to both people) until it is started.
ALTER TABLE assignments ADD COLUMN consequence_for TEXT;
ALTER TABLE assignments ADD COLUMN queued INTEGER NOT NULL DEFAULT 0;
