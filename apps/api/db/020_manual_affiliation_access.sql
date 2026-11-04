-- Manual grants have an administrator and a reason, without fabricating an
-- application or the account holder's acceptance of legal terms.
ALTER TABLE anade.affiliation_access ALTER COLUMN request_id DROP NOT NULL;
ALTER TABLE anade.affiliation_access ADD COLUMN IF NOT EXISTS changed_by text REFERENCES anade.accounts(id);
ALTER TABLE anade.affiliation_access ADD COLUMN IF NOT EXISTS grant_reason text NOT NULL DEFAULT '';
ALTER TABLE anade.affiliation_access ADD CONSTRAINT affiliation_access_origin
  CHECK (request_id IS NOT NULL OR (changed_by IS NOT NULL AND length(trim(grant_reason)) > 0));
