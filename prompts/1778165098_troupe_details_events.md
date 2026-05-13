Add a troupe detail page with members and events to the Troupe app. This is 
Phase 3. Do not build invite codes, polls, member management, or any other 
features — focus only on the troupe detail page and events.

## Database
Create a new migration file: db/migrations/003_create_events.sql

### events table
  - id (UUID, PK, default gen_random_uuid())
  - troupe_id (UUID, FK → troupes.id, on delete cascade, not null)
  - created_by (UUID, FK → users.id, not null)
  - name (text, not null)
  - event_type (text, not null) — CHECK (event_type IN ('show', 'rehearsal'))
  - event_at (timestamptz, not null) — stored in UTC
  - location (text, not null)
  - details (text)
  - created_at (timestamptz, default now())
  - updated_at (timestamptz, default now())
  - Add updated_at trigger (reuse the existing update_updated_at() function — 
    do not redefine it)
  - Add index on (troupe_id, event_at) for efficient paginated queries

### Down migration
  Drop indexes and tables in reverse order of creation.

---

## Backend

### New route file: packages/server/src/routes/events.ts
All routes require the requireAuth middleware.
All routes must verify the requesting user is a member of the troupe before 
proceeding — return 403 if not.

#### GET /api/troupes/:troupeId/events
Return paginated events for a troupe.

Query parameters:
  - cursor (optional, string) — encodes the event_at + id of the last record 
    returned, used for cursor-based pagination
  - type (optional, 'upcoming' | 'past') — defaults to 'upcoming'
  - limit (optional, number) — defaults to 10, max 10

Pagination:
  - Use cursor-based pagination, not offset or page number
  - For upcoming: return events where event_at >= NOW(), ordered ASC by event_at
  - For past: return events where event_at < NOW(), ordered DESC by event_at
  - The cursor encodes the last event_at and id seen as a base64 string
  - Return a nextCursor field in the response — null if no more records

Response (200):
  {
    events: [
      {
        id: string
        name: string
        eventType: 'show' | 'rehearsal'
        eventAt: string         -- ISO 8601 UTC e.g. "2026-06-14T23:00:00.000Z"
        location: string
        details: string | null
        createdBy: string       -- display name of creator
      }
    ],
    nextCursor: string | null
  }

#### POST /api/troupes/:troupeId/events
Create a new event. Only owners and organizers may create events — return 403 
if the requesting user is a member role.

Request body:
  {
    name: string
    eventType: 'show' | 'rehearsal'
    eventAt: string             -- ISO 8601 UTC e.g. "2026-06-14T23:00:00.000Z"
    location: string
    details?: string
  }

Validation:
  - name: required, non-empty, max 150 characters
  - eventType: required, must be 'show' or 'rehearsal'
  - eventAt: required, must be a valid ISO 8601 UTC string, must not be in 
    the past (compare against current UTC time)
  - location: required, non-empty, max 200 characters
  - details: optional, max 1000 characters
  - Trim all text fields before saving

Response (201): the created event object matching the shape above

Error responses:
  - 400 for validation failures with a descriptive message per field
  - 403 if user is not a member of the troupe
  - 403 if user role is 'member' (not owner or organizer)
  - 404 if troupe does not exist
  - 500 for unexpected errors

### Update: packages/server/src/routes/troupes.ts

#### GET /api/troupes/:troupeId
Return troupe details including members. The requesting user must be a member 
— return 403 if not.

Response (200):
  {
    id: string
    name: string
    createdAt: string
    memberCount: number
    members: [
      {
        userId: string
        displayName: string
        role: 'owner' | 'organizer' | 'member'
      }
    ]
    currentUserRole: 'owner' | 'organizer' | 'member'
  }

Use a single SQL query with JOINs — do not make multiple queries.

### Register routes
Mount events routes in the main Express app:
  app.use('/api/troupes', eventsRouter)

Events routes will resolve to /api/troupes/:troupeId/events

---

## Types
Add to packages/server/src/types/troupe.ts:

  export type EventType = 'show' | 'rehearsal'

  export interface TroupeEvent {
    id: string
    name: string
    eventType: EventType
    eventAt: string
    location: string
    details: string | null
    createdBy: string
  }

  export interface TroupeDetail {
    id: string
    name: string
    createdAt: string
    memberCount: number
    members: TroupeMember[]
    currentUserRole: TroupeRole
  }

  export interface TroupeMember {
    userId: string
    displayName: string
    role: TroupeRole
  }

---

## Frontend

### New route
Add to React Router:
  /troupes/:troupeId — protected, renders TroupeDetailPage

