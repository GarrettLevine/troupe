-- Up Migration

CREATE INDEX ON troupe_members (troupe_id, role);

-- Down Migration

DROP INDEX IF EXISTS troupe_members_troupe_id_role_idx;
