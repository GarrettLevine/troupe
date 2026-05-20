Add invite link functionality to the Troupe app. This is Phase 5. Only owners 
and organizers can generate invite links. Links are single use and expire after 
7 days. Do not build member management, role changes, or any other features.

## Database
Create a new migration file: db/migrations/005_create_troupe_invites.sql

### troupe_invites table
  - id (UUID, PK, default gen_random_uuid())
  - troupe_id (UUID, FK → troupes.id, on delete cascade, not null)
  - created_by (UUID, FK → users.id, not null)
  - code (text, unique, not null)       -- short random code e.g. "k3xP9q"
  - expires_at (timestamptz, not null)  -- always created_at + 7 days
  - used_at (timestamptz)               -- null until redeemed
  - used_by (UUID, FK → users.id)       -- null until redeemed
  - created_at (timestamptz, default now())

  Indexes:
    - CREATE UNIQUE INDEX ON troupe_invites (code)
    - CREATE INDEX ON troupe_invites (troupe_id, created_at DESC)

### Down migration
  Drop indexes and tables in reverse order of creation.

---

## Backend

### Invite code generation: packages/server/src/lib/inviteCode.ts
  - Use nanoid to generate short, URL-safe invite codes
  - Code length: 10 characters
  - Install nanoid in packages/server
  - Export generateInviteCode(): string

  import { nanoid } from 'nanoid'
  export const generateInviteCode = () => nanoid(10)

### New route file: packages/server/src/routes/invites.ts
All routes require the requireAuth middleware.

#### POST /api/troupes/:troupeId/invites
Generate a new invite link for a troupe.
Only owners and organizers may generate invites — return 403 for members.

Logic:
  1. Verify the requesting user is an owner or organizer of the troupe
  2. Check if the requesting user already has an active unused invite for 
     this troupe (expires_at > NOW() AND used_at IS NULL)
     If so, return the existing invite rather than creating a new one —
     a user should not be able to flood the invites table
  3. If no active invite exists, generate a new code and insert a row with:
     expires_at = NOW() + INTERVAL '7 days'
  4. Return the full invite URL

Response (201 if created, 200 if returning existing):
  {
    code: string
    inviteUrl: string       -- full URL e.g. https://yourdomain.com/invite/{code}
    expiresAt: string       -- ISO 8601 UTC
  }

Error responses:
  - 403 if user is not a member of the troupe
  - 403 if user role is 'member'
  - 404 if troupe not found
  - 500 for unexpected errors

#### GET /api/invites/:code
Look up an invite by code. This route is public — no auth required.
Used to show a preview of the troupe before the user signs in.

Logic:
  - Look up the invite by code
  - Return 404 if code does not exist
  - Return 410 Gone if the invite is expired (expires_at < NOW())
  - Return 410 Gone if the invite has already been used (used_at IS NOT NULL)
  - Otherwise return the troupe preview

Response (200):
  {
    code: string
    troupe: {
      id: string
      name: string
      memberCount: number
      hasBadge: boolean
    }
    expiresAt: string
  }

Error responses:
  - 404 if code does not exist
  - 410 if invite is expired or already used
  - 500 for unexpected errors

#### POST /api/invites/:code/redeem
Redeem an invite. Requires auth — the user must be signed in.

Logic (must be atomic — use a database transaction):
  1. Lock the invite row with SELECT ... FOR UPDATE to prevent race conditions
  2. Return 404 if code does not exist
  3. Return 410 if expired or already used
  4. Return 409 if the user is already a member of the troupe
  5. Insert into troupe_members (troupe_id, user_id, role: 'member')
  6. Check LIMITS.MAX_MEMBERS_PER_TROUPE — return 409 if troupe is full
     (count current members before inserting)
  7. Mark the invite as used:
     UPDATE troupe_invites SET used_at = NOW(), used_by = $userId WHERE id = $id
  8. Return the troupe summary so the frontend can navigate directly

Response (200):
  {
    troupe: {
      id: string
      name: string
      hasBadge: boolean
      role: 'member'
      memberCount: number
    }
  }

Error responses:
  - 401 if not authenticated
  - 404 if code does not exist
  - 409 if user is already a member
  - 409 if troupe is full
  - 410 if invite is expired or already used
  - 500 for unexpected errors

### New environment variable
Add to packages/server/.env.example and packages/client/.env.example:
  APP_URL=https://yourdomain.com
  VITE_APP_URL=https://yourdomain.com

Used to construct the full invite URL server-side and deep link on the client.

### Register routes
Mount in the main Express app:
  app.use('/api/troupes', invitesRouter)    -- for POST /api/troupes/:troupeId/invites
  app.use('/api/invites', redeemRouter)     -- for GET and POST /api/invites/:code

---

