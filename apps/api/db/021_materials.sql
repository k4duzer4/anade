CREATE TABLE IF NOT EXISTS anade.materials (
  id uuid PRIMARY KEY,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 140),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1500),
  category text NOT NULL CHECK (category IN ('logos','panfletos','redes','apresentacoes','outros')),
  file_name text NOT NULL,
  file_path text NOT NULL UNIQUE,
  mime text NOT NULL CHECK (mime IN ('image/png','image/jpeg','image/webp','application/pdf')),
  bytes integer NOT NULL CHECK (bytes BETWEEN 1 AND 4194304),
  author_id text NOT NULL REFERENCES anade.accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS materials_created ON anade.materials(created_at DESC,id);
CREATE INDEX IF NOT EXISTS materials_category ON anade.materials(category,created_at DESC,id);
ALTER TABLE anade.materials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.materials FROM PUBLIC,anon,authenticated;
