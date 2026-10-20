ALTER TABLE anade.meetings ADD COLUMN IF NOT EXISTS meet_url text NOT NULL DEFAULT '';
ALTER TABLE anade.meetings ADD COLUMN IF NOT EXISTS minutes_document_url text NOT NULL DEFAULT '';
