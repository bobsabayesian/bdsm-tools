-- The "Me" tab: optional details about who someone is. All optional, never
-- required for anything. Shared with partners like the rest of the profile.
CREATE TABLE user_about (
  user_id    TEXT PRIMARY KEY REFERENCES users (id),
  genders    TEXT NOT NULL DEFAULT '[]', -- keys from the genders catalog
  pronouns   TEXT NOT NULL DEFAULT '[]', -- free text, e.g. ["she/her", "they/them"]
  about      TEXT NOT NULL DEFAULT '',   -- "things my partner should know"
  updated_at TEXT NOT NULL
);
