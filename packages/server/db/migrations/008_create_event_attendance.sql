-- Up Migration

CREATE TABLE event_attendance (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL CHECK (status IN ('attending', 'not_attending', 'maybe', 'late')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX ON event_attendance (event_id, status);

CREATE TRIGGER update_event_attendance_updated_at
  BEFORE UPDATE ON event_attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Down Migration

DROP TABLE IF EXISTS event_attendance;
