CREATE TABLE IF NOT EXISTS anade.checkins (
  id uuid PRIMARY KEY,
  account_id text NOT NULL REFERENCES anade.accounts(id),
  day date NOT NULL,
  created_at timestamptz NOT NULL,
  office text NOT NULL DEFAULT '',
  character_name text NOT NULL,
  discord_username text NOT NULL,
  blue text NOT NULL DEFAULT '',
  actions_path text NOT NULL UNIQUE,
  blue_path text NOT NULL UNIQUE,
  UNIQUE(account_id, day),
  CHECK(length(office) <= 120)
);
CREATE INDEX IF NOT EXISTS checkins_day_created_idx ON anade.checkins(day DESC, created_at DESC);
ALTER TABLE anade.checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.checkins FROM PUBLIC, anon, authenticated;
