Add event view/edit/delete functionality to the Troupe app. This builds on 
Phase 3. Do not build any other features.

## Database
Create a new migration file: db/migrations/006_update_events.sql

### Add new columns to events table
  ALTER TABLE events ADD COLUMN call_time_offset INTEGER;
  -- stores minutes before event_at e.g. 30 means "30 minutes before event_at"
  -- nullable — not all events need a call time

  ALTER TABLE events ADD COLUMN duration_minutes INTEGER;
  -- stores duration in minutes e.g. 90 means "1h 30m"
  -- nullable — not all events need a duration

  ALTER TABLE events ADD COLUMN status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'cancelled'));
  -- extensible status field — new statuses can be added to the CHECK 
  -- constraint in future migrations without changing application logic

  ALTER TABLE events ADD COLUMN deleted_at TIMESTAMPTZ;
  -- soft delete — null means not deleted, set to NOW() when deleted
  -- all queries must filter WHERE deleted_at IS NULL unless explicitly 
  -- fetching deleted events

### Update existing queries
  All existing event queries must be updated to filter WHERE deleted_at IS NULL.
  This includes:
    - GET /api/troupes/:troupeId/events
    - GET /api/events (home feed)

### Down migration
  ALTER TABLE events DROP COLUMN call_time_offset;
  ALTER TABLE events DROP COLUMN duration_minutes;
  ALTER TABLE events DROP COLUMN status;
  ALTER TABLE events DROP COLUMN deleted_at;

---

## Backend

### Update event response shape
All routes that return event data must now include the new fields:

  {
    id: string
    name: string
    eventType: 'show' | 'rehearsal'
    eventAt: string                 -- ISO 8601 UTC
    callTime: string | null         -- ISO 8601 UTC, derived from event_at - call_time_offset
    callTimeOffset: number | null   -- minutes before event_at
    durationMinutes: number | null
    durationFormatted: string | null  -- e.g. "1h 30m", derived server-side
    location: string
    details: string | null
    status: 'scheduled' | 'cancelled'
    createdBy: string
  }

### Duration formatting helper: packages/server/src/lib/formatDuration.ts
  export function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }

### Call time derivation
  Never store the absolute call time — always derive it from event_at and 
  call_time_offset at response time:

  export function deriveCallTime(eventAt: Date, offsetMinutes: number): Date {
    return new Date(eventAt.getTime() - offsetMinutes * 60 * 1000)
  }

  Include callTime as an ISO string in every event response when 
  call_time_offset is not null. This way the frontend never needs to 
  calculate it.

### Update: PATCH /api/troupes/:troupeId/events/:eventId
Add this route to packages/server/src/routes/events.ts.
Only owners and organizers may edit — return 403 for members.

Request body (all fields optional — only update fields that are provided):
  {
    name?: string
    eventType?: 'show' | 'rehearsal'
    eventAt?: string               -- ISO 8601 UTC
    callTimeOffset?: number | null -- minutes before event_at, null to clear
    durationMinutes?: number | null -- null to clear
    location?: string
    details?: string | null
    status?: 'scheduled' | 'cancelled'
  }

Validation:
  - name: if provided, non-empty, max 150 characters, trim
  - eventType: if provided, must be 'show' or 'rehearsal'
  - eventAt: if provided, must be valid ISO 8601, must not be in the past
    Exception: allow editing past events that are already past — only 
    reject if a NEW eventAt is set to a past time
  - callTimeOffset: if provided, must be a positive integer or null
    Reasonable max: 480 minutes (8 hours before event)
  - durationMinutes: if provided, must be a positive integer or null
    Reasonable max: 1440 minutes (24 hours)
  - status: if provided, must be 'scheduled' or 'cancelled'
  - details: if provided, max 1000 characters or null to clear
  - location: if provided, non-empty, max 200 characters

Only update columns that are explicitly included in the request body.
Use a dynamic SQL builder for the PATCH — do not overwrite unset fields.

Response (200): the updated event object

Error responses:
  - 400 for validation failures
  - 403 if user is not a member
  - 403 if user role is 'member'
  - 404 if event not found or deleted_at IS NOT NULL
  - 500 for unexpected errors

### New route: DELETE /api/troupes/:troupeId/events/:eventId
Soft delete an event. Owner only — organizers cannot delete.

Logic:
  UPDATE events SET deleted_at = NOW() WHERE id = $eventId 
  AND troupe_id = $troupeId AND deleted_at IS NULL

Response (200):
  { success: true }

Error responses:
  - 403 if user is not the owner
  - 404 if event not found or already deleted
  - 500 for unexpected errors

---

## Types
Update packages/server/src/types/troupe.ts:

  export type EventStatus = 'scheduled' | 'cancelled'

  export interface TroupeEvent {
    id: string
    name: string
    eventType: EventType
    eventAt: string
    callTime: string | null
    callTimeOffset: number | null
    durationMinutes: number | null
    durationFormatted: string | null
    location: string
    details: string | null
    status: EventStatus
    createdBy: string
  }

---

## Frontend

