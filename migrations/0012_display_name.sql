-- A name to use by default when starting or joining a dynamic (it pre-fills the
-- name field). Private to the person: each dynamic still has its own name for
-- them, and partners only ever see that.
ALTER TABLE users ADD COLUMN display_name TEXT;
