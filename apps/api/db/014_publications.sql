CREATE TABLE IF NOT EXISTS anade.daily_publications (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES anade.accounts(id),
  type text NOT NULL CHECK(type IN ('post','materia')),
  title text NOT NULL,
  url text NOT NULL,
  period_start timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,period_start,url)
);
CREATE INDEX IF NOT EXISTS daily_publications_period ON anade.daily_publications(period_start,created_at DESC,id);
ALTER TABLE anade.daily_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.daily_publications FROM PUBLIC,anon,authenticated;
