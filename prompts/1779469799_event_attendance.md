Add event attendance functionality and redesign the event details modal in the 
Troupe app. This builds on the previous event work. Do not build notifications 
or any other features.

## Database
Create a new migration file: db/migrations/007_create_event_attendance.sql

### event_attendance table
  - id (UUID, PK, default gen_random_uuid())
  - event_id (UUID, FK → events.id, on delete cascade, not null)
  - user_id (UUID, FK → users.id, on delete cascade, not null)
  - status (text, not null)
    CHECK (status IN ('attending', 'not_attending', 'maybe', 'late'))
  - updated_at (timestamptz, default now())
  - created_at (timestamptz, default now())
  - UNIQUE constraint on (event_id, user_id) — one response per user per event
  - Add updated_at trigger (reuse existing update_updated_at() function)

  Indexes:
    - CREATE INDEX ON event_attendance (event_id, status)

### Down migration
  DROP TABLE IF EXISTS event_attendance;

---

## Backend

### Update event response shape
All routes returning event data must now include attendance summary and the 
requesting user's own attendance status:

  {
    ...existing event fields...
    attendance: {
      attending: AttendeeChip[]
      notAttending: AttendeeChip[]
      maybe: AttendeeChip[]
      late: AttendeeChip[]
      noResponse: AttendeeChip[]
      counts: {
        attending: number
        notAttending: number
        maybe: number
        late: number
        noResponse: number
        total: number           -- total troupe members
      }
    }
    currentUserAttendance: 'attending' | 'not_attending' | 'maybe' | 'late' | null
    -- null means no response yet
  }

