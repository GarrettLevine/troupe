-- Up Migration

CREATE TABLE troupes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  created_by UUID        NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER troupes_updated_at
  BEFORE UPDATE ON troupes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE troupe_members (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  troupe_id UUID        NOT NULL REFERENCES troupes(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT        NOT NULL CHECK (role IN ('owner', 'organizer', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (troupe_id, user_id)
);

CREATE UNIQUE INDEX one_owner_per_troupe ON troupe_members (troupe_id) WHERE role = 'owner';

-- Down Migration

DROP INDEX IF EXISTS one_owner_per_troupe;
DROP TABLE IF EXISTS troupe_members;
DROP TRIGGER IF EXISTS troupes_updated_at ON troupes;
DROP TABLE IF EXISTS troupes;
