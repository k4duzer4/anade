CREATE TABLE IF NOT EXISTS anade.guest_access (
  account_id text PRIMARY KEY REFERENCES anade.accounts(id),
  enabled boolean NOT NULL,
  changed_by text NOT NULL REFERENCES anade.accounts(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS anade.guest_access_history (
  id uuid PRIMARY KEY,
  account_id text NOT NULL REFERENCES anade.accounts(id),
  actor_id text NOT NULL REFERENCES anade.accounts(id),
  enabled boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE anade.guest_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE anade.guest_access_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.guest_access,anade.guest_access_history FROM PUBLIC,anon,authenticated;
