import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { query, withTransaction } from '../db';
import { TroupeRole, ManagedMember, MemberListResponse, TransferOwnershipResponse } from '../types/troupe';
import { getInitials } from '../lib/initials';

const router = Router();
router.use(requireAuth);

interface MemberRow {
  user_id: string;
  display_name: string;
  role: TroupeRole;
  joined_at: Date;
}

async function requireOwner(troupeId: string, userId: string): Promise<boolean> {
  const rows = await query<{ role: TroupeRole }>(
    'SELECT role FROM troupe_members WHERE troupe_id = $1 AND user_id = $2',
    [troupeId, userId],
  );
  return rows.length > 0 && rows[0].role === 'owner';
}

function rowToManagedMember(row: MemberRow): ManagedMember {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    initials: getInitials(row.display_name),
    role: row.role,
    joinedAt: row.joined_at.toISOString(),
  };
}

router.get('/:troupeId/members', async (req, res) => {
  try {
    const { troupeId } = req.params;
    const userId = req.user!.id;

    if (!(await requireOwner(troupeId, userId))) {
      res.status(403).json({ error: { message: 'Only the owner can manage members' } });
      return;
    }

    const rows = await query<MemberRow>(
      `SELECT tm.user_id, COALESCE(u.display_name, 'Unknown') AS display_name, tm.role, tm.joined_at
       FROM troupe_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.troupe_id = $1
       ORDER BY
         CASE tm.role WHEN 'owner' THEN 1 WHEN 'organizer' THEN 2 ELSE 3 END,
         tm.joined_at ASC`,
      [troupeId],
    );

    const response: MemberListResponse = {
      members: rows.map(rowToManagedMember),
      totalCount: rows.length,
    };

    res.json(response);
  } catch (err) {
    console.error('[GET /troupes/:troupeId/members]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.patch('/:troupeId/members/:targetUserId/role', async (req, res) => {
  try {
    const { troupeId, targetUserId } = req.params;
    const userId = req.user!.id;

    if (!(await requireOwner(troupeId, userId))) {
      res.status(403).json({ error: { message: 'Only the owner can manage members' } });
      return;
    }

    const { role } = req.body as { role: unknown };
    if (role !== 'organizer' && role !== 'member') {
      res.status(400).json({ error: { message: 'role must be organizer or member' } });
      return;
    }

    if (targetUserId === userId) {
      res.status(400).json({ error: { message: 'You cannot change your own role' } });
      return;
    }

    const rows = await query<MemberRow>(
      `SELECT tm.user_id, COALESCE(u.display_name, 'Unknown') AS display_name, tm.role, tm.joined_at
       FROM troupe_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.troupe_id = $1 AND tm.user_id = $2`,
      [troupeId, targetUserId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: { message: 'Member not found in this troupe' } });
      return;
    }

    const member = rows[0];

    if (member.role === role) {
      res.json({ userId: member.user_id, displayName: member.display_name, role: member.role });
      return;
    }

    await query(
      'UPDATE troupe_members SET role = $1 WHERE troupe_id = $2 AND user_id = $3',
      [role, troupeId, targetUserId],
    );

    res.json({ userId: member.user_id, displayName: member.display_name, role });
  } catch (err) {
    console.error('[PATCH /troupes/:troupeId/members/:userId/role]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.post('/:troupeId/members/:targetUserId/transfer-ownership', async (req, res) => {
  try {
    const { troupeId, targetUserId } = req.params;
    const userId = req.user!.id;

    if (!(await requireOwner(troupeId, userId))) {
      res.status(403).json({ error: { message: 'Only the owner can transfer ownership' } });
      return;
    }

    if (targetUserId === userId) {
      res.status(400).json({ error: { message: 'You cannot transfer ownership to yourself' } });
      return;
    }

    const rows = await query<MemberRow>(
      `SELECT tm.user_id, COALESCE(u.display_name, 'Unknown') AS display_name, tm.role, tm.joined_at
       FROM troupe_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.troupe_id = $1 AND tm.user_id = $2`,
      [troupeId, targetUserId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: { message: 'Member not found in this troupe' } });
      return;
    }

    if (rows[0].role === 'owner') {
      res.status(400).json({ error: { message: 'That member is already the owner' } });
      return;
    }

    const previousOwnerName = await query<{ display_name: string }>(
      `SELECT COALESCE(u.display_name, 'Unknown') AS display_name FROM users u WHERE u.id = $1`,
      [userId],
    );

    const result = await withTransaction(async (client) => {
      await client.query(
        'UPDATE troupe_members SET role = $1 WHERE troupe_id = $2 AND user_id = $3',
        ['organizer', troupeId, userId],
      );
      await client.query(
        'UPDATE troupe_members SET role = $1 WHERE troupe_id = $2 AND user_id = $3',
        ['owner', troupeId, targetUserId],
      );
      return true;
    });

    if (!result) throw new Error('Transaction failed');

    const response: TransferOwnershipResponse = {
      previousOwner: {
        userId,
        displayName: previousOwnerName[0]?.display_name ?? 'Unknown',
        role: 'organizer',
      },
      newOwner: {
        userId: targetUserId,
        displayName: rows[0].display_name,
        role: 'owner',
      },
    };

    res.json(response);
  } catch (err) {
    console.error('[POST /troupes/:troupeId/members/:userId/transfer-ownership]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.delete('/:troupeId/members/:targetUserId', async (req, res) => {
  try {
    const { troupeId, targetUserId } = req.params;
    const userId = req.user!.id;

    if (!(await requireOwner(troupeId, userId))) {
      res.status(403).json({ error: { message: 'Only the owner can remove members' } });
      return;
    }

    if (targetUserId === userId) {
      res.status(400).json({ error: { message: 'You cannot remove yourself from the troupe' } });
      return;
    }

    const rows = await query<{ user_id: string }>(
      'SELECT user_id FROM troupe_members WHERE troupe_id = $1 AND user_id = $2',
      [troupeId, targetUserId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: { message: 'Member not found in this troupe' } });
      return;
    }

    await withTransaction(async (client) => {
      await client.query(
        `DELETE FROM event_attendance
         WHERE user_id = $1
           AND event_id IN (
             SELECT id FROM events
             WHERE troupe_id = $2 AND event_at >= NOW() AND deleted_at IS NULL
           )`,
        [targetUserId, troupeId],
      );
      await client.query(
        'DELETE FROM troupe_members WHERE troupe_id = $1 AND user_id = $2',
        [troupeId, targetUserId],
      );
    });

    res.json({ userId: targetUserId, removed: true });
  } catch (err) {
    console.error('[DELETE /troupes/:troupeId/members/:userId]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

export default router;
