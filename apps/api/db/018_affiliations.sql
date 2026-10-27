CREATE TABLE IF NOT EXISTS anade.affiliation_requests (
  id uuid PRIMARY KEY,
  account_id text NOT NULL REFERENCES anade.accounts(id),
  data jsonb NOT NULL,
  status text NOT NULL CHECK(status IN ('pending','approved','rejected','withdrawn','revoked')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text REFERENCES anade.accounts(id),
  review_note text NOT NULL DEFAULT '',
  deliveries jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS affiliation_one_pending ON anade.affiliation_requests(account_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS affiliation_queue ON anade.affiliation_requests(status,submitted_at);
CREATE TABLE IF NOT EXISTS anade.affiliation_access (
  account_id text PRIMARY KEY REFERENCES anade.accounts(id),
  active boolean NOT NULL,
  request_id uuid NOT NULL REFERENCES anade.affiliation_requests(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE anade.affiliation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE anade.affiliation_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.affiliation_requests,anade.affiliation_access FROM PUBLIC,anon,authenticated;
