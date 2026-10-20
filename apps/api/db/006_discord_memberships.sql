CREATE TABLE IF NOT EXISTS anade.discord_memberships (
  guild_id text NOT NULL,
  user_id text NOT NULL,
  roles jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(roles) = 'array'),
  valid_until timestamptz NOT NULL DEFAULT now(),
  retry_at timestamptz,
  PRIMARY KEY (guild_id, user_id)
);
ALTER TABLE anade.discord_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.discord_memberships FROM PUBLIC, anon, authenticated;