## Types
Add to packages/server/src/types/troupe.ts:

  export interface InviteResponse {
    code: string
    inviteUrl: string
    expiresAt: string
  }

  export interface InvitePreview {
    code: string
    troupe: {
      id: string
      name: string
      memberCount: number
      hasBadge: boolean
    }
    expiresAt: string
  }

---

## Frontend

### New page: packages/client/src/pages/InvitePage.tsx
Public page — does not require auth. Accessible at /invite/:code.

This page handles the full invite flow in sequence:

  Step 1 — Loading:
    - On mount, call GET /api/invites/:code
    - Show a loading skeleton while fetching

  Step 2 — Invalid invite:
    - If the API returns 404: show "This invite link is invalid"
    - If the API returns 410: show "This invite link has expired or 
      has already been used"
    - Both states show a "Go to Troupe" button linking to the home page

  Step 3 — Troupe preview (unauthenticated):
    - Show TroupeBadge (size="large"), troupe name, member count
    - Show invite expiry: "This invite expires on [formatted date]"
    - Show a "Join [troupe name]" primary button
    - If the user is not authenticated, clicking "Join" navigates to 
      /login?redirect=/invite/:code
    - The login page must handle the redirect param — after successful 
      auth, navigate to the original invite URL

  Step 4 — Troupe preview (authenticated):
    - Same preview as Step 3
    - "Join [troupe name]" button calls POST /api/invites/:code/redeem directly
    - Show loading state on the button while redeeming
    - On 409 "already a member": show "You're already in this troupe" 
      with a "View Troupe" button linking to /troupes/:troupeId
    - On 409 "troupe full": show "This troupe is full"
    - On success: show a brief success message then navigate to 
      /troupes/:troupeId

### Update: Login page
  - Read the redirect query param on mount: ?redirect=/invite/:code
  - After successful Firebase auth and /api/auth/sync completes, check 
    for the redirect param
  - If present, navigate to the redirect URL instead of the home page
  - Only honour redirects to paths within the app (must start with /) — 
    reject external redirects

### New route
Add to React Router:
  /invite/:code — public (no ProtectedRoute wrapper)

### New hook: packages/client/src/hooks/useInvite.ts
  - fetchInvite(code): calls GET /api/invites/:code
  - redeemInvite(code): calls POST /api/invites/:code/redeem
  - Manages loading, error, and invite state

### Update: TroupeDetailPage.tsx
Add an "Invite Members" button in the troupe header. Only visible to owners 
and organizers.

  Behaviour:
    - Calls POST /api/troupes/:troupeId/invites on click
    - Shows a loading state on the button while generating
    - On success: opens InviteShareModal

### New component: packages/client/src/components/InviteShareModal.tsx
Shown after an invite link is generated or if an active one already exists.

  Shows:
    - The full invite URL in a read-only text input
    - "Copy Link" button — copies the URL to the clipboard using 
      navigator.clipboard.writeText
    - On copy: button text changes to "Copied!" for 2 seconds then resets
    - Invite expiry: "This link expires on [formatted date]"
    - "Generate New Link" button — calls POST /api/troupes/:troupeId/invites 
      again with a force flag (add ?force=true query param)
      When force=true, skip the existing invite check and always create a new one.
      This invalidates the previous link implicitly since each user can only
      have one active invite per troupe — update the existing row instead of
      inserting a new one when force=true.
    - Warning when generating a new link: "This will invalidate the current link"
    - Use shadcn/ui Dialog component

  Note: the share sheet approach (navigator.share) can be used on mobile 
  if available, with clipboard copy as the fallback:

    if (navigator.share) {
      await navigator.share({ title: `Join ${troupe.name} on Troupe`, url: inviteUrl })
    } else {
      await navigator.clipboard.writeText(inviteUrl)
    }

---

## CLAUDE.md
Update CLAUDE.md:
  - Mark Phase 4 as current (invite links)
  - Add the following conventions:

    ### Invite links
    - Invite codes are generated with nanoid (10 characters, URL-safe)
    - Links are single use and expire after 7 days
    - Only owners and organizers can generate invite links
    - Each user can only have one active invite per troupe at a time
    - Redemption uses SELECT FOR UPDATE to prevent race conditions
    - GET /api/invites/:code is the only public (unauthenticated) API route
    - The invite page handles auth redirect via ?redirect= query param
    - navigator.share is used on mobile with clipboard copy as fallback
    - force=true on POST /api/troupes/:troupeId/invites updates the existing
      invite row rather than inserting — keeps one active invite per user
      per troupe

---

## Constraints
  - Invite redemption must use SELECT FOR UPDATE to prevent two users 
    redeeming the same code simultaneously
  - The invite page is fully public — no auth required to preview the troupe
  - Only honour login redirects to internal paths (starting with /)
  - Member limit check happens inside the redemption transaction
  - Do not build member removal, role changes, or any Phase 6 features
  - nanoid is the only new dependency permitted
  - Mobile-first on all new components