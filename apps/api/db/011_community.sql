CREATE TABLE IF NOT EXISTS anade.community_items (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK(kind IN ('proposal','comment','announcement','campaign','timeline')),
  owner_id text NOT NULL REFERENCES anade.accounts(id),
  parent_id uuid REFERENCES anade.community_items(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_kind_created ON anade.community_items(kind,created_at DESC,id);
CREATE INDEX IF NOT EXISTS community_parent ON anade.community_items(parent_id,created_at);
CREATE INDEX IF NOT EXISTS community_owner ON anade.community_items(owner_id,kind);
CREATE UNIQUE INDEX IF NOT EXISTS community_one_campaign ON anade.community_items(owner_id) WHERE kind='campaign';
CREATE TABLE IF NOT EXISTS anade.community_actions (
  item_id uuid NOT NULL REFERENCES anade.community_items(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES anade.accounts(id),
  kind text NOT NULL CHECK(kind IN ('support','read')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(item_id,user_id,kind)
);
CREATE TABLE IF NOT EXISTS anade.portal_settings (
  key text PRIMARY KEY, value jsonb NOT NULL
);
INSERT INTO anade.portal_settings(key,value) VALUES('campaign_open','false') ON CONFLICT DO NOTHING;
ALTER TABLE anade.community_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE anade.community_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE anade.portal_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.community_items,anade.community_actions,anade.portal_settings FROM PUBLIC,anon,authenticated;
