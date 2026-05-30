import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireTroupeMember } from '../middleware/requireTroupeMember';
import { query } from '../db';
import { EventType, EventStatus, TroupeEvent, AttendanceStatus } from '../types/troupe';
import { formatDuration, deriveCallTime } from '../lib/formatDuration';
import { fetchAttendance, EventAttendanceData, EMPTY_ATTENDANCE, VALID_ATTENDANCE_STATUSES } from '../lib/attendance';

const router = Router({ mergeParams: true });
router.use(requireAuth);

function encodeCursor(eventAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ eventAt: eventAt.toISOString(), id })).toString('base64');
}

function decodeCursor(cursor: string): { eventAt: string; id: string } {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as { eventAt: string; id: string };
  } catch {
    throw new Error('Invalid cursor');
  }
}


interface EventRow {
  id: string;
  name: string;
  event_type: EventType;
  event_at: Date;
  call_time_offset: number | null;
  duration_minutes: number | null;
  location: string;
  details: string | null;
  status: EventStatus;
  created_by: string;
}

function rowToEvent(row: EventRow, attendanceData: EventAttendanceData): TroupeEvent {
  return {
    id: row.id,
    name: row.name,
    eventType: row.event_type,
    eventAt: row.event_at.toISOString(),
    callTime: row.call_time_offset != null
      ? deriveCallTime(row.event_at, row.call_time_offset).toISOString()
      : null,
    callTimeOffset: row.call_time_offset,
    durationMinutes: row.duration_minutes,
    durationFormatted: row.duration_minutes != null ? formatDuration(row.duration_minutes) : null,
    location: row.location,
    details: row.details,
    status: row.status,
    createdBy: row.created_by,
    attendance: attendanceData.attendance,
    currentUserAttendance: attendanceData.currentUserAttendance,
  };
}

const EVENT_SELECT = `
  e.id, e.name, e.event_type, e.event_at, e.call_time_offset, e.duration_minutes,
  e.location, e.details, e.status,
  COALESCE(u.display_name, 'Unknown') AS created_by
`;

