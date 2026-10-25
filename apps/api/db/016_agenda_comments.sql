CREATE TABLE IF NOT EXISTS anade.agenda_comments (
  id uuid PRIMARY KEY,
  meeting_id uuid REFERENCES anade.meetings(id) ON DELETE CASCADE,
  note_id uuid REFERENCES anade.organization_records(id) ON DELETE CASCADE,
  topic text NOT NULL DEFAULT '',
  account_id text NOT NULL REFERENCES anade.accounts(id),
  body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((meeting_id IS NOT NULL AND note_id IS NULL) OR (meeting_id IS NULL AND note_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS agenda_comments_meeting ON anade.agenda_comments(meeting_id,topic,created_at DESC,id);
CREATE INDEX IF NOT EXISTS agenda_comments_note ON anade.agenda_comments(note_id,created_at DESC,id);
ALTER TABLE anade.agenda_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.agenda_comments FROM PUBLIC,anon,authenticated;
