-- Up Migration

ALTER TABLE troupes ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX ON troupes (deleted_at) WHERE deleted_at IS NULL;

-- Down Migration

DROP INDEX IF EXISTS troupes_deleted_at_idx;
ALTER TABLE troupes DROP COLUMN IF EXISTS deleted_at;
