import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { query } from '../db';
import { EventType, TroupeEvent, TroupeRole } from '../types/troupe';

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

async function getMembership(
  troupeId: string,
  userId: string,
): Promise<{ exists: boolean; role: TroupeRole | null }> {
  interface TroupeRow { id: string }
  const troupeRows = await query<TroupeRow>('SELECT id FROM troupes WHERE id = $1', [troupeId]);
  if (troupeRows.length === 0) return { exists: false, role: null };

  interface MemberRow { role: TroupeRole }
  const memberRows = await query<MemberRow>(
    'SELECT role FROM troupe_members WHERE troupe_id = $1 AND user_id = $2',
    [troupeId, userId],
  );
  return { exists: true, role: memberRows[0]?.role ?? null };
}

router.get('/:troupeId/events', async (req, res) => {
  try {
    const { troupeId } = req.params;
    const userId = req.user!.id;

    const { exists, role } = await getMembership(troupeId, userId);
    if (!exists) {
      res.status(404).json({ error: { message: 'Troupe not found' } });
      return;
    }
    if (!role) {
      res.status(403).json({ error: { message: 'You are not a member of this troupe' } });
      return;
    }

    const type = req.query.type === 'past' ? 'past' : 'upcoming';
    const limitParam = parseInt(req.query.limit as string, 10);
    const limit = Math.min(isNaN(limitParam) ? 10 : limitParam, 10);
    const cursorParam = req.query.cursor as string | undefined;

    interface EventRow {
      id: string;
      name: string;
      event_type: EventType;
      event_at: Date;
      location: string;
      details: string | null;
      created_by: string;
    }

    let rows: EventRow[];

    if (type === 'upcoming') {
      if (cursorParam) {
        const { eventAt, id } = decodeCursor(cursorParam);
        rows = await query<EventRow>(
          `SELECT e.id, e.name, e.event_type, e.event_at, e.location, e.details,
                  COALESCE(u.display_name, 'Unknown') AS created_by
           FROM events e
           JOIN users u ON u.id = e.created_by
           WHERE e.troupe_id = $1
             AND e.event_at >= NOW()
             AND (e.event_at > $2::timestamptz OR (e.event_at = $2::timestamptz AND e.id > $3::uuid))
           ORDER BY e.event_at ASC, e.id ASC
           LIMIT $4`,
          [troupeId, eventAt, id, limit + 1],
        );
      } else {
        rows = await query<EventRow>(
          `SELECT e.id, e.name, e.event_type, e.event_at, e.location, e.details,
                  COALESCE(u.display_name, 'Unknown') AS created_by
           FROM events e
           JOIN users u ON u.id = e.created_by
           WHERE e.troupe_id = $1 AND e.event_at >= NOW()
           ORDER BY e.event_at ASC, e.id ASC
           LIMIT $2`,
          [troupeId, limit + 1],
        );
      }
    } else {
      if (cursorParam) {
        const { eventAt, id } = decodeCursor(cursorParam);
        rows = await query<EventRow>(
          `SELECT e.id, e.name, e.event_type, e.event_at, e.location, e.details,
                  COALESCE(u.display_name, 'Unknown') AS created_by
           FROM events e
           JOIN users u ON u.id = e.created_by
           WHERE e.troupe_id = $1
             AND e.event_at < NOW()
             AND (e.event_at < $2::timestamptz OR (e.event_at = $2::timestamptz AND e.id < $3::uuid))
           ORDER BY e.event_at DESC, e.id DESC
           LIMIT $4`,
          [troupeId, eventAt, id, limit + 1],
        );
      } else {
        rows = await query<EventRow>(
          `SELECT e.id, e.name, e.event_type, e.event_at, e.location, e.details,
                  COALESCE(u.display_name, 'Unknown') AS created_by
           FROM events e
           JOIN users u ON u.id = e.created_by
           WHERE e.troupe_id = $1 AND e.event_at < NOW()
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

    const events: TroupeEvent[] = pageRows.map((row) => ({
      id: row.id,
      name: row.name,
      eventType: row.event_type,
      eventAt: row.event_at.toISOString(),
      location: row.location,
      details: row.details,
      createdBy: row.created_by,
    }));

    res.json({ events, nextCursor });
  } catch {
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.post('/:troupeId/events', async (req, res) => {
  try {
    const { troupeId } = req.params;
    const userId = req.user!.id;

    const { exists, role } = await getMembership(troupeId, userId);
    if (!exists) {
      res.status(404).json({ error: { message: 'Troupe not found' } });
      return;
    }
    if (!role) {
      res.status(403).json({ error: { message: 'You are not a member of this troupe' } });
      return;
    }
    if (role === 'member') {
      res.status(403).json({ error: { message: 'Only owners and organizers can create events' } });
      return;
    }

    const { name, eventType, eventAt, location, details } = req.body as {
      name?: unknown;
      eventType?: unknown;
      eventAt?: unknown;
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

    interface EventRow {
      id: string;
      name: string;
      event_type: EventType;
      event_at: Date;
      location: string;
      details: string | null;
    }

    const [event] = await query<EventRow>(
      `INSERT INTO events (troupe_id, created_by, name, event_type, event_at, location, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, event_type, event_at, location, details`,
      [troupeId, userId, name.trim(), eventType, eventDate.toISOString(), location.trim(), trimmedDetails],
    );

    interface UserRow { display_name: string | null }
    const [creator] = await query<UserRow>('SELECT display_name FROM users WHERE id = $1', [userId]);

    const response: TroupeEvent = {
      id: event.id,
      name: event.name,
      eventType: event.event_type,
      eventAt: event.event_at.toISOString(),
      location: event.location,
      details: event.details,
      createdBy: creator.display_name ?? 'Unknown',
    };

    res.status(201).json(response);
  } catch {
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

export default router;
