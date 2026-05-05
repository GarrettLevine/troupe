# Troupe

A progressive web app for performing arts groups (theatre companies, improv troupes, bands) to coordinate schedules, shows, and membership.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React + TypeScript, Vite, PWA |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL (raw SQL, `pg` driver — no ORM) |
| Auth | Firebase Authentication (phone/SMS OTP) |
| Styling | Tailwind CSS (shadcn/ui ready) |
| Monorepo | pnpm workspaces |

---

## Prerequisites

- **Node.js** 18+
- **pnpm** 8+ (`npm install -g pnpm`)
- **PostgreSQL** 14+
- A **Firebase project** with Phone authentication enabled

---

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

**Server:**
```bash
cp packages/server/.env.example packages/server/.env
```

**Database** — use individual variables for local dev, or `DATABASE_URL` for hosted environments (Railway, Heroku, etc.). `DATABASE_URL` takes precedence if both are set.

| Variable | Description |
|----------|-------------|
| `DB_HOST` | Database host (default: `localhost`) |
| `DB_PORT` | Database port (default: `5432`) |
| `DB_NAME` | Database name (e.g. `troupe`) |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `DATABASE_URL` | Full connection string — overrides the individual `DB_*` vars if set |

**Firebase & server:**

| Variable | Description |
|----------|-------------|
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email from the Admin SDK credentials JSON |
| `FIREBASE_PRIVATE_KEY` | Private key from the service account JSON (newlines as `\n`, wrapped in quotes) |
| `PORT` | Server port (default: `3001`) |

**Client:**
```bash
cp packages/client/.env.example packages/client/.env
```

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase web app API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | e.g. `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | e.g. `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |

### 3. Create the database and run migrations

```bash
createdb troupe
pnpm migrate
```

This applies all pending migrations from `packages/server/db/migrations/` using node-pg-migrate.

### 4. Firebase setup

