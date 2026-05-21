import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { query, pool } from '../db';
import { generateInviteCode } from '../lib/inviteCode';
import { LIMITS } from '../config/limits';
import { InviteResponse, InvitePreview } from '../types/troupe';

const router = Router();

// POST /api/troupes/:troupeId/invites — generate or return an existing active invite
router.post('/:troupeId/invites', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { troupeId } = req.params;
    const force = req.query.force === 'true';

    // Verify troupe exists
    interface TroupeRow { id: string }
    const troupeRows = await query<TroupeRow>(
      'SELECT id FROM troupes WHERE id = $1 AND deleted_at IS NULL',
      [troupeId],
    );
    if (troupeRows.length === 0) {
      res.status(404).json({ error: { message: 'Troupe not found' } });
      return;
    }

    // Verify user is a member and get their role
    interface MemberRow { role: string }
    const memberRows = await query<MemberRow>(
      'SELECT role FROM troupe_members WHERE troupe_id = $1 AND user_id = $2',
      [troupeId, userId],
    );
    if (memberRows.length === 0) {
      res.status(403).json({ error: { message: 'You are not a member of this troupe' } });
      return;
    }
    if (memberRows[0].role === 'member') {
      res.status(403).json({ error: { message: 'Only owners and organizers can generate invite links' } });
      return;
    }

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173';

    if (!force) {
      // Return existing active invite if one exists
      interface InviteRow { id: string; code: string; expires_at: Date }
      const existing = await query<InviteRow>(
        `SELECT id, code, expires_at
         FROM troupe_invites
         WHERE troupe_id = $1 AND created_by = $2
           AND expires_at > NOW() AND used_at IS NULL
         LIMIT 1`,
        [troupeId, userId],
      );
      if (existing.length > 0) {
        const inv = existing[0];
        const response: InviteResponse = {
          code: inv.code,
          inviteUrl: `${appUrl}/invite/${inv.code}`,
          expiresAt: inv.expires_at.toISOString(),
        };
        res.status(200).json(response);
        return;
      }
    }

    // Create (or replace) invite
    const code = generateInviteCode();

    if (force) {
      // Update existing row if present, otherwise insert
      interface ExistingRow { id: string }
      const existing = await query<ExistingRow>(
        `SELECT id FROM troupe_invites
         WHERE troupe_id = $1 AND created_by = $2
           AND expires_at > NOW() AND used_at IS NULL
         LIMIT 1`,
        [troupeId, userId],
      );

      if (existing.length > 0) {
        interface UpdatedRow { code: string; expires_at: Date }
        const updated = await query<UpdatedRow>(
          `UPDATE troupe_invites
           SET code = $1, expires_at = NOW() + INTERVAL '7 days', used_at = NULL, used_by = NULL
           WHERE id = $2
           RETURNING code, expires_at`,
          [code, existing[0].id],
        );
        const response: InviteResponse = {
          code: updated[0].code,
          inviteUrl: `${appUrl}/invite/${updated[0].code}`,
          expiresAt: updated[0].expires_at.toISOString(),
        };
        res.status(201).json(response);
        return;
      }
    }

    interface InsertedRow { code: string; expires_at: Date }
    const inserted = await query<InsertedRow>(
      `INSERT INTO troupe_invites (troupe_id, created_by, code, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')
       RETURNING code, expires_at`,
      [troupeId, userId, code],
    );

    const response: InviteResponse = {
      code: inserted[0].code,
      inviteUrl: `${appUrl}/invite/${inserted[0].code}`,
      expiresAt: inserted[0].expires_at.toISOString(),
    };
    res.status(201).json(response);
  } catch (err) {
    console.error('[POST /api/troupes/:troupeId/invites]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// GET /api/invites/:code — public troupe preview for an invite
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    interface InviteRow {
      id: string;
      expires_at: Date;
      used_at: Date | null;
      troupe_id: string;
      troupe_name: string;
      has_badge: boolean;
      member_count: string;
    }
    const rows = await query<InviteRow>(
      `SELECT ti.id, ti.expires_at, ti.used_at,
              t.id AS troupe_id, t.name AS troupe_name, t.has_badge,
              COUNT(tm.user_id)::text AS member_count
       FROM troupe_invites ti
       JOIN troupes t ON t.id = ti.troupe_id
       LEFT JOIN troupe_members tm ON tm.troupe_id = t.id
       WHERE ti.code = $1 AND t.deleted_at IS NULL
       GROUP BY ti.id, t.id`,
      [code],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: { message: 'Invite not found' } });
      return;
    }

    const inv = rows[0];

    if (inv.expires_at < new Date()) {
      res.status(410).json({ error: { message: 'This invite link has expired' } });
      return;
    }
    if (inv.used_at !== null) {
      res.status(410).json({ error: { message: 'This invite link has already been used' } });
      return;
    }

    const response: InvitePreview = {
      code,
      troupe: {
        id: inv.troupe_id,
        name: inv.troupe_name,
        memberCount: parseInt(inv.member_count, 10),
        hasBadge: inv.has_badge,
      },
      expiresAt: inv.expires_at.toISOString(),
    };
    res.status(200).json(response);
  } catch (err) {
    console.error('[GET /api/invites/:code]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// POST /api/invites/:code/redeem — redeem an invite (requires auth)
router.post('/:code/redeem', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { code } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    interface InviteRow {
      id: string;
      troupe_id: string;
      expires_at: Date;
      used_at: Date | null;
    }
    const invRows = await client.query<InviteRow>(
      `SELECT id, troupe_id, expires_at, used_at
       FROM troupe_invites
       WHERE code = $1
       FOR UPDATE`,
      [code],
    );

    if (invRows.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: { message: 'Invite not found' } });
      return;
    }

    const inv = invRows.rows[0];

    if (inv.expires_at < new Date()) {
      await client.query('ROLLBACK');
      res.status(410).json({ error: { message: 'This invite link has expired' } });
      return;
    }
    if (inv.used_at !== null) {
      await client.query('ROLLBACK');
      res.status(410).json({ error: { message: 'This invite link has already been used' } });
      return;
    }

    // Check if user is already a member
    interface MemberRow { role: string }
    const existing = await client.query<MemberRow>(
      'SELECT role FROM troupe_members WHERE troupe_id = $1 AND user_id = $2',
      [inv.troupe_id, userId],
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: { message: 'already_member', code: 'already_member' } });
      return;
    }

    // Check member count against limit
    interface CountRow { count: string }
    const countRows = await client.query<CountRow>(
      'SELECT COUNT(*)::text AS count FROM troupe_members WHERE troupe_id = $1',
      [inv.troupe_id],
    );
    if (parseInt(countRows.rows[0].count, 10) >= LIMITS.MAX_MEMBERS_PER_TROUPE) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: { message: 'troupe_full', code: 'troupe_full' } });
      return;
    }

    // Insert new member
    await client.query(
      'INSERT INTO troupe_members (troupe_id, user_id, role) VALUES ($1, $2, $3)',
      [inv.troupe_id, userId, 'member'],
    );

    // Mark invite as used
    await client.query(
      'UPDATE troupe_invites SET used_at = NOW(), used_by = $1 WHERE id = $2',
      [userId, inv.id],
    );

    // Fetch troupe summary to return
    interface TroupeRow {
      name: string;
      has_badge: boolean;
      member_count: string;
    }
    const troupeRows = await client.query<TroupeRow>(
      `SELECT t.name, t.has_badge, COUNT(tm.user_id)::text AS member_count
       FROM troupes t
       JOIN troupe_members tm ON tm.troupe_id = t.id
       WHERE t.id = $1 AND t.deleted_at IS NULL
       GROUP BY t.id`,
      [inv.troupe_id],
    );

    await client.query('COMMIT');

    const t = troupeRows.rows[0];
    res.status(200).json({
      troupe: {
        id: inv.troupe_id,
        name: t.name,
        hasBadge: t.has_badge,
        role: 'member' as const,
        memberCount: parseInt(t.member_count, 10),
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /api/invites/:code/redeem]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  } finally {
    client.release();
  }
});

export { router as invitesRouter, router as redeemRouter };
