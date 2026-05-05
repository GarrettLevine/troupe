Add node-pg-migrate to the Troupe project for database schema management.

## Package Setup
- Install node-pg-migrate in packages/server
- Add the following scripts to packages/server/package.json:
  "migrate": "node-pg-migrate up -m db/migrations --dotenv-config-path .env"
  "migrate:down": "node-pg-migrate down -m db/migrations --dotenv-config-path .env"
  "migrate:create": "node-pg-migrate create -m db/migrations"
- node-pg-migrate should use the DATABASE_URL variable from packages/server/.env

## Migration Files
- Delete any existing placeholder SQL files in db/migrations/
- Recreate the initial migration as a proper node-pg-migrate compatible SQL file:
  db/migrations/001_create_users.sql

  The migration must include:

  -- Up migration
  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT UNIQUE NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE OR REPLACE FUNCTION update_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

  -- Down migration
  DROP TRIGGER IF EXISTS users_updated_at ON users;
  DROP FUNCTION IF EXISTS update_updated_at();
  DROP TABLE IF EXISTS users;

## db.ts
- Ensure packages/server/src/db.ts initializes a pg Pool using DATABASE_URL
- Export a query helper function typed as:
  query<T>(text: string, params?: unknown[]): Promise<T[]>
- This wrapper should handle errors consistently and never expose raw pg errors 
  to callers

## CLAUDE.md
Update the Database Migrations section of CLAUDE.md to reflect that 
node-pg-migrate is now installed and configured, including the available 
pnpm scripts and the rule that migrations are always raw SQL.

## Verification
After making all changes, confirm:
1. pnpm migrate runs without error against a local PostgreSQL instance
2. The users table exists with all expected columns
3. pnpm migrate:down cleanly rolls back
4. The updated_at trigger fires correctly on row update