Update TroupeCard.tsx:
  "View Troupe" button navigates to /troupes/:troupeId

### New hook: packages/client/src/hooks/useTroupeDetail.ts
  - fetchTroupeDetail(troupeId): calls GET /api/troupes/:troupeId
  - Returns TroupeDetail, loading, error

### New hook: packages/client/src/hooks/useEvents.ts
  - Manages paginated event fetching
  - fetchEvents(troupeId, type, cursor?): calls GET /api/troupes/:troupeId/events
  - Maintains a flat list of events, appending each page to the previous
  - Tracks nextCursor, hasMore, loading, error
  - createEvent(troupeId, data): calls POST /api/troupes/:troupeId/events,
    resets and refetches the upcoming event list on success

### New page: packages/client/src/pages/TroupeDetailPage.tsx
Composed of two clear sections:

#### Section 1 — Troupe Header + Members
  - Troupe name as the page heading
  - Total member count (e.g. "12 members")
  - A horizontal scrollable row (mobile) or wrapped grid (desktop) of member chips:
    Each chip shows: display name + role badge
    Role badge colours must be visually distinct:
      owner → accent/primary colour
      organizer → secondary colour
      member → neutral/muted
  - Loading skeleton while fetching

#### Section 2 — Events
  - Two tabs: "Upcoming" and "Past"
    - Upcoming tab is active by default
    - Switching tabs resets the event list and fetches with the appropriate type
  - Use shadcn/ui Tabs component
  - "Add Event" button visible in the tab header — only rendered if
    currentUserRole is 'owner' or 'organizer'
  - Event list:
    - Each event rendered as an EventCard (see below)
    - Infinite scroll: when the user scrolls to within 200px of the bottom
      of the list, fetch the next page if hasMore is true
    - Loading spinner at the bottom while fetching next page
    - "No upcoming events" / "No past events" empty state per tab
  - Loading skeleton for initial fetch

### New component: packages/client/src/components/EventCard.tsx
Displays a single event. Shows:
  - Event name (prominent)
  - Event type badge: "Show" or "Rehearsal" — visually distinct colours
  - Date and time formatted in the user's local timezone using Intl.DateTimeFormat:
    e.g. "Saturday, June 14 · 7:00 PM EDT"
    
    const formatted = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    }).format(new Date(event.eventAt))

  - Location
  - Details (if present) — collapsed to 2 lines with a "Show more" toggle
    if longer than 2 lines
  - Use shadcn/ui Card as the base

### New component: packages/client/src/components/AddEventModal.tsx
A modal triggered by the "Add Event" button. Contains:
  - Event name input (max 150 characters with counter)
  - Event type toggle/select: "Show" or "Rehearsal"
  - A single datetime-local HTML input for date and time
    Convert to UTC ISO string before sending to the API:

    const localDatetime = e.target.value          -- "2026-06-14T19:00"
    const utcString = new Date(localDatetime).toISOString()
    -- sends "2026-06-14T23:00:00.000Z"

  - Set the min attribute of the datetime-local input to the current 
    local datetime to prevent past event creation in the UI
  - Location input (free text, max 200 characters)
  - Details textarea (optional, max 1000 characters with counter)
  - "Create Event" button — disabled while submitting
  - "Cancel" button
  - Per-field inline validation errors
  - On success: close modal, reset and refetch the upcoming events list
  - Use shadcn/ui Dialog component

---

## Infinite scroll implementation
Use an IntersectionObserver in useEvents.ts to detect when the sentinel 
element at the bottom of the list enters the viewport:
  - Create a ref for a sentinel div rendered after the last event card
  - When the sentinel is visible and hasMore is true and not currently
    loading, call fetchEvents with the current nextCursor
  - Append new events to the existing list
  - Do not use a third party infinite scroll library

---

## CLAUDE.md
Update CLAUDE.md:
  - Mark Phase 2 as completed
  - Mark Phase 3 as current
  - Add the following conventions:

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
    - Permission is checked in the API layer by reading the user's role 
      from troupe_members — never trust the client

---

## Constraints
- All timestamps stored and transmitted in UTC
- Frontend always converts to local timezone for display only
- No third party infinite scroll libraries — use IntersectionObserver
- No third party date picker libraries — use native datetime-local input
- Cursor-based pagination only — no offset or page number pagination
- All text fields trimmed before saving
- Past vs upcoming split is determined server-side using NOW() — not the frontend
- Mobile-first on all new components
- Do not build event editing, event deletion, invite codes, polls, or
  any Phase 4 features