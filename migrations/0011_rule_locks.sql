-- How long a rule stays as it is. The person living under the rules sets a
-- minimum number of days (default 7) in their profile; whoever sets a rule says
-- how long until it can be changed, and the longer of the two applies.
ALTER TABLE users ADD COLUMN rule_change_min_days INTEGER NOT NULL DEFAULT 7;

ALTER TABLE dynamic_rules ADD COLUMN locked_until TEXT;
ALTER TABLE dynamic_rules ADD COLUMN lock_days_requested INTEGER;
ALTER TABLE dynamic_rules ADD COLUMN lock_days_applied INTEGER;
