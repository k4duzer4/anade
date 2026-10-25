CREATE TABLE IF NOT EXISTS anade.plenaries (
  meeting_id uuid PRIMARY KEY REFERENCES anade.meetings(id) ON DELETE CASCADE,
  room_key uuid NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS anade.plenary_attendees (
  meeting_id uuid NOT NULL REFERENCES anade.plenaries(meeting_id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES anade.accounts(id),
  first_joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  connected boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  verified_by text REFERENCES anade.accounts(id),
  confirmed_at timestamptz,
  hand_raised boolean NOT NULL DEFAULT false,
  excluded boolean NOT NULL DEFAULT false,
  left_at timestamptz,
  PRIMARY KEY(meeting_id,account_id)
);
CREATE INDEX IF NOT EXISTS plenary_presence ON anade.plenary_attendees(meeting_id,last_seen_at);
ALTER TABLE anade.plenaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE anade.plenary_attendees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON anade.plenaries,anade.plenary_attendees FROM PUBLIC,anon,authenticated;
