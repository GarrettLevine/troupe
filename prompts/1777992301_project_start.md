You are bootstrapping "Troupe", a progressive web app (PWA) for performing arts groups 
(theatre companies, improv troupes, bands) to coordinate schedules, shows, and membership.

## Tech Stack
- **Frontend**: React + TypeScript (Vite), PWA-ready (manifest + service worker)
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with raw SQL (pg driver) — no ORM
- **Auth**: Firebase Authentication (phone number / SMS OTP)
- **Styling**: shadcn/ui + Tailwind CSS
- **Monorepo**: pnpm workspaces with packages/client and packages/server

---

## Phase 1 Goal
Build the foundation: phone auth flow + authenticated home page. Nothing else yet.

---

## Project Structure

troupe/
├── packages/
│   ├── client/         # React PWA (Vite)
│   └── server/         # Express API
├── pnpm-workspace.yaml
├── package.json
└── README.md

---

## Database
Set up PostgreSQL. Create a db/migrations/ folder with a 001_initial.sql migration that creates:

users table:
  - id (UUID, PK, default gen_random_uuid())
  - display_name (text)
  - firebase_uid (text, unique, not null)
  - created_at (timestamptz, default now())
  - updated_at (timestamptz, default now())

Do NOT store phone_number — Firebase is the sole source of truth for phone numbers.
If phone number is ever needed in app logic, read it from the verified Firebase ID token
(decodedToken.phone_number) at request time.

---

## Backend (packages/server)

Set up an Express + TypeScript server with:

1. A db.ts module using the `pg` Pool, configured via environment variables
2. Firebase Admin SDK initialized in a firebase.ts module
3. An auth middleware (requireAuth.ts) that:
   - Reads the Bearer token from Authorization header
   - Verifies it with Firebase Admin SDK
   - Looks up or creates the user row in PostgreSQL by firebase_uid
   - Attaches the user to req.user
4. Routes:
   - POST /api/auth/sync — called after Firebase phone login to upsert the user 
     record. Body: { displayName?: string }. Returns the user row.
     The firebase_uid is taken from the verified token — never from the request body.
   - GET /api/me — protected by requireAuth, returns the current user's profile
5. Error handling middleware
6. A .env.example with all required variables:
   DATABASE_URL, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

---

## Frontend (packages/client)

Set up a React + TypeScript Vite app, PWA-configured, with:

1. Firebase client SDK initialized in lib/firebase.ts, config pulled from 
   VITE_ environment variables
2. An AuthContext (contexts/AuthContext.tsx) that:
   - Wraps the app with Firebase onAuthStateChanged
   - Exposes: user (Firebase user), dbUser (our API user row), loading, signOut
   - After Firebase auth, calls POST /api/auth/sync and stores the result as dbUser
3. A ProtectedRoute component that redirects unauthenticated users to /login
4. React Router with two routes to start:
   - /login — public
   - / (home) — protected

### /login page
A clean, mobile-first login page with:
- App name "Troupe" and a short tagline
- Phone number input (with country code selector, defaulting to +1)
- "Send code" button → triggers Firebase signInWithPhoneNumber with a reCAPTCHA verifier
- OTP input that appears after the code is sent (6-digit code)
- "Verify" button → confirms the code
- A first-time user check: if the API returns no displayName, show a "What's your name?" 
  input before completing setup
- Friendly error states for invalid number, wrong OTP, too many requests

### / home page (authenticated)
A simple but well-structured home page:
- Top nav/header with the Troupe logo and a user avatar/initials + sign out option
- A greeting ("Hey, [displayName]!")
- A placeholder "Your Troupes" section with an empty state 
  ("You're not in any troupes yet — create one or ask for an invite link")
- A prominent "Create a Troupe" button (non-functional for now, just UI)
- The page should feel like a real product — not a demo

---

## PWA Setup
- manifest.json with name, short_name, theme_color, icons (use placeholder icons)
- A basic service worker registered via vite-plugin-pwa
- The app should be installable on mobile

---

## Dev Environment
- pnpm workspaces
- Separate tsconfig.json for client and server
- A root-level dev script that runs both client and server concurrently
- ESLint + Prettier configured across the monorepo
- A thorough README.md with setup steps, environment variable descriptions, 
  and how to run the Firebase emulator locally for auth testing

---

## Constraints & Notes
- No ORM — use raw SQL with parameterized queries
- All TypeScript — no JS files
- Do not implement troupe creation, polls, shows, or invite codes yet — that is Phase 2
- Use environment variables for all secrets — no hardcoded values
- The Firebase reCAPTCHA verifier should use the 'invisible' variant
- firebase_uid is always sourced from the verified server-side token, never trusted 
  from the client request body

---

## Phase 2 Notes (do not build yet — for context only)
Troupe membership will be handled via invite codes/links, not phone number lookup.
A future troupe_invites table will manage short codes with expiry and use limits.
Users join a troupe by opening a link — no need to know their phone number in advance.
This is why phone_number is intentionally omitted from the users table.