1. Go to the [Firebase Console](https://console.firebase.google.com) and create or open your project.
2. Navigate to **Authentication → Sign-in method** and enable **Phone**.
3. Navigate to **Project Settings → General → Your apps** and add a **Web app**. Copy the config values into `packages/client/.env`.
4. Navigate to **Project Settings → Service Accounts → Generate new private key**. Copy `project_id`, `client_email`, and `private_key` into `packages/server/.env`. The private key must have literal `\n` for newlines and be wrapped in double quotes.

### 5. Run in development

```bash
pnpm dev
```

- Client → http://localhost:5173  
- Server → http://localhost:3001

---

## Firebase Auth Emulator (local testing without SMS)

The Firebase Auth Emulator lets you test the full phone auth flow locally without burning real SMS messages.

### Install the Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### Initialize emulators

Run from the project root:

```bash
firebase init emulators
```

Select **Authentication**. Accept the default port (`9099`). This creates `firebase.json` and `.firebaserc`.

### Start the emulator

```bash
firebase emulators:start --only auth
```

The emulator UI is available at http://localhost:4000.

### Wire the client to the emulator

In `packages/client/src/lib/firebase.ts`, add after `export const auth = getAuth(app)`:

```typescript
import { connectAuthEmulator } from 'firebase/auth';

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://localhost:9099');
}
```

### Wire the server to the emulator

In `packages/server/src/firebase.ts`, add before `admin.initializeApp(...)`:

```typescript
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
```

### Test phone numbers

With the emulator running, use any phone number — Firebase accepts OTP code `123456` automatically. You can also configure specific test numbers in the emulator UI.

---

## Project Structure

```
troupe/
├── packages/
│   ├── client/                   # React PWA (Vite)
│   │   ├── public/icons/         # App icons (SVG placeholder)
│   │   └── src/
│   │       ├── lib/firebase.ts   # Firebase client init
│   │       ├── contexts/         # AuthContext
│   │       ├── components/       # ProtectedRoute
│   │       └── pages/            # Login, Home
│   └── server/                   # Express API
│       ├── db/migrations/        # node-pg-migrate SQL files
│       └── src/
│           ├── db.ts             # pg Pool + query<T> helper
│           ├── firebase.ts       # Firebase Admin init
│           ├── types.ts          # DbUser + Express augmentation
│           ├── middleware/       # requireAuth
│           └── routes/           # auth (sync), me
├── .eslintrc.cjs
├── .prettierrc
├── package.json                  # root scripts + shared devDeps
└── pnpm-workspace.yaml
```

---

## Database Migrations

Migrations are managed with [node-pg-migrate](https://github.com/salsita/node-pg-migrate) and live in `packages/server/db/migrations/`. All migration files are plain SQL.

| Script | What it does |
|--------|-------------|
| `pnpm migrate` | Apply all pending migrations |
| `pnpm migrate:down` | Roll back the most recent migration |
| `pnpm --filter server migrate:create <name>` | Scaffold a new numbered migration file |

Migration files use `-- Up Migration` / `-- Down Migration` section headers:

```sql
-- Up Migration
CREATE TABLE example (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- Down Migration
DROP TABLE IF EXISTS example;
```

node-pg-migrate tracks applied migrations in a `pgmigrations` table it creates automatically. `DATABASE_URL` is read from `packages/server/.env`.

---

## PWA Icons

`packages/client/public/icons/icon.svg` is a placeholder. For production, replace it with proper PNG icons:

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

Then update the `icons` array in `packages/client/vite.config.ts` to reference the PNG files with their correct `sizes` and `type: 'image/png'`.

---

## Deployment

The app deploys to **Google Cloud Run** via GitHub Actions on every push to `main`. The workflow runs migrations first — if they fail, the deploy is skipped.

### One-time GCP setup

1. **Enable APIs** in the GCP Console:
   - Cloud Run API
   - Cloud SQL Admin API
   - Cloud Build API
   - Secret Manager API

2. **Create a service account** (e.g. `troupe-deployer`) with these roles:
   - Cloud Run Admin
   - Cloud SQL Client
   - Secret Manager Secret Accessor
   - Service Account User

3. **Download the service account JSON key** — you'll add it as a GitHub secret.

4. **Connect Cloud Run to the GitHub repo** in the GCP Console under Cloud Run → your service → Source. This enables source-based deployments via Cloud Build (no manual Docker build needed).

### One-time GitHub setup

Add these repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Where to find it |
|--------|-----------------|
| `GCP_SA_KEY` | The full JSON content of the downloaded service account key |
| `GCP_PROJECT_ID` | GCP Console → project selector (e.g. `troupe-prod-123`) |
| `DATABASE_URL` | Cloud SQL connection string via Auth Proxy Unix socket, e.g. `postgresql://user:pass@/troupe?host=/tmp/cloudsql/project:region:instance` |
| `CLOUD_SQL_INSTANCE_CONNECTION_NAME` | Cloud SQL Console → instance details → Connection name (e.g. `project:us-central1:troupe-db`) |

### How the pipeline works

```
push to main
    │
    ▼
[migrate job]
  - Installs server deps
  - Starts Cloud SQL Auth Proxy (secure tunnel to Cloud SQL)
  - Runs pnpm migrate (applies pending SQL migrations)
    │
    ├── FAIL → pipeline stops, deploy is skipped
    │
    ▼
[deploy job]
  - Deploys to Cloud Run via source deployment (Cloud Build builds the image)
```

A failed migration **always blocks the deploy**. This prevents the window where live code references a column that doesn't exist yet.

To manually roll back a migration after a bad deploy:

```bash
# Locally, pointing at the production database via the Cloud SQL Auth Proxy
pnpm migrate:down
```

### Multi-phase migration strategy for breaking changes

Never rename or drop a column in a single migration — deployed code will reference the old column name while the migration runs, causing errors. Always split breaking changes across three PRs:

**PR 1 — Add:** add the new column alongside the old one
```sql
ALTER TABLE users ADD COLUMN new_col TEXT;
```

**PR 2 — Migrate:** update all application code to use the new column; backfill existing rows
```sql
UPDATE users SET new_col = old_col WHERE new_col IS NULL;
```

**PR 3 — Cleanup:** once PR 2 is stable in production, drop the old column
```sql
ALTER TABLE users DROP COLUMN old_col;
```

This eliminates the risk window where live code references a column that no longer exists.

---

## Auth Architecture

- **Phone number is never stored** in the database. Firebase is the sole source of truth.
- `firebase_uid` is always taken from the **verified server-side token** — never trusted from the request body.
- The `POST /api/auth/sync` endpoint upserts the user record on every login and is idempotent.
- The `requireAuth` middleware verifies the Firebase ID token and attaches `req.user` (the PostgreSQL row) to every protected request.
