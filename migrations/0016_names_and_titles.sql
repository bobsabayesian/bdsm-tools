-- A person in a dynamic has a NAME (Zak, or Sara without an H) and a TITLE (Sir,
-- kitten). The title was already stored as `alias`; this adds the name. Rows from
-- before this have no name and show their title instead.
ALTER TABLE dynamic_members ADD COLUMN name TEXT;
