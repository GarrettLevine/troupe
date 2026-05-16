-- Up Migration
ALTER TABLE troupes ADD COLUMN has_badge BOOLEAN NOT NULL DEFAULT FALSE;

-- Down Migration
ALTER TABLE troupes DROP COLUMN has_badge;
