CREATE TABLE IF NOT EXISTS anade.activity_seen (
  account_id text NOT NULL REFERENCES anade.accounts(id),
  item_key text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,item_key)
);
ALTER TABLE anade.activity_seen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.activity_seen FROM PUBLIC,anon,authenticated;
