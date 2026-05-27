Add member management to the Troupe app. Only owners can manage members.
Management is accessed via a modal from the troupe detail page. Do not build
any other features.

## Database
Create a new migration file: db/migrations/008_member_management.sql

No new tables are needed. However, add an index to support efficient
member lookups and role filtering:

  CREATE INDEX ON troupe_members (troupe_id, role);

### Ownership transfer constraint
When transferring ownership, the operation must be atomic:
  1. Update the current owner's role to 'organizer'
  2. Update the new owner's role to 'owner'
Both updates must happen in a single transaction. The partial unique index
one_owner_per_troupe (from migration 002) enforces there is always exactly
one owner — the transaction will fail if this constraint is violated.

### Down migration
  DROP INDEX IF EXISTS troupe_members_troupe_id_role_idx;

---

## Backend

### New route file: packages/server/src/routes/members.ts
All routes require requireAuth middleware.
All routes must verify the requesting user is the owner of the troupe.
Return 403 for any non-owner (organizer or member).

#### GET /api/troupes/:troupeId/members
Return all members of the troupe with their roles.
Owner only.

Response (200):
  {
    members: [
      {
        userId: string
        displayName: string
        initials: string
        role: 'owner' | 'organizer' | 'member'
        joinedAt: string          -- ISO 8601 UTC
      }
    ]
    totalCount: number
  }

Order by: owner first, then organizers, then members. Within each role,
order by joinedAt ASC (longest-standing members first).

Use a single SQL query — do not make multiple queries.

#### PATCH /api/troupes/:troupeId/members/:userId/role
Change a member's role. Owner only.

Request body:
  { role: 'organizer' | 'member' }
  -- 'owner' is not a valid value here — ownership transfer has its own route

Validation:
  - role must be 'organizer' or 'member'
  - Cannot change your own role (owner cannot demote themselves)
    Return 400: "You cannot change your own role"
  - Cannot change the role of a user who is not in the troupe
    Return 404
  - If the target user is already the requested role, return 200 with
    no database write (idempotent)

Response (200):
  {
    userId: string
    displayName: string
    role: 'organizer' | 'member'
  }

Error responses:
  - 400 if role is invalid
  - 400 if owner tries to change their own role
  - 403 if requesting user is not the owner
  - 404 if target user is not in the troupe
  - 500 for unexpected errors

#### POST /api/troupes/:troupeId/members/:userId/transfer-ownership
Transfer ownership to another member. Owner only.
This is a separate route from role change because it is a more significant
and irreversible-feeling action with different validation requirements.

Request body: none — the target userId is in the URL

Validation:
  - Target user must be a current member of the troupe
  - Cannot transfer to yourself — return 400
  - Target user must not already be the owner — return 400

Logic (must be atomic — single database transaction):
  1. UPDATE troupe_members SET role = 'organizer'
     WHERE troupe_id = $troupeId AND user_id = $currentOwnerId
  2. UPDATE troupe_members SET role = 'owner'
     WHERE troupe_id = $troupeId AND user_id = $targetUserId
  Both updates in a single transaction. If either fails, roll back.

Response (200):
  {
    previousOwner: { userId: string, displayName: string, role: 'organizer' }
    newOwner: { userId: string, displayName: string, role: 'owner' }
  }

  After a successful ownership transfer, the requesting user is no longer
  the owner. The API should reflect this — subsequent requests to owner-only
  routes from the previous owner will return 403.

Error responses:
  - 400 if transferring to yourself
  - 400 if target is already the owner
  - 403 if requesting user is not the owner
  - 404 if target user is not in the troupe
  - 500 for unexpected errors

#### DELETE /api/troupes/:troupeId/members/:userId
Remove a member from the troupe. Owner only.

Validation:
  - Cannot remove yourself (owner cannot remove themselves)
    Return 400: "You cannot remove yourself from the troupe"
  - Cannot remove a user who is not in the troupe — return 404
  - Removing a member also clears their event_attendance rows for all
    future events in this troupe — handle via ON DELETE CASCADE on the
    FK or explicitly delete in the same transaction

Logic:
  DELETE FROM troupe_members
  WHERE troupe_id = $troupeId AND user_id = $userId

Response (200):
  { userId: string, removed: true }

Error responses:
  - 400 if owner tries to remove themselves
  - 403 if requesting user is not the owner
  - 404 if target user is not in the troupe
  - 500 for unexpected errors

### Register routes
Mount in the main Express app:
  app.use('/api/troupes', membersRouter)
  -- resolves to /api/troupes/:troupeId/members and sub-routes

---

## Types
Add to packages/server/src/types/troupe.ts:

  export interface ManagedMember {
    userId: string
    displayName: string
    initials: string
    role: TroupeRole
    joinedAt: string
  }

  export interface MemberListResponse {
    members: ManagedMember[]
    totalCount: number
  }

  export interface TransferOwnershipResponse {
    previousOwner: { userId: string, displayName: string, role: 'organizer' }
    newOwner: { userId: string, displayName: string, role: 'owner' }
  }

---

## Frontend

