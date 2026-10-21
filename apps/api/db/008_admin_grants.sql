CREATE TABLE IF NOT EXISTS anade.admin_grants (
  id uuid PRIMARY KEY,
  actor_id text NOT NULL REFERENCES anade.accounts(id),
  target_id text NOT NULL REFERENCES anade.accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE anade.admin_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.admin_grants FROM PUBLIC, anon, authenticated;
