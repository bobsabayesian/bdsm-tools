-- Within a dynamic both people see each other's full profile (body parts and
-- kinks, limits included). Someone's choices only become visible once they have
-- seen that said - recorded here - so answers given when the screens said
-- "only you can see these" are never shown retroactively.
ALTER TABLE users ADD COLUMN profile_shared_at TEXT;
