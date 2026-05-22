-- Up Migration
ALTER TABLE events ADD COLUMN call_time_offset INTEGER;
ALTER TABLE events ADD COLUMN duration_minutes INTEGER;
ALTER TABLE events ADD COLUMN status TEXT NOT NULL DEFAULT 'scheduled'
  CHECK (status IN ('scheduled', 'cancelled'));
ALTER TABLE events ADD COLUMN deleted_at TIMESTAMPTZ;

-- Down Migration
ALTER TABLE events DROP COLUMN call_time_offset;
ALTER TABLE events DROP COLUMN duration_minutes;
ALTER TABLE events DROP COLUMN status;
ALTER TABLE events DROP COLUMN deleted_at;
