# Troupe

A PWA for performing arts groups to manage membership, scheduling, and shows.

## Stack
- Frontend: React + TypeScript (Vite), shadcn/ui + Tailwind
- Backend: Node/Express + TypeScript
- Database: PostgreSQL, raw SQL, no ORM
- Auth: Firebase Authentication (phone/SMS)
- Monorepo: pnpm workspaces

## Completed Phases
- Phase 1: auth + home page

## What's NOT built yet (Phase 3 in progress)
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
- Migrations are managed with **node-pg-migrate** (installed in `packages/server`)
- All migrations live in `packages/server/db/migrations/` and are numbered sequentially (001_, 002_, …)
- Migration files are always **raw SQL** — never JavaScript; use `-- Up Migration` / `-- Down Migration` section headers
- Run migrations: `pnpm --filter server migrate` (applies pending) / `pnpm --filter server migrate:down` (rolls back one)
- Create a new migration: `pnpm --filter server migrate:create <name>`
- Never mutate the database outside of a migration file
- Always use UUIDs (gen_random_uuid()) for primary keys
- All tables need created_at and updated_at timestamptz columns
- updated_at must be kept current via a trigger, not application code
- Use the `query<T>` helper from `src/db.ts` for all queries — never call `pool.query` directly in route/middleware files

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

### Deployment
- CI/CD: GitHub Actions → Cloud Run via source deployment (Cloud Build builds the image)
- Two jobs: `migrate` (runs first) → `deploy` (only runs if migrate succeeds)
- Never merge to main with a migration you cannot roll back cleanly
- Breaking schema changes (rename/drop) always use the three-phase approach:
  - PR 1: add new column
  - PR 2: update code + backfill data
  - PR 3: drop old column
- Secrets live in GitHub repository secrets — never in code or committed `.env` files
- To manually roll back a migration: `pnpm migrate:down` (run locally against prod via Cloud SQL Auth Proxy)

### Troupe roles
- `TroupeRole` = `'owner' | 'organizer' | 'member'`
- owner: created the troupe, full control
- organizer: elevated permissions (future)
- member: standard membership
- All troupe mutations (create, join, leave) must use a database transaction

### Business Logic Limits
- All limit constants live in `packages/server/src/config/limits.ts`
- Never hardcode limit values in route handlers or components
- Limits are enforced in the API layer only — not at the database level
- This allows limits to evolve per user tier in future without migrations

### Dates & Times
- All timestamps stored as timestamptz in UTC
- Events use a single event_at (timestamptz) column — never split date and time
- Frontend converts datetime-local input to UTC ISO string before sending to API
- Frontend displays times in the user's local timezone using Intl.DateTimeFormat
- Never store or send local times to the API

### Pagination
- All list endpoints use cursor-based pagination, not offset
- Default and maximum page size is 10
- Cursors are base64 encoded strings containing event_at + id
- Responses always include a nextCursor field (null if no more pages)

### Event permissions
- Only owners and organizers can create events
- Permission is checked in the API layer by reading the user's role from troupe_members — never trust the client

### Media & Storage
- All troupe badge images stored in Cloudflare R2 (bucket: troupe-badges)
- Badge URLs are deterministic — never stored in the database
- `has_badge` (boolean) on the troupes table is the only DB record needed
- Three sizes generated server-side on upload: 64px (thumbnail), 128px (standard), 256px (large)
- All variants are circular-cropped WebP using sharp
- Cache-Control: public, max-age=31536000, immutable on all R2 uploads
- Cache busting via `?v={updatedAt unix timestamp}` query param
- Badge URL construction always goes through `getBadgeUrls()` helper — never construct URLs inline
- Owner only: name editing and badge upload
- `TroupeBadge` component is the single source of truth for badge rendering

### Phase boundaries
- Phase 1 (complete): auth + home page
- Phase 2 (complete): troupe creation
- Phase 3 (complete): troupe detail page + events
- Phase 3.5 (complete): troupe badge upload + name editing
- Phase 4: polls + scheduling
- Phase 5: shows
- Do not build ahead of the current phase without being asked