### New hook: packages/client/src/hooks/useMembers.ts
Manages all member management API interactions:

  State:
    members: ManagedMember[]
    loading: boolean
    error: string | null

  Functions:
    fetchMembers(troupeId): calls GET /api/troupes/:troupeId/members
    changeRole(troupeId, userId, role): calls PATCH .../role
      On success: update member in local list in place
    transferOwnership(troupeId, userId): calls POST .../transfer-ownership
      On success: update both affected members in local list,
      then call onOwnershipTransferred callback so the parent can
      update currentUserRole throughout the page
    removeMember(troupeId, userId): calls DELETE .../members/:userId
      On success: remove member from local list

### New component: packages/client/src/components/ManageMembersModal.tsx
A modal opened from the troupe detail page. Owner only — do not render
the trigger button for non-owners.

  Props:
    troupeId: string
    currentUserId: string
    onOwnershipTransferred(): void
      -- called when the current user transfers ownership away
      -- parent should close the modal and refresh currentUserRole

  Layout:
    Modal heading: "Manage Members"
    Subheading: "{totalCount} members"

  Member list:
    - Grouped by role with sticky group headers:
        "Owner" (1 member)
        "Organizers" ({n} members)
        "Members" ({n} members)
    - Each row shows:
        - Circular avatar chip with initials (same colour hash as AttendeeChipList)
        - Display name
        - Role badge
        - Joined date in small muted text: "Joined June 2026"
        - Action menu (kebab/three-dot button) on the right
          Only shown for non-owner members
          The current user's own row never shows an action menu

  Action menu per member (shadcn/ui DropdownMenu):
    For organizers:
      - "Change to Member"
      - "Remove from Troupe"
      - "Transfer Ownership"
    For members:
      - "Change to Organizer"
      - "Remove from Troupe"
      - "Transfer Ownership"

  Role change flow:
    - Optimistically update the member's role in the list
    - Call changeRole
    - On error: roll back and show an inline error toast

  Remove member flow:
    - Clicking "Remove from Troupe" opens a ConfirmRemoveDialog (see below)
    - On confirm: call removeMember
    - On success: member row animates out of the list

  Transfer ownership flow:
    - Clicking "Transfer Ownership" opens a ConfirmTransferDialog (see below)
    - On confirm: call transferOwnership
    - On success:
        - The previous owner's row updates to show role "Organizer"
        - The new owner's row updates to show role "Owner"
        - Show a success banner: "Ownership transferred to [name].
          You are now an organizer."
        - After 2 seconds, call onOwnershipTransferred and close the modal
          The troupe detail page must refresh currentUserRole so the
          "Manage Members" button disappears

  Loading state:
    - Show skeleton rows while fetchMembers is in progress
    - Individual rows show a loading spinner on their action button
      while an action is in progress for that specific member

  Use shadcn/ui Dialog component.

### New component: packages/client/src/components/ConfirmRemoveDialog.tsx
An inline confirmation dialog (not a second modal — use shadcn/ui AlertDialog).

  Props:
    member: ManagedMember
    onConfirm(): void
    onCancel(): void
    loading: boolean

  Shows:
    - "Remove [displayName] from this troupe?"
    - "They will lose access to all troupe events and content."
    - "Remove" button (destructive) — disabled while loading
    - "Cancel" button

### New component: packages/client/src/components/ConfirmTransferDialog.tsx
An inline confirmation dialog for ownership transfer (shadcn/ui AlertDialog).

  Props:
    member: ManagedMember
    onConfirm(): void
    onCancel(): void
    loading: boolean

  Shows:
    - "Transfer ownership to [displayName]?"
    - "You will become an organizer. This cannot be undone."
    - Two-step confirmation to prevent accidental transfer:
        Step 1: "Transfer Ownership" button (destructive) → advances to step 2
        Step 2: "Yes, I'm sure — Transfer" button (destructive) + 
                "Cancel" button
    - Show loading spinner on confirm button while in progress

### Update TroupeDetailPage.tsx
  - Add a "Manage Members" button in the troupe header
    Only rendered when currentUserRole === 'owner'
  - Clicking opens ManageMembersModal
  - Pass onOwnershipTransferred callback:
      When fired, refetch the troupe detail (to get updated currentUserRole)
      and close ManageMembersModal
  - After ownership transfer, the "Manage Members" button disappears
    because currentUserRole is no longer 'owner'

---

## CLAUDE.md
Update CLAUDE.md:
  - Add the following conventions:

    ### Member management
    - Only owners can manage members — enforced server-side on every route
    - Role changes are optimistic with rollback on error
    - Ownership transfer is atomic — single transaction updating both rows
    - The one_owner_per_troupe partial unique index enforces single ownership
      at the database level
    - An owner cannot change their own role or remove themselves
    - Ownership transfer uses a dedicated route (not PATCH role) because it
      affects two rows atomically and has distinct validation
    - After ownership transfer, the previous owner's UI must update
      currentUserRole to reflect they are now an organizer
    - Two-step confirmation is required for ownership transfer
    - Single-step confirmation (AlertDialog) is required for member removal

---

## Constraints
  - All member management routes are owner-only — enforced server-side
  - Ownership transfer must be a single atomic transaction
  - Owner cannot remove themselves or change their own role
  - Two-step confirmation for ownership transfer — this is irreversible
  - Single confirmation step for member removal
  - Optimistic updates with rollback for role changes
  - After ownership transfer, currentUserRole must update throughout
    the troupe detail page without a full page reload
  - Do not build member invitation from this modal (that is the invite
    link system already built)
  - Do not build troupe deletion or any other features
  - Mobile-first on all new components