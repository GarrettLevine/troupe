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

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/troupe` |
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

### 3. Create the database

```bash
createdb troupe
psql troupe -f db/migrations/001_initial.sql
```

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
├── db/
│   └── migrations/
│       └── 001_initial.sql       # users table
├── packages/
│   ├── client/                   # React PWA (Vite)
│   │   ├── public/icons/         # App icons (SVG placeholder)
│   │   └── src/
│   │       ├── lib/firebase.ts   # Firebase client init
│   │       ├── contexts/         # AuthContext
│   │       ├── components/       # ProtectedRoute
│   │       └── pages/            # Login, Home
│   └── server/                   # Express API
│       └── src/
│           ├── db.ts             # pg Pool
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

## PWA Icons

`packages/client/public/icons/icon.svg` is a placeholder. For production, replace it with proper PNG icons:

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

Then update the `icons` array in `packages/client/vite.config.ts` to reference the PNG files with their correct `sizes` and `type: 'image/png'`.

---

## Auth Architecture

- **Phone number is never stored** in the database. Firebase is the sole source of truth.
- `firebase_uid` is always taken from the **verified server-side token** — never trusted from the request body.
- The `POST /api/auth/sync` endpoint upserts the user record on every login and is idempotent.
- The `requireAuth` middleware verifies the Firebase ID token and attaches `req.user` (the PostgreSQL row) to every protected request.
