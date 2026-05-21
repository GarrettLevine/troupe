import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { query } from '../db';
import { EventType, FeedEvent } from '../types/troupe';

const router = Router();
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

router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const troupeId = req.query.troupeId as string | undefined;
    const limitParam = parseInt(req.query.limit as string, 10);
    const limit = Math.min(isNaN(limitParam) ? 10 : limitParam, 10);
    const cursorParam = req.query.cursor as string | undefined;

    if (troupeId) {
      interface MemberRow { role: string }
      const members = await query<MemberRow>(
        'SELECT role FROM troupe_members WHERE troupe_id = $1 AND user_id = $2',
        [troupeId, userId],
      );
      if (members.length === 0) {
        res.status(403).json({ error: { message: 'You are not a member of this troupe' } });
        return;
      }
    }

    interface EventRow {
      id: string;
      name: string;
      event_type: EventType;
      event_at: Date;
      location: string;
      details: string | null;
      troupe_id: string;
      troupe_name: string;
      has_badge: boolean;
    }

    let rows: EventRow[];

    if (troupeId && cursorParam) {
      const { eventAt, id } = decodeCursor(cursorParam);
      rows = await query<EventRow>(
        `SELECT e.id, e.name, e.event_type, e.event_at, e.location, e.details,
                t.id AS troupe_id, t.name AS troupe_name, t.has_badge
         FROM events e
         JOIN troupes t ON t.id = e.troupe_id
         JOIN troupe_members tm ON tm.troupe_id = e.troupe_id AND tm.user_id = $1
         WHERE e.event_at >= NOW()
           AND t.deleted_at IS NULL
           AND e.troupe_id = $2::uuid
           AND (e.event_at > $3::timestamptz OR (e.event_at = $3::timestamptz AND e.id > $4::uuid))
         ORDER BY e.event_at ASC, e.id ASC
         LIMIT $5`,
        [userId, troupeId, eventAt, id, limit + 1],
      );
    } else if (troupeId) {
      rows = await query<EventRow>(
        `SELECT e.id, e.name, e.event_type, e.event_at, e.location, e.details,
                t.id AS troupe_id, t.name AS troupe_name, t.has_badge
         FROM events e
         JOIN troupes t ON t.id = e.troupe_id
         JOIN troupe_members tm ON tm.troupe_id = e.troupe_id AND tm.user_id = $1
         WHERE e.event_at >= NOW()
           AND t.deleted_at IS NULL
           AND e.troupe_id = $2::uuid
         ORDER BY e.event_at ASC, e.id ASC
         LIMIT $3`,
        [userId, troupeId, limit + 1],
      );
    } else if (cursorParam) {
      const { eventAt, id } = decodeCursor(cursorParam);
      rows = await query<EventRow>(
        `SELECT e.id, e.name, e.event_type, e.event_at, e.location, e.details,
                t.id AS troupe_id, t.name AS troupe_name, t.has_badge
         FROM events e
         JOIN troupes t ON t.id = e.troupe_id
         JOIN troupe_members tm ON tm.troupe_id = e.troupe_id AND tm.user_id = $1
         WHERE e.event_at >= NOW()
           AND t.deleted_at IS NULL
           AND (e.event_at > $2::timestamptz OR (e.event_at = $2::timestamptz AND e.id > $3::uuid))
         ORDER BY e.event_at ASC, e.id ASC
         LIMIT $4`,
        [userId, eventAt, id, limit + 1],
      );
    } else {
      rows = await query<EventRow>(
        `SELECT e.id, e.name, e.event_type, e.event_at, e.location, e.details,
                t.id AS troupe_id, t.name AS troupe_name, t.has_badge
         FROM events e
         JOIN troupes t ON t.id = e.troupe_id
         JOIN troupe_members tm ON tm.troupe_id = e.troupe_id AND tm.user_id = $1
         WHERE e.event_at >= NOW()
           AND t.deleted_at IS NULL
         ORDER BY e.event_at ASC, e.id ASC
         LIMIT $2`,
        [userId, limit + 1],
      );
    }

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor = hasMore && lastRow ? encodeCursor(lastRow.event_at, lastRow.id) : null;

    const events: FeedEvent[] = pageRows.map((row) => ({
      id: row.id,
      name: row.name,
      eventType: row.event_type,
      eventAt: row.event_at.toISOString(),
      location: row.location,
      details: row.details,
      troupe: {
        id: row.troupe_id,
        name: row.troupe_name,
        hasBadge: row.has_badge,
      },
    }));

    res.json({ events, nextCursor });
  } catch (err) {
    console.error('[GET /events]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

export default router;