router.get('/:troupeId/events', requireTroupeMember(), async (req, res) => {
  try {
    const { troupeId } = req.params;
    const userId = req.user!.id;

    const type = req.query.type === 'past' ? 'past' : 'upcoming';
    const limitParam = parseInt(req.query.limit as string, 10);
    const limit = Math.min(isNaN(limitParam) ? 10 : limitParam, 10);
    const cursorParam = req.query.cursor as string | undefined;

    let rows: EventRow[];

    if (type === 'upcoming') {
      if (cursorParam) {
        const { eventAt, id } = decodeCursor(cursorParam);
        rows = await query<EventRow>(
          `SELECT ${EVENT_SELECT}
           FROM events e
           JOIN users u ON u.id = e.created_by
           WHERE e.troupe_id = $1
             AND e.deleted_at IS NULL
             AND e.event_at >= NOW()
             AND (e.event_at > $2::timestamptz OR (e.event_at = $2::timestamptz AND e.id > $3::uuid))
           ORDER BY e.event_at ASC, e.id ASC
           LIMIT $4`,
          [troupeId, eventAt, id, limit + 1],
        );
      } else {
        rows = await query<EventRow>(
          `SELECT ${EVENT_SELECT}
           FROM events e
           JOIN users u ON u.id = e.created_by
           WHERE e.troupe_id = $1
             AND e.deleted_at IS NULL
             AND e.event_at >= NOW()
           ORDER BY e.event_at ASC, e.id ASC
           LIMIT $2`,
          [troupeId, limit + 1],
        );
      }
    } else {
      if (cursorParam) {
        const { eventAt, id } = decodeCursor(cursorParam);
        rows = await query<EventRow>(
          `SELECT ${EVENT_SELECT}
           FROM events e
           JOIN users u ON u.id = e.created_by
           WHERE e.troupe_id = $1
             AND e.deleted_at IS NULL
             AND e.event_at < NOW()
             AND (e.event_at < $2::timestamptz OR (e.event_at = $2::timestamptz AND e.id < $3::uuid))
           ORDER BY e.event_at DESC, e.id DESC
           LIMIT $4`,
          [troupeId, eventAt, id, limit + 1],
        );
      } else {
        rows = await query<EventRow>(
          `SELECT ${EVENT_SELECT}
           FROM events e
           JOIN users u ON u.id = e.created_by
           WHERE e.troupe_id = $1
             AND e.deleted_at IS NULL
             AND e.event_at < NOW()
           ORDER BY e.event_at DESC, e.id DESC
           LIMIT $2`,
          [troupeId, limit + 1],
        );
      }
    }

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor = hasMore && lastRow ? encodeCursor(lastRow.event_at, lastRow.id) : null;

    const attendanceMap = await fetchAttendance(pageRows.map((r) => r.id), userId);

    res.json({
      events: pageRows.map((r) => rowToEvent(r, attendanceMap.get(r.id) ?? EMPTY_ATTENDANCE)),
      nextCursor,
    });
  } catch (err) {
    console.error('[GET /troupes/:troupeId/events]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.post('/:troupeId/events', requireTroupeMember('organizer'), async (req, res) => {
  try {
    const { troupeId } = req.params;
    const userId = req.user!.id;

    const { name, eventType, eventAt, callTimeOffset, durationMinutes, location, details } = req.body as {
      name?: unknown;
      eventType?: unknown;
      eventAt?: unknown;
      callTimeOffset?: unknown;
      durationMinutes?: unknown;
      location?: unknown;
      details?: unknown;
    };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: { message: 'name is required' } });
      return;
    }
    if (name.trim().length > 150) {
      res.status(400).json({ error: { message: 'name must be 150 characters or fewer' } });
      return;
    }
    if (eventType !== 'show' && eventType !== 'rehearsal') {
      res.status(400).json({ error: { message: 'eventType must be "show" or "rehearsal"' } });
      return;
    }
    if (!eventAt || typeof eventAt !== 'string') {
      res.status(400).json({ error: { message: 'eventAt is required' } });
      return;
    }
    const eventDate = new Date(eventAt);
    if (isNaN(eventDate.getTime())) {
      res.status(400).json({ error: { message: 'eventAt must be a valid ISO 8601 date' } });
      return;
    }
    if (eventDate <= new Date()) {
      res.status(400).json({ error: { message: 'eventAt must be in the future' } });
      return;
    }
    if (callTimeOffset !== undefined && callTimeOffset !== null) {
      if (typeof callTimeOffset !== 'number' || !Number.isInteger(callTimeOffset) || callTimeOffset <= 0 || callTimeOffset > 480) {
        res.status(400).json({ error: { message: 'callTimeOffset must be a positive integer up to 480' } });
        return;
      }
    }
    if (durationMinutes !== undefined && durationMinutes !== null) {
      if (typeof durationMinutes !== 'number' || !Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
        res.status(400).json({ error: { message: 'durationMinutes must be a positive integer up to 1440' } });
        return;
      }
    }
    if (!location || typeof location !== 'string' || location.trim().length === 0) {
      res.status(400).json({ error: { message: 'location is required' } });
      return;
    }
    if (location.trim().length > 200) {
      res.status(400).json({ error: { message: 'location must be 200 characters or fewer' } });
      return;
    }
    if (details !== undefined && typeof details === 'string' && details.trim().length > 1000) {
      res.status(400).json({ error: { message: 'details must be 1000 characters or fewer' } });
      return;
    }

    const trimmedDetails =
      details && typeof details === 'string' && details.trim().length > 0
        ? details.trim()
        : null;

    const [event] = await query<EventRow>(
      `INSERT INTO events (troupe_id, created_by, name, event_type, event_at, call_time_offset, duration_minutes, location, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, event_type, event_at, call_time_offset, duration_minutes, location, details, status,
                 (SELECT COALESCE(display_name, 'Unknown') FROM users WHERE id = $2) AS created_by`,
      [
        troupeId,
        userId,
        name.trim(),
        eventType,
        eventDate.toISOString(),
        callTimeOffset ?? null,
        durationMinutes ?? null,
        location.trim(),
        trimmedDetails,
      ],
    );

    const attendanceMap = await fetchAttendance([event.id], userId);
    res.status(201).json(rowToEvent(event, attendanceMap.get(event.id) ?? EMPTY_ATTENDANCE));
  } catch (err) {
    console.error('[POST /troupes/:troupeId/events]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.patch('/:troupeId/events/:eventId', requireTroupeMember('organizer'), async (req, res) => {
  try {
    const { troupeId, eventId } = req.params;
    const userId = req.user!.id;

    interface EventCheck { id: string }
    const existing = await query<EventCheck>(
      'SELECT id FROM events WHERE id = $1 AND troupe_id = $2 AND deleted_at IS NULL',
      [eventId, troupeId],
    );
    if (existing.length === 0) {
      res.status(404).json({ error: { message: 'Event not found' } });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const setClauses: string[] = [];
    const params: unknown[] = [];

    const addField = (col: string, value: unknown) => {
      params.push(value);
      setClauses.push(`${col} = $${params.length}`);
    };

    if ('name' in body) {
      const name = body.name;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: { message: 'name must not be empty' } });
        return;
      }
      if (name.trim().length > 150) {
        res.status(400).json({ error: { message: 'name must be 150 characters or fewer' } });
        return;
      }
      addField('name', name.trim());
    }

    if ('eventType' in body) {
      const eventType = body.eventType;
      if (eventType !== 'show' && eventType !== 'rehearsal') {
        res.status(400).json({ error: { message: 'eventType must be "show" or "rehearsal"' } });
        return;
      }
      addField('event_type', eventType);
    }

    if ('eventAt' in body) {
      const eventAt = body.eventAt;
      if (!eventAt || typeof eventAt !== 'string') {
        res.status(400).json({ error: { message: 'eventAt must be a valid ISO 8601 date' } });
        return;
      }
      const eventDate = new Date(eventAt);
      if (isNaN(eventDate.getTime())) {
        res.status(400).json({ error: { message: 'eventAt must be a valid ISO 8601 date' } });
        return;
      }
      if (eventDate <= new Date()) {
        res.status(400).json({ error: { message: 'eventAt must not be in the past' } });
        return;
      }
      addField('event_at', eventDate.toISOString());
    }

    if ('callTimeOffset' in body) {
      const callTimeOffset = body.callTimeOffset;
      if (callTimeOffset !== null) {
        if (typeof callTimeOffset !== 'number' || !Number.isInteger(callTimeOffset) || callTimeOffset <= 0 || callTimeOffset > 480) {
          res.status(400).json({ error: { message: 'callTimeOffset must be a positive integer up to 480' } });
          return;
        }
      }
      addField('call_time_offset', callTimeOffset);
    }

    if ('durationMinutes' in body) {
      const durationMinutes = body.durationMinutes;
      if (durationMinutes !== null) {
        if (typeof durationMinutes !== 'number' || !Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
          res.status(400).json({ error: { message: 'durationMinutes must be a positive integer up to 1440' } });
          return;
        }
      }
      addField('duration_minutes', durationMinutes);
    }

    if ('location' in body) {
      const location = body.location;
      if (!location || typeof location !== 'string' || location.trim().length === 0) {
        res.status(400).json({ error: { message: 'location must not be empty' } });
        return;
      }
      if (location.trim().length > 200) {
        res.status(400).json({ error: { message: 'location must be 200 characters or fewer' } });
        return;
      }
      addField('location', location.trim());
    }

    if ('details' in body) {
      const details = body.details;
      if (details !== null) {
        if (typeof details !== 'string') {
          res.status(400).json({ error: { message: 'details must be a string or null' } });
          return;
        }
        if (details.trim().length > 1000) {
          res.status(400).json({ error: { message: 'details must be 1000 characters or fewer' } });
          return;
        }
        addField('details', details.trim() || null);
      } else {
        addField('details', null);
      }
    }

    if ('status' in body) {
      const status = body.status;
      if (status !== 'scheduled' && status !== 'cancelled') {
        res.status(400).json({ error: { message: 'status must be "scheduled" or "cancelled"' } });
        return;
      }
      addField('status', status);
    }

    if (setClauses.length === 0) {
      res.status(400).json({ error: { message: 'No fields to update' } });
      return;
    }

    params.push(eventId, troupeId);
    const idParam = params.length - 1;
    const troupeParam = params.length;

    const [updated] = await query<EventRow>(
      `UPDATE events SET ${setClauses.join(', ')}
       WHERE id = $${idParam} AND troupe_id = $${troupeParam} AND deleted_at IS NULL
       RETURNING id, name, event_type, event_at, call_time_offset, duration_minutes, location, details, status,
                 (SELECT COALESCE(display_name, 'Unknown') FROM users WHERE id = events.created_by) AS created_by`,
      params,
    );

    const attendanceMap = await fetchAttendance([updated.id], userId);
    res.json(rowToEvent(updated, attendanceMap.get(updated.id) ?? EMPTY_ATTENDANCE));
  } catch (err) {
    console.error('[PATCH /troupes/:troupeId/events/:eventId]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.delete('/:troupeId/events/:eventId', requireTroupeMember('owner'), async (req, res) => {
  try {
    const { troupeId, eventId } = req.params;

    interface DeletedRow { id: string }
    const rows = await query<DeletedRow>(
      `UPDATE events SET deleted_at = NOW()
       WHERE id = $1 AND troupe_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [eventId, troupeId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: { message: 'Event not found' } });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /troupes/:troupeId/events/:eventId]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.put('/:troupeId/events/:eventId/attendance', requireTroupeMember(), async (req, res) => {
  try {
    const { troupeId, eventId } = req.params;
    const userId = req.user!.id;

    const { status } = req.body as { status?: unknown };
    if (status !== null && status !== undefined && !VALID_ATTENDANCE_STATUSES.includes(status as AttendanceStatus)) {
      res.status(400).json({ error: { message: 'status must be attending, not_attending, maybe, late, or null' } });
      return;
    }

    interface EventCheck { id: string; status: EventStatus }
    const eventRows = await query<EventCheck>(
      'SELECT id, status FROM events WHERE id = $1 AND troupe_id = $2 AND deleted_at IS NULL',
      [eventId, troupeId],
    );
    if (eventRows.length === 0) {
      res.status(404).json({ error: { message: 'Event not found' } });
      return;
    }
    if (eventRows[0].status === 'cancelled') {
      res.status(409).json({ error: { message: 'Cannot update attendance for a cancelled event' } });
      return;
    }

    if (status === null || status === undefined) {
      await query('DELETE FROM event_attendance WHERE event_id = $1 AND user_id = $2', [eventId, userId]);
    } else {
      await query(
        `INSERT INTO event_attendance (event_id, user_id, status)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id, user_id)
         DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
        [eventId, userId, status],
      );
    }

    const attendanceMap = await fetchAttendance([eventId], userId);
    const data = attendanceMap.get(eventId) ?? EMPTY_ATTENDANCE;
    res.json({ attendance: data.attendance, currentUserAttendance: data.currentUserAttendance });
  } catch (err) {
    console.error('[PUT /troupes/:troupeId/events/:eventId/attendance]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

export default router;