### AttendeeChip type
  {
    userId: string
    displayName: string
    initials: string        -- first letter of first + last word of displayName, 
                            -- uppercase. e.g. "John Smith" → "JS", "Cher" → "C"
  }

  Initials derivation should happen server-side in a helper:
  packages/server/src/lib/initials.ts

  export function getInitials(displayName: string): string {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

### Attendance query strategy
  When fetching event data, use a single SQL query that:
    1. Fetches the event row
    2. LEFT JOINs event_attendance to get all responses for this event
    3. LEFT JOINs troupe_members + users to get all troupe members 
       (for noResponse calculation)
    4. Groups and aggregates in SQL — do not process attendance in 
       application code
    5. Filters WHERE events.deleted_at IS NULL

  noResponse members = troupe members who have no row in event_attendance 
  for this event.

### New route: PUT /api/troupes/:troupeId/events/:eventId/attendance
Set or update the requesting user's attendance status.
Any troupe member (owner, organizer, member) can set their own attendance.

Request body:
  { status: 'attending' | 'not_attending' | 'maybe' | 'late' | null }
  -- null clears the response, returning the user to "no response"

Logic (use INSERT ... ON CONFLICT DO UPDATE for upsert):
  INSERT INTO event_attendance (event_id, user_id, status)
  VALUES ($eventId, $userId, $status)
  ON CONFLICT (event_id, user_id) 
  DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()

  If status is null, DELETE the row instead (clear response).

  Verify the user is a troupe member before allowing attendance update.
  Verify the event exists and is not deleted.
  Do not allow attendance updates on cancelled events — return 409.

Response (200): updated attendance summary in the same shape as above

Error responses:
  - 400 if status is not a valid value
  - 403 if user is not a troupe member
  - 404 if event not found or deleted
  - 409 if event is cancelled
  - 500 for unexpected errors

### Register route
  app.use('/api/troupes', attendanceRouter)
  -- resolves to PUT /api/troupes/:troupeId/events/:eventId/attendance

---

## Types
Add to packages/server/src/types/troupe.ts:

  export type AttendanceStatus = 
    'attending' | 'not_attending' | 'maybe' | 'late'

  export interface AttendeeChip {
    userId: string
    displayName: string
    initials: string
  }

  export interface AttendanceSummary {
    attending: AttendeeChip[]
    notAttending: AttendeeChip[]
    maybe: AttendeeChip[]
    late: AttendeeChip[]
    noResponse: AttendeeChip[]
    counts: {
      attending: number
      notAttending: number
      maybe: number
      late: number
      noResponse: number
      total: number
    }
  }

  -- Update TroupeEvent:
  export interface TroupeEvent {
    ...existing fields...
    attendance: AttendanceSummary
    currentUserAttendance: AttendanceStatus | null
  }

---

## Frontend

### New component: packages/client/src/components/AttendeeChipList.tsx
Displays a group of attendee chips with a label and count.

  Props:
    label: string               -- e.g. "Attending", "Maybe", "Late"
    attendees: AttendeeChip[]
    colorScheme: 'green' | 'red' | 'yellow' | 'blue' | 'neutral'
    maxVisible?: number         -- default 8, show "+N more" after this

  Behaviour:
    - Render a row of circular avatar chips, each showing initials
    - Each chip has a consistent colour derived from the userId 
      (same hash approach as TroupeBadge placeholder)
    - Chips have a tooltip on hover showing the full display name
    - If attendees.length > maxVisible, show the last chip as "+N more"
      in a neutral style
    - If attendees.length === 0, render nothing (do not show the row)
    - Label and count shown above the chip row:
      "Attending · 4" in the appropriate colour

### New component: packages/client/src/components/AttendanceToggle.tsx
A segmented control for setting the current user's attendance status.

  Props:
    value: AttendanceStatus | null
    onChange(status: AttendanceStatus | null): void
    loading: boolean
    disabled: boolean           -- true if event is cancelled

  Four options displayed as a segmented button group:
    - Attending   (green)
    - Maybe       (yellow)
    - Late        (blue)
    - Not Attending (red/muted)

  Behaviour:
    - Active option is filled/highlighted in its colour
    - Inactive options are outlined/muted
    - Tapping the active option deselects it (sets to null — no response)
    - Show a loading spinner on the active button while the API call 
      is in progress
    - Disabled state when event is cancelled: all options greyed out
      with tooltip "Cannot update attendance for a cancelled event"
    - Mobile-friendly tap targets — minimum 44px height

### Redesign: EventModal.tsx
Replace the current EventModal with a two-panel design:

  The modal now has two views:
    View A — Event Details (default)
    View B — Edit Event (owners/organizers only, replaces current edit form)

  Navigation:
    - View A shows an "Edit Event" button in the modal header — only 
      rendered for owners and organizers
    - Clicking "Edit Event" slides to View B
    - View B has a "← Back" button that returns to View A
    - Do not open a second modal — animate between views within the 
      same Dialog

  View A — Event Details layout:

    Header:
      - Event name as the modal title
      - Status badge (Scheduled / Cancelled)
      - "Edit Event" button (owner/organizer only)
      - Close button

    Section 1 — Event Info:
      - Event type badge
      - Date and time (local timezone)
      - Call time (if set): "Call time: 6:30 PM (30 mins before)"
      - Duration (if set): "Duration: 1h 30m"
      - Location
      - Details (full text, no truncation)
      - Created by

    Section 2 — Your Attendance:
      - Heading: "Are you going?"
      - AttendanceToggle component
        - Pre-set to currentUserAttendance
        - On change: call PUT .../attendance optimistically
          Update currentUserAttendance and attendance counts immediately
          in local state, then confirm or roll back based on API response
        - Hidden if event is deleted (should never happen but guard anyway)

    Section 3 — Attendance Summary:
      - Heading: "Who's coming · {counts.total} members"
      - Four AttendeeChipList rows in this order:
          Attending   (green)   -- counts.attending
          Late        (blue)    -- counts.late
          Maybe       (yellow)  -- counts.maybe
          Not Attending (red)   -- counts.notAttending
      - Below the chip rows, a collapsed "No response · N" section:
          Tapping it expands to show noResponse chips
          Default collapsed to keep the modal clean
      - If all members have responded, do not show the no response section

  View B — Edit Event:
    - Identical to the current edit form in EventModal
    - "Delete Event" button at the bottom (owner only)
      with inline confirmation as currently implemented
    - On save success: return to View A with updated event data
    - On delete success: close the entire modal and call onDeleted

  Use shadcn/ui Dialog component.
  Use CSS transitions (translate-x) to animate between View A and View B
  within the same Dialog — do not unmount View B when showing View A,
  use opacity + pointer-events to hide it so form state is preserved
  if the user navigates back.

### Update useEvents.ts hook
  Add:
    updateAttendance(troupeId, eventId, status: AttendanceStatus | null):
      - Optimistically update the event's attendance in local state
      - Call PUT .../attendance
      - On error: roll back to previous state and show error message
      - On success: update with server response (source of truth)

### Update useEventFeed.ts hook
  Same updateAttendance pattern as useEvents.ts.

### Update EventCard.tsx
  Show a compact attendance indicator on the card:
    - If currentUserAttendance is set: show a small coloured dot + label
      e.g. green dot + "Attending", blue dot + "Late"
    - If no response: show a neutral "Respond" prompt in muted text
    - Attendance counts summary in small text below event details:
      e.g. "4 attending · 2 maybe · 1 late"
      Only show counts that are > 0

### Update FeedEventCard.tsx
  Same compact attendance indicator as EventCard.tsx.

---

## CLAUDE.md
Update CLAUDE.md:
  - Add the following conventions:

    ### Attendance
    - Attendance statuses: attending, not_attending, maybe, late
    - null attendance = no response (not stored, derived from absence of row)
    - Upsert attendance with INSERT ... ON CONFLICT DO UPDATE
    - null status in PUT body clears the row (DELETE)
    - Attendance cannot be set on cancelled events
    - Attendance updates are optimistic — roll back on API error
    - Initials are always derived server-side via getInitials() helper
    - noResponse is derived server-side: troupe members with no attendance row
    - AttendeeChipList renders nothing when the attendees array is empty

---

## Constraints
  - Attendance upsert uses INSERT ... ON CONFLICT — never SELECT then INSERT
  - noResponse list is calculated server-side in SQL — never in the frontend
  - Optimistic updates with rollback for attendance toggle
  - Cancelled events block attendance updates (409 from API, disabled UI)
  - View A and View B animate within a single Dialog — never two modals
  - View B is hidden with CSS not unmounted — preserves form state
  - Mobile-first on all new components — AttendanceToggle must have 
    44px minimum tap targets
  - Do not build attendance history, notifications, or any other features