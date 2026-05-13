import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { query, withTransaction } from '../db';
import { LIMITS } from '../config/limits';
import { TroupeRole, TroupeSummary } from '../types/troupe';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    interface TroupeRow {
      id: string;
      name: string;
      role: TroupeRole;
      member_count: string;
      created_at: Date;
    }

    const rows = await query<TroupeRow>(
      `SELECT
        t.id,
        t.name,
        tm.role,
        COUNT(all_members.id) AS member_count,
        t.created_at
       FROM troupes t
       JOIN troupe_members tm ON tm.troupe_id = t.id AND tm.user_id = $1
       JOIN troupe_members all_members ON all_members.troupe_id = t.id
       GROUP BY t.id, t.name, tm.role, t.created_at
       ORDER BY t.created_at DESC`,
      [req.user!.id],
    );

    const troupes: TroupeSummary[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      memberCount: parseInt(row.member_count, 10),
      createdAt: row.created_at.toISOString(),
    }));

    res.json({ troupes });
  } catch {
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name } = req.body as { name?: unknown };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: { message: 'name is required' } });
      return;
    }
    if (name.trim().length > 100) {
      res.status(400).json({ error: { message: 'name must be 100 characters or fewer' } });
      return;
    }

    const trimmedName = name.trim();
    const userId = req.user!.id;

    interface CountRow { count: string }
    const [{ count }] = await query<CountRow>(
      `SELECT COUNT(*) AS count FROM troupe_members WHERE user_id = $1 AND role = 'owner'`,
      [userId],
    );

    if (parseInt(count, 10) >= LIMITS.MAX_TROUPES_PER_USER) {
      res.status(409).json({
        error: {
          message: `You've reached the maximum of ${LIMITS.MAX_TROUPES_PER_USER} troupes`,
          code: 'TROUPE_LIMIT_REACHED',
        },
      });
      return;
    }

    interface TroupeRow { id: string; name: string; created_at: Date }

    const troupe = await withTransaction(async (tx) => {
      const [t] = await tx.query<TroupeRow>(
        `INSERT INTO troupes (name, created_by) VALUES ($1, $2) RETURNING id, name, created_at`,
        [trimmedName, userId],
      );
      await tx.query(
        `INSERT INTO troupe_members (troupe_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [t.id, userId],
      );
      return t;
    });

    const response: TroupeSummary = {
      id: troupe.id,
      name: troupe.name,
      role: 'owner',
      memberCount: 1,
      createdAt: troupe.created_at.toISOString(),
    };

    res.status(201).json(response);
  } catch {
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.get('/:troupeId', async (req, res) => {
  try {
    const { troupeId } = req.params;
    const userId = req.user!.id;

    interface DetailRow {
      id: string;
      name: string;
      created_at: Date;
      member_count: string;
      members: { userId: string; displayName: string; role: TroupeRole }[];
      current_user_role: TroupeRole | null;
    }

    const rows = await query<DetailRow>(
      `WITH me AS (
         SELECT role FROM troupe_members WHERE troupe_id = $1 AND user_id = $2
       )
       SELECT
         t.id,
         t.name,
         t.created_at,
         COUNT(tm.id) AS member_count,
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'userId', tm.user_id,
             'displayName', COALESCE(u.display_name, 'Unknown'),
             'role', tm.role
           ) ORDER BY tm.joined_at ASC
         ) AS members,
         (SELECT role FROM me) AS current_user_role
       FROM troupes t
       JOIN troupe_members tm ON tm.troupe_id = t.id
       JOIN users u ON u.id = tm.user_id
       WHERE t.id = $1
       GROUP BY t.id, t.name, t.created_at`,
      [troupeId, userId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: { message: 'Troupe not found' } });
      return;
    }

    const row = rows[0];

    if (!row.current_user_role) {
      res.status(403).json({ error: { message: 'You are not a member of this troupe' } });
      return;
    }

    res.json({
      id: row.id,
      name: row.name,
      createdAt: row.created_at.toISOString(),
      memberCount: parseInt(row.member_count, 10),
      members: row.members,
      currentUserRole: row.current_user_role,
    });
  } catch {
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

export default router;
