CREATE TABLE IF NOT EXISTS anade.member_assignments (
  account_id text PRIMARY KEY REFERENCES anade.accounts(id),
  office text NOT NULL DEFAULT '',
  office_state text NOT NULL DEFAULT '',
  functions jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(functions)='array'),
  function_state text NOT NULL DEFAULT '',
  updated_by text NOT NULL REFERENCES anade.accounts(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS anade.assignment_history (
  id uuid PRIMARY KEY,
  actor_id text NOT NULL REFERENCES anade.accounts(id),
  account_id text NOT NULL REFERENCES anade.accounts(id),
  previous jsonb NOT NULL,
  current jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE anade.member_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE anade.assignment_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.member_assignments,anade.assignment_history FROM PUBLIC,anon,authenticated;
-- Não promover cargos autodeclarados em profiles.data a permissões oficiais.
