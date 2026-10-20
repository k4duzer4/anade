CREATE SCHEMA IF NOT EXISTS anade;
CREATE TABLE IF NOT EXISTS anade.accounts (
  id text PRIMARY KEY,
  username text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS anade.profiles (
  account_id text PRIMARY KEY REFERENCES anade.accounts(id),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS anade.meetings (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  location text NOT NULL,
  agenda jsonb NOT NULL,
  minutes text NOT NULL DEFAULT '',
  author_id text NOT NULL REFERENCES anade.accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS anade.attendance (
  meeting_id uuid NOT NULL REFERENCES anade.meetings(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES anade.accounts(id),
  PRIMARY KEY (meeting_id, account_id)
);
CREATE TABLE IF NOT EXISTS anade.polls (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  deadline timestamptz NOT NULL,
  secret boolean NOT NULL DEFAULT true,
  closed boolean NOT NULL DEFAULT false,
  author_id text NOT NULL REFERENCES anade.accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS anade.poll_options (
  poll_id uuid NOT NULL REFERENCES anade.polls(id) ON DELETE CASCADE,
  option_index integer NOT NULL CONSTRAINT poll_options_option_index_check CHECK (option_index >= 0 AND option_index < 10),
  label text NOT NULL,
  PRIMARY KEY (poll_id, option_index),
  UNIQUE (poll_id, label)
);
CREATE TABLE IF NOT EXISTS anade.votes (
  poll_id uuid NOT NULL,
  account_id text NOT NULL REFERENCES anade.accounts(id),
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, account_id),
  FOREIGN KEY (poll_id, option_index) REFERENCES anade.poll_options(poll_id, option_index)
);
CREATE TABLE IF NOT EXISTS anade.session (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expire_idx ON anade.session(expire);
CREATE INDEX IF NOT EXISTS meetings_starts_at_idx ON anade.meetings(starts_at);
CREATE INDEX IF NOT EXISTS polls_deadline_idx ON anade.polls(deadline);
