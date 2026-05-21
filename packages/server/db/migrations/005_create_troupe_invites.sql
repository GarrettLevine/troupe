-- Up Migration

CREATE TABLE troupe_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  troupe_id    UUID NOT NULL REFERENCES troupes(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES users(id),
  code         TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  used_by      UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ON troupe_invites (code);
CREATE INDEX ON troupe_invites (troupe_id, created_at DESC);

-- Down Migration

DROP INDEX IF EXISTS troupe_invites_troupe_id_created_at_idx;
DROP INDEX IF EXISTS troupe_invites_code_idx;
DROP TABLE IF EXISTS troupe_invites;