### Update AddEventModal.tsx
Add the new fields to the create event form:

  Call time offset:
    - Optional field
    - Dropdown select with preset options:
        None, 15 mins before, 30 mins before, 45 mins before, 
        1h before, 1h 30m before, 2h before
    - Stores the integer value (e.g. 30) not the label
    - Show the derived call time below the dropdown as a helper:
      "Cast called at 6:30 PM" (derived from eventAt - offset, 
      formatted in local timezone)
    - Only show the helper text when both eventAt and callTimeOffset 
      are set

  Duration:
    - Optional field
    - Dropdown select with preset options:
        None, 30m, 45m, 1h, 1h 30m, 2h, 2h 30m, 3h, 3h 30m, 4h
    - Stores the integer value in minutes (e.g. 90)

### New component: packages/client/src/components/EventModal.tsx
A single modal that handles both view and edit modes. Triggered by clicking 
any EventCard or FeedEventCard.

  Props:
    event: TroupeEvent
    troupeId: string
    currentUserRole: TroupeRole
    onClose(): void
    onUpdated(event: TroupeEvent): void
    onDeleted(eventId: string): void

  Mode logic:
    - If currentUserRole is 'owner' or 'organizer': render in edit mode
    - If currentUserRole is 'member': render in view mode
    - Edit mode and view mode use the same modal — toggle fields between 
      editable inputs and read-only display

  View mode displays:
    - Event name as the modal heading
    - Status badge: "Scheduled" (neutral) or "Cancelled" (red/destructive)
      If cancelled, show a prominent cancelled banner at the top
    - Event type badge
    - Date and time (local timezone, same Intl.DateTimeFormat pattern as EventCard)
    - Call time: if present, "Call time: 6:30 PM (30 mins before)"
      Derive the display time from eventAt and callTimeOffset
    - Duration: if present, "Duration: 1h 30m"
    - Location
    - Details (full text, no truncation)
    - Created by

  Edit mode displays:
    - All the same fields as view mode but as editable inputs
    - Pre-filled with current event values
    - Same field validation as AddEventModal
    - Call time offset dropdown (same presets as AddEventModal)
      Show derived call time helper text below
    - Duration dropdown (same presets as AddEventModal)
    - Status toggle: "Scheduled" / "Cancelled"
      When switching to Cancelled, show a warning:
      "Members will still be able to see this event as cancelled"
    - "Save Changes" button — disabled while submitting, disabled if 
      no fields have changed
    - Dirty state tracking — only submit fields that have changed
    - On success: call onUpdated with the updated event, close modal

  Delete (owner only — not organizer):
    - "Delete Event" button at the bottom of the modal in destructive styling
    - Only rendered if currentUserRole is 'owner'
    - On click: show an inline confirmation within the modal (do not open 
      a second modal):
        "Are you sure? This cannot be undone."
        Confirm and Cancel buttons
    - On confirm: call DELETE /api/troupes/:troupeId/events/:eventId
    - On success: call onDeleted with the eventId, close modal

  Use shadcn/ui Dialog component.
  Use shadcn/ui Badge for status and event type badges.

### Update EventCard.tsx
  - Add onClick prop that opens EventModal
  - Show status badge on the card: only show if status is 'cancelled'
    A cancelled card should be visually muted (reduced opacity or 
    greyed out) to distinguish it from scheduled events
  - Show call time if present: "Call: 6:30 PM"
  - Show duration if present: "1h 30m"

### Update FeedEventCard.tsx
  - Add onClick prop that opens EventModal
  - Show cancelled status badge if applicable, same muted styling

### Update useEvents.ts hook
  - Add updateEvent(troupeId, eventId, data): calls PATCH and returns 
    updated TroupeEvent
  - Add deleteEvent(troupeId, eventId): calls DELETE
  - On updateEvent success: update the event in the local events list 
    in place — do not refetch the entire list
  - On deleteEvent success: remove the event from the local events list 
    — do not refetch

### Update useEventFeed.ts hook
  - Add updateEvent and deleteEvent in the same pattern as useEvents.ts
  - On updateEvent: update in place in the feed list
  - On deleteEvent: remove from the feed list

---

## CLAUDE.md
Update CLAUDE.md:
  - Add the following conventions:

    ### Event fields
    - call_time_offset stores minutes before event_at — never store absolute 
      call time in the database
    - callTime in API responses is always derived: event_at - call_time_offset
    - durationFormatted is always derived server-side via formatDuration()
    - All event queries must filter WHERE deleted_at IS NULL
    - deleted_at IS NOT NULL is a soft delete — never hard delete events
    - status is an extensible text field with a CHECK constraint —
      add new statuses via migration, not application code changes

    ### Event permissions
    - Owners and organizers can create and edit events
    - Only owners can delete events (soft delete)
    - Members can only view events
    - Permission is always checked server-side via troupe_members

---

## Constraints
  - call_time_offset is always stored as minutes — never store absolute 
    call time in the database
  - All event deletes are soft deletes — never hard delete
  - All event queries must filter WHERE deleted_at IS NULL
  - Dynamic PATCH SQL — never overwrite fields not included in the request
  - Dirty state tracking in EventModal — only send changed fields to the API
  - Delete is owner only — organizers can edit but not delete
  - Do not build event attendance, notifications, or any other features
  - Mobile-first on all new components