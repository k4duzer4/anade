CREATE TABLE IF NOT EXISTS anade.profile_media (
  account_id text NOT NULL REFERENCES anade.accounts(id),
  kind text NOT NULL CHECK(kind IN ('avatar', 'banner')),
  path text NOT NULL UNIQUE,
  PRIMARY KEY(account_id, kind)
);
ALTER TABLE anade.profile_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.profile_media FROM PUBLIC, anon, authenticated;
