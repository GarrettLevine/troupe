-- Up Migration

CREATE TABLE events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  troupe_id  UUID        NOT NULL REFERENCES troupes(id) ON DELETE CASCADE,
  created_by UUID        NOT NULL REFERENCES users(id),
  name       TEXT        NOT NULL,
  event_type TEXT        NOT NULL CHECK (event_type IN ('show', 'rehearsal')),
  event_at   TIMESTAMPTZ NOT NULL,
  location   TEXT        NOT NULL,
  details    TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX events_troupe_event_at ON events (troupe_id, event_at);

-- Down Migration

DROP INDEX IF EXISTS events_troupe_event_at;
DROP TRIGGER IF EXISTS events_updated_at ON events;
DROP TABLE IF EXISTS events;
