Add troupe creation to the Troupe app. This is Phase 2. Do not build invite codes, 
polls, shows, or any other features — focus only on troupe creation and displaying 
troupes on the home page.

## Database
Create a new migration file: db/migrations/002_create_troupes.sql

### troupes table
  - id (UUID, PK, default gen_random_uuid())
  - name (text, not null)
  - created_by (UUID, FK → users.id, not null)
  - created_at (timestamptz, default now())
  - updated_at (timestamptz, default now())
  - Add updated_at trigger (reuse the existing update_updated_at() function 
    from 001_create_users.sql — do not redefine it)

### troupe_members table
  - id (UUID, PK, default gen_random_uuid())
  - troupe_id (UUID, FK → troupes.id, on delete cascade, not null)
  - user_id (UUID, FK → users.id, on delete cascade, not null)
  - role (text, not null) — must be one of: 'owner', 'organizer', 'member'
    enforce with a CHECK constraint: CHECK (role IN ('owner', 'organizer', 'member'))
  - joined_at (timestamptz, default now())
  - UNIQUE constraint on (troupe_id, user_id) — a user can only appear once per troupe

### One owner per troupe
  Enforce via a partial unique index only — no triggers:
  CREATE UNIQUE INDEX one_owner_per_troupe ON troupe_members (troupe_id) 
  WHERE role = 'owner';

### Down migration
  Drop indexes and tables in reverse order of creation.

---

## Backend

### Business logic constants: packages/server/src/config/limits.ts
Define all business rule limits in a single constants file so they can be 
easily updated in future:

  export const LIMITS = {
    MAX_TROUPES_PER_USER: 5,
    MAX_MEMBERS_PER_TROUPE: 30,
  } as const

All limit checks in the API layer must reference this file — no magic numbers.

### New route file: packages/server/src/routes/troupes.ts
All routes require the requireAuth middleware.

#### POST /api/troupes
Create a new troupe. The authenticated user becomes the owner.

Request body:
  { name: string }

Validation:
  - name is required, non-empty string
  - name max length: 100 characters
  - trim whitespace before saving

Business logic checks (in application code, before touching the database):
  1. Count how many troupes the user currently owns
     If >= LIMITS.MAX_TROUPES_PER_USER, return 409
  2. All subsequent DB writes must be atomic — use a database transaction:
     a. Insert into troupes (name, created_by)
     b. Insert into troupe_members (troupe_id, user_id, role: 'owner')
     c. Return the new troupe with the requesting user's membership role

Response (201):
  {
    id: string
    name: string
    role: 'owner'
    memberCount: number
    createdAt: string
  }

Error responses:
  - 400 if name is missing or empty
  - 400 if name exceeds 100 characters
  - 409 if the user already owns 5 troupes
  - 500 for unexpected errors

#### GET /api/troupes
Return all troupes the authenticated user belongs to, with their role in each.

Response (200):
  {
    troupes: [
      {
        id: string
        name: string
        role: 'owner' | 'organizer' | 'member'
        memberCount: number
        createdAt: string
      }
    ]
  }

Use a single SQL query with a JOIN — do not make multiple queries.

### Register routes
Mount troupes routes in the main Express app:
  app.use('/api/troupes', troupesRouter)

---

## Types
Add shared TypeScript types to packages/server/src/types/troupe.ts:

  export type TroupeRole = 'owner' | 'organizer' | 'member'

  export interface TroupeSummary {
    id: string
    name: string
    role: TroupeRole
    memberCount: number
    createdAt: string
  }

---

## Frontend

### New hook: packages/client/src/hooks/useTroupes.ts
Handles all troupe API interactions:
  - fetchTroupes(): calls GET /api/troupes, returns TroupeSummary[]
  - createTroupe(name: string): calls POST /api/troupes, returns TroupeSummary
  - Manages loading and error state
  - Attaches the Firebase ID token to every request as a Bearer token

### New component: packages/client/src/components/TroupeCard.tsx
Displays a single troupe as a card. Shows:
  - Troupe name (prominent)
  - User's role badge (owner / organizer / member) — visually distinct per role
  - Member count (e.g. "4 members")
  - "View Troupe" button (non-functional for now — Phase 3)
  The card should feel polished — use shadcn/ui Card component as the base.

### New component: packages/client/src/components/CreateTroupeModal.tsx
A modal/dialog triggered by the "Create a Troupe" button. Contains:
  - A text input for the troupe name
  - Character counter showing remaining characters (max 100)
  - "Create" button — disabled while submitting
  - "Cancel" button
  - Inline error message if creation fails (e.g. "You've reached the 5 troupe limit")
  - Use shadcn/ui Dialog component
  - On success: close the modal, refresh the troupe list

### Update: packages/client/src/pages/Home.tsx
Replace the placeholder "Your Troupes" section with:
  - Loading skeleton state while fetching (use shadcn/ui Skeleton)
  - Empty state if no troupes: existing message + "Create a Troupe" button
  - Grid of TroupeCard components when troupes exist (2 columns on desktop, 
    1 column on mobile)
  - "Create a Troupe" button always visible in the header of the section
  - Show a count: "Your Troupes (3/5)" indicating usage against the 5 troupe limit
  - Hide the "Create a Troupe" button when the user has reached the 5 troupe limit,
    replace it with "Troupe limit reached"

---

## Error handling
Return friendly API error messages for limit violations:
  - User owns 5 troupes → 409 + { error: { message: "You've reached the 
    maximum of 5 troupes", code: "TROUPE_LIMIT_REACHED" } }
  - Troupe has 30 members → 409 + { error: { message: "This troupe is full", 
    code: "TROUPE_FULL" } }

---

## CLAUDE.md
Update CLAUDE.md:
  - Move Phase 1 to "Completed Phases"
  - Mark Phase 2 as current
  - Add TroupeRole type and the three role definitions to the conventions section
  - Note that all troupe mutations must use database transactions
  - Add the following to the conventions section:

    ### Business Logic Limits
    - All limit constants live in packages/server/src/config/limits.ts
    - Never hardcode limit values in route handlers or components
    - Limits are enforced in the API layer only — not at the database level
    - This allows limits to evolve per user tier in future without migrations

---

## Constraints
- The 5 troupe and 30 member limits are enforced in the API layer only — 
  no database triggers for these rules
- The only database-level constraint is one owner per troupe (partial unique index)
- All troupe mutations use a database transaction
- No new dependencies unless absolutely necessary — use what is already installed
- Do not build troupe detail pages, invite codes, member management, or any 
  Phase 3 features
- Mobile-first on all new UI components