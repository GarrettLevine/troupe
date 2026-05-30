# Troupe

A progressive web app for performing arts groups (theatre companies, improv troupes, bands) to coordinate schedules, shows, and membership.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React + TypeScript, Vite, PWA |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL via [Neon](https://neon.tech) (raw SQL, `pg` driver — no ORM) |
| Auth | Firebase Authentication (phone/SMS OTP) |
| Styling | Tailwind CSS (shadcn/ui ready) |
| Monorepo | pnpm workspaces |

---

## Prerequisites

- **Node.js** 18+
- **pnpm** 8+ (`npm install -g pnpm`)
- A **Neon** account with a database provisioned (or a local PostgreSQL 14+ instance for dev)
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

**Database** — use `DATABASE_URL` for Neon (and any hosted environment). Individual `DB_*` vars are supported as a fallback for local dev. `DATABASE_URL` takes precedence if both are set.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Full connection string — e.g. the connection string from the Neon console (`postgresql://user:pass@host/dbname?sslmode=require`) |
| `DB_HOST` | Fallback: database host (default: `localhost`) |
| `DB_PORT` | Fallback: database port (default: `5432`) |
| `DB_NAME` | Fallback: database name |
| `DB_USER` | Fallback: database user |
| `DB_PASSWORD` | Fallback: database password |

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

### 3. Run migrations

```bash
pnpm migrate
```

This applies all pending migrations from `packages/server/db/migrations/` using node-pg-migrate. For local dev, create the database first (`createdb troupe`). For Neon, the database already exists — just run the migrations against it via `DATABASE_URL`.

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

The app deploys to **Google Cloud Run** via GitHub Actions on every push to `main`. The database is hosted on **Neon** — no Cloud SQL or Auth Proxy needed. The workflow runs migrations first — if they fail, the deploy is skipped.

### One-time GCP setup

1. **Enable APIs** in the GCP Console:
   - Cloud Run API
   - Cloud Build API
   - Secret Manager API

2. **Create a service account** (e.g. `troupe-deployer`) with these roles:
   - Cloud Run Admin
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
| `DATABASE_URL` | Neon console → your database → Connection string (e.g. `postgresql://user:pass@host/dbname?sslmode=require`) |

### How the pipeline works

```
push to main
    │
    ▼
[migrate job]
  - Installs server deps
  - Runs pnpm migrate against Neon via DATABASE_URL
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
# Set DATABASE_URL to the Neon connection string, then:
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
