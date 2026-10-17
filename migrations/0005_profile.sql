-- What each person has chosen to include (body parts now, kinks next).
-- Private to the person: nothing here is shown to anyone in their dynamics.
--
-- `state` is 'yes' for body parts. It exists so kinks can later hold
-- yes / maybe / no (a limit) in the same table.
CREATE TABLE user_selections (
  user_id    TEXT NOT NULL REFERENCES users (id),
  catalog    TEXT NOT NULL,
  key        TEXT NOT NULL,
  state      TEXT NOT NULL DEFAULT 'yes',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, catalog, key)
);

-- Which setup steps a person has finished or skipped, e.g. {"bodyParts":"done"}
ALTER TABLE users ADD COLUMN profile_steps TEXT NOT NULL DEFAULT '{}';

-- Group the body parts so the setup screen is easy to scan
UPDATE docs SET doc = json_set(doc, '$.group', 'Mouth & chest')
  WHERE collection = 'catalog-body-parts' AND json_extract(doc, '$.key') IN ('mouth', 'throat', 'nipples');
UPDATE docs SET doc = json_set(doc, '$.group', 'Back')
  WHERE collection = 'catalog-body-parts' AND json_extract(doc, '$.key') = 'ass';
UPDATE docs SET doc = json_set(doc, '$.group', 'Genitals')
  WHERE collection = 'catalog-body-parts' AND json_extract(doc, '$.key') IN ('pussy', 'penis', 'balls');
UPDATE docs SET doc = json_set(doc, '$.group', 'Other')
  WHERE collection = 'catalog-body-parts' AND json_extract(doc, '$.key') = 'clothing';

-- Quick-start bundles. They only ever ADD to what is ticked, and are named for
-- the parts they contain rather than for a kind of person.
INSERT OR IGNORE INTO docs (collection, id, doc, added, updated) VALUES
('catalog-body-part-presets', 'everything-except-genitals', '{"key":"everything-except-genitals","label":"Everything except genitals","description":"","parts":["mouth","throat","nipples","ass","clothing"],"active":true,"added":"2026-10-17T00:00:00.000Z","updated":"2026-10-17T00:00:00.000Z"}', '2026-10-17T00:00:00.000Z', '2026-10-17T00:00:00.000Z'),
('catalog-body-part-presets', 'penis-and-balls', '{"key":"penis-and-balls","label":"Penis and balls","description":"","parts":["penis","balls"],"active":true,"added":"2026-10-17T00:00:00.000Z","updated":"2026-10-17T00:00:00.000Z"}', '2026-10-17T00:00:00.000Z', '2026-10-17T00:00:00.000Z'),
('catalog-body-part-presets', 'pussy', '{"key":"pussy","label":"Pussy","description":"","parts":["pussy"],"active":true,"added":"2026-10-17T00:00:00.000Z","updated":"2026-10-17T00:00:00.000Z"}', '2026-10-17T00:00:00.000Z', '2026-10-17T00:00:00.000Z');
