Add an upcoming events feed to the home page of the Troupe app. This builds 
on Phase 3. Do not build any other features.

## Backend

### New route: GET /api/events
Return paginated upcoming events across all troupes the authenticated user 
belongs to. Optionally filtered by a single troupe.

Query parameters:
  - cursor (optional, string) — base64 encoded event_at + id of the last 
    record returned
  - troupeId (optional, string) — filter events to a single troupe. Must be 
    a troupe the requesting user is a member of — return 403 if not.
  - limit (optional, number) — defaults to 10, max 10

Logic:
  - Only return events where event_at >= NOW()
  - Only return events from troupes the requesting user is a member of
  - If troupeId is provided, additionally filter to that troupe only
  - Order ASC by event_at, then id (for stable cursor pagination)
  - Use a single SQL query with JOINs across events, troupes, and 
    troupe_members — do not make multiple queries

Response (200):
  {
    events: [
      {
        id: string
        name: string
        eventType: 'show' | 'rehearsal'
        eventAt: string               -- ISO 8601 UTC
        location: string
        details: string | null
        troupe: {
          id: string
          name: string
          hasBadge: boolean
        }
      }
    ],
    nextCursor: string | null
  }

Note: each event includes its troupe summary so the frontend can display 
the troupe badge and name inline without a separate fetch.

Error responses:
  - 403 if troupeId is provided but the user is not a member of that troupe
  - 500 for unexpected errors

### Register route
Mount in the main Express app:
  app.use('/api/events', eventsRouter)

This is a separate router from /api/troupes/:troupeId/events — do not 
combine them.

---

## Types
Add to packages/server/src/types/troupe.ts:

  export interface FeedEvent {
    id: string
    name: string
    eventType: EventType
    eventAt: string
    location: string
    details: string | null
    troupe: {
      id: string
      name: string
      hasBadge: boolean
    }
  }

  export interface EventFeedResponse {
    events: FeedEvent[]
    nextCursor: string | null
  }

---

## Frontend

### New hook: packages/client/src/hooks/useEventFeed.ts
Manages the paginated home feed with optional troupe filtering:

  State:
    - events: FeedEvent[]
    - nextCursor: string | null
    - hasMore: boolean
    - loading: boolean
    - loadingMore: boolean       -- separate flag for pagination vs initial load
    - error: string | null
    - activeTroupeId: string | null

  Functions:
    - fetchFeed(troupeId?: string): fetches the first page, resets the 
      event list. Sets activeTroupeId.
    - fetchMore(): fetches the next page using nextCursor, appends to 
      existing events list
    - When troupeId changes, reset the list and fetch from the beginning

  Behaviour:
    - On mount, fetch with no troupeId filter (all troupes)
    - Changing the active troupe chip resets the list and triggers a 
      fresh fetch with the new troupeId
    - Appends new pages to the existing list on fetchMore

### New component: packages/client/src/components/TroupeFilterChips.tsx
A horizontal scrollable row of filter chips:

  Props:
    troupes: TroupeSummary[]
    activeTroupeId: string | null
    onChange(troupeId: string | null): void

  Behaviour:
    - First chip is always "All" — active when activeTroupeId is null
    - One chip per troupe the user belongs to
    - Each chip shows: TroupeBadge (size="thumbnail") + troupe name
    - Active chip is visually distinct (filled/highlighted)
    - Inactive chips are outlined/muted
    - Horizontally scrollable on mobile, wraps on desktop
    - Tapping a chip that is already active deselects it (returns to "All")
    - Smooth scroll behaviour — snap to the active chip when it changes
    - No "show more" — all troupes visible via scroll (max 5 troupes per 
      product limits)

### New component: packages/client/src/components/FeedEventCard.tsx
Displays a single event in the home feed. Different from EventCard (used in 
troupe detail) because it must show troupe context:

  Shows:
    - TroupeBadge (size="thumbnail") + troupe name in a small header line
      above the event details
    - Event name (prominent)
    - Event type badge: "Show" or "Rehearsal"
    - Date and time in the user's local timezone using Intl.DateTimeFormat
    - Location
  
  Does not show:
    - Details (keep the feed scannable — details are on the troupe detail page)
  
  Tapping the card navigates to /troupes/:troupeId (the troupe detail page)
  Use shadcn/ui Card as the base.

### Update: packages/client/src/pages/Home.tsx
Below the existing troupes section, add an "Upcoming Events" section:

  Layout:
    - Section heading: "Upcoming Events"
    - TroupeFilterChips immediately below the heading
    - Vertical list of FeedEventCard components below the chips
    - Infinite scroll: IntersectionObserver sentinel after the last card,
      same pattern as troupe detail page — do not use a third party library
    - Loading skeleton (3 placeholder cards) on initial fetch
    - Per-page loading spinner at the bottom while fetching more
    - Empty state when no events:
        - If "All" is active: "No upcoming events across your troupes"
        - If a troupe is active: "No upcoming events for [troupe name]"

  Loading behaviour:
    - The troupes section and events section load independently
    - Do not block the events feed on the troupes list loading
    - TroupeFilterChips only renders once troupes have loaded — show a 
      skeleton row of 3 placeholder chips while loading

  Data sharing:
    - The troupes list is already fetched by useTroupes for the troupes 
      section — pass the same troupes data down to TroupeFilterChips 
      rather than fetching again
    - Do not fetch the troupes list twice

---

## CLAUDE.md
Update CLAUDE.md:
  - Add the following conventions:

### Event feed
- GET /api/events is the global cross-troupe feed for the home page
- GET /api/troupes/:troupeId/events is the per-troupe feed for the 
    troupe detail page
- Troupe filtering on the home feed is always done server-side via 
    troupeId query param — never filter events in the frontend
- FeedEventCard and EventCard are separate components — FeedEventCard 
    includes troupe context, EventCard does not
- TroupeFilterChips receives troupes from the existing useTroupes hook — 
    never fetch troupes separately just for the filter

---

## Constraints
  - Filtering is always server-side — never filter or sort events in the 
    frontend
  - The troupes list must not be fetched twice on the home page
  - Cursor-based pagination only — no offset
  - IntersectionObserver for infinite scroll — no third party libraries
  - FeedEventCard does not show event details — keep the feed scannable
  - Tapping a FeedEventCard navigates to the troupe detail page, not an 
    event detail page
  - Mobile-first on all new components
  - Do not build event detail pages, notifications, or any other features