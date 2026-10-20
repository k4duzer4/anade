CREATE TABLE IF NOT EXISTS anade.directors (
  id uuid PRIMARY KEY,
  member_id text NOT NULL REFERENCES anade.profiles(account_id),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  responsibility text NOT NULL DEFAULT '' CHECK (length(responsibility) <= 500),
  position integer NOT NULL CHECK (position BETWEEN 1 AND 99),
  UNIQUE (member_id, title)
);
ALTER TABLE anade.directors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.directors FROM PUBLIC;
REVOKE ALL ON anade.directors FROM anon, authenticated;
