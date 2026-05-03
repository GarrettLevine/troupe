# Troupe

A PWA for performing arts groups to manage membership, scheduling, and shows.

## Stack
- Frontend: React + TypeScript (Vite), shadcn/ui + Tailwind
- Backend: Node/Express + TypeScript
- Database: PostgreSQL, raw SQL, no ORM
- Auth: Firebase Authentication (phone/SMS)
- Monorepo: pnpm workspaces

## What's NOT built yet
- Troupe creation
- Invite code system
- Polls / scheduling
- Shows

## Coding Rules

### General
- All code is TypeScript — no .js files anywhere in the monorepo
- No `any` types — use `unknown` and narrow, or define a proper interface
- Prefer `async/await` over promise chains
- No unused imports or variables — treat them as errors

### Security
- `firebase_uid` is always sourced from the verified server-side token (req.user) 
  never from the request body or query params
- All SQL queries must use parameterized queries — no string interpolation
- Never log sensitive user data (tokens, phone numbers)
- All protected routes must use the requireAuth middleware

### Database
- No ORM — raw SQL only using the pg driver
- All migrations live in db/migrations/ and are numbered sequentially (001_, 002_)
- Never mutate the database outside of a migration file
- Always use UUIDs (gen_random_uuid()) for primary keys
- All tables need created_at and updated_at timestamptz columns
- updated_at must be kept current via a trigger, not application code

### API / Backend
- All routes are prefixed with /api
- Route files are organized by domain (e.g. routes/auth.ts, routes/troupes.ts)
- All route handlers must be wrapped in try/catch — no unhandled promise rejections
- Return consistent error shapes: { error: { message: string, code?: string } }
- HTTP status codes must be semantically correct (401 vs 403 vs 400 vs 404)
- Never return a full database row if it contains fields the client doesn't need

### Frontend
- Components live in src/components/, pages in src/pages/
- One component per file, filename matches the component name
- No inline API calls in components — all fetch logic goes in src/hooks/ or src/lib/api.ts
- All API calls must handle loading and error states
- No hardcoded strings for routes — define them in a central src/routes.ts constants file
- Firebase client config comes from VITE_ environment variables only

### Auth
- AuthContext is the single source of truth for auth state
- Never read Firebase user state directly in a component — always go through AuthContext
- dbUser (our Postgres user) and user (Firebase user) are distinct — don't conflate them
- Token refresh is handled by Firebase SDK — never manually manage tokens

### Styling
- Use shadcn/ui components before writing custom UI
- Tailwind utility classes only — no custom CSS files unless absolutely necessary
- Mobile-first — design for small screens, scale up

### PWA
- Test installability on mobile before marking any UI task complete
- Don't break the service worker — test offline behaviour after significant changes

### Phase boundaries
- Phase 1: auth + home page only
- Phase 2: troupe creation + invite codes
- Phase 3: polls + scheduling
- Phase 4: shows
- Do not build ahead of the current phase without being asked