import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { requireAuth } from '../middleware/requireAuth';
import { requireTroupeMember } from '../middleware/requireTroupeMember';
import { query, withTransaction } from '../db';
import { LIMITS } from '../config/limits';
import { TroupeRole, TroupeSummary, TroupeBadges } from '../types/troupe';
import { uploadToR2 } from '../lib/r2';
import { getBadgeUrls } from '../lib/badgeUrl';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_FILE_TYPE'));
    }
  },
});

function runUpload(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.single('image')(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function buildBadges(troupeId: string, hasBadge: boolean, updatedAt: Date): TroupeBadges | null {
  if (!hasBadge) return null;
  return getBadgeUrls(troupeId, updatedAt);
}

const BADGE_SIZES = [
  { key: 'thumbnail', size: 64, quality: 80 },
  { key: 'standard', size: 128, quality: 85 },
  { key: 'large', size: 256, quality: 90 },
] as const;

async function processVariant(buffer: Buffer, size: number, quality: number): Promise<Buffer> {
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`,
  );
  return sharp(buffer)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .composite([{ input: circle, blend: 'dest-in' }])
    .webp({ quality })
    .toBuffer();
}

router.get('/', async (req, res) => {
  try {
    interface TroupeRow {
      id: string;
      name: string;
      role: TroupeRole;
      member_count: string;
      created_at: Date;
      updated_at: Date;
      has_badge: boolean;
    }

    const rows = await query<TroupeRow>(
      `SELECT
        t.id,
        t.name,
        tm.role,
        COUNT(all_members.id) AS member_count,
        t.created_at,
        t.updated_at,
        t.has_badge
       FROM troupes t
       JOIN troupe_members tm ON tm.troupe_id = t.id AND tm.user_id = $1
       JOIN troupe_members all_members ON all_members.troupe_id = t.id
       WHERE t.deleted_at IS NULL
       GROUP BY t.id, t.name, tm.role, t.created_at, t.updated_at, t.has_badge
       ORDER BY t.created_at DESC`,
      [req.user!.id],
    );

    const troupes: TroupeSummary[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      memberCount: parseInt(row.member_count, 10),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      hasBadge: row.has_badge,
      badges: buildBadges(row.id, row.has_badge, row.updated_at),
    }));

    res.json({ troupes });
  } catch (err) {
    console.error('[GET /troupes]', err);
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
      `SELECT COUNT(*) AS count
       FROM troupe_members tm
       JOIN troupes t ON t.id = tm.troupe_id
       WHERE tm.user_id = $1 AND tm.role = 'owner' AND t.deleted_at IS NULL`,
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

    interface TroupeRow { id: string; name: string; created_at: Date; updated_at: Date }

    const troupe = await withTransaction(async (tx) => {
      const [t] = await tx.query<TroupeRow>(
        `INSERT INTO troupes (name, created_by) VALUES ($1, $2) RETURNING id, name, created_at, updated_at`,
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
      updatedAt: troupe.updated_at.toISOString(),
      hasBadge: false,
      badges: null,
    };

    res.status(201).json(response);
  } catch (err) {
    console.error('[POST /troupes]', err);
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
      updated_at: Date;
      has_badge: boolean;
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
         t.updated_at,
         t.has_badge,
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
       WHERE t.id = $1 AND t.deleted_at IS NULL
       GROUP BY t.id, t.name, t.created_at, t.updated_at, t.has_badge`,
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
      updatedAt: row.updated_at.toISOString(),
      hasBadge: row.has_badge,
      memberCount: parseInt(row.member_count, 10),
      members: row.members,
      currentUserRole: row.current_user_role,
    });
  } catch (err) {
    console.error('[GET /troupes/:troupeId]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.patch('/:troupeId', requireTroupeMember('owner'), async (req, res) => {
  try {
    const { troupeId } = req.params;
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

    interface UpdatedRow {
      id: string;
      name: string;
      created_at: Date;
      updated_at: Date;
      has_badge: boolean;
      member_count: string;
    }

    const rows = await query<UpdatedRow>(
      `WITH updated AS (
         UPDATE troupes SET name = $1 WHERE id = $2 AND deleted_at IS NULL
         RETURNING id, name, created_at, updated_at, has_badge
       )
       SELECT
         u.id, u.name, u.created_at, u.updated_at, u.has_badge,
         COUNT(all_members.id) AS member_count
       FROM updated u
       JOIN troupe_members all_members ON all_members.troupe_id = u.id
       GROUP BY u.id, u.name, u.created_at, u.updated_at, u.has_badge`,
      [trimmedName, troupeId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: { message: 'Troupe not found' } });
      return;
    }

    const row = rows[0];

    const response: TroupeSummary = {
      id: row.id,
      name: row.name,
      role: req.troupeMember!.role,
      memberCount: parseInt(row.member_count, 10),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      hasBadge: row.has_badge,
      badges: buildBadges(row.id, row.has_badge, row.updated_at),
    };

    res.json(response);
  } catch (err) {
    console.error('[PATCH /troupes/:troupeId]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.delete('/:troupeId', requireTroupeMember('owner'), async (req, res) => {
  try {
    const { troupeId } = req.params;
    await query('UPDATE troupes SET deleted_at = NOW() WHERE id = $1', [troupeId]);
    res.status(204).send();
  } catch (err) {
    console.error('[DELETE /troupes/:troupeId]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.post('/:troupeId/badge', requireTroupeMember('owner'), async (req, res) => {
  try {
    try {
      await runUpload(req, res);
    } catch (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: { message: 'File must be 5MB or smaller' } });
        return;
      }
      if (err instanceof Error && err.message === 'INVALID_FILE_TYPE') {
        res.status(400).json({ error: { message: 'Only JPEG, PNG, and WebP images are accepted' } });
        return;
      }
      throw err;
    }

    const { troupeId } = req.params;

    if (!req.file) {
      res.status(400).json({ error: { message: 'No file provided' } });
      return;
    }

    let variants: Buffer[];
    try {
      variants = await Promise.all(
        BADGE_SIZES.map(({ size, quality }) => processVariant(req.file!.buffer, size, quality)),
      );
    } catch (err) {
      console.error('[POST /troupes/:troupeId/badge] sharp processing failed', err);
      throw err;
    }

    try {
      await Promise.all(
        BADGE_SIZES.map(({ key }, i) =>
          uploadToR2(`badges/${troupeId}/${key}.webp`, variants[i], 'image/webp'),
        ),
      );
    } catch (err) {
      console.error('[POST /troupes/:troupeId/badge] R2 upload failed', err);
      throw err;
    }

    interface UpdatedRow { id: string; name: string; updated_at: Date; has_badge: boolean }
    const [updated] = await query<UpdatedRow>(
      `UPDATE troupes SET has_badge = TRUE WHERE id = $1 RETURNING id, name, updated_at, has_badge`,
      [troupeId],
    );

    const badges = getBadgeUrls(updated.id, updated.updated_at);

    res.json({
      id: updated.id,
      name: updated.name,
      hasBadge: updated.has_badge,
      updatedAt: updated.updated_at.toISOString(),
      badges,
    });
  } catch (err) {
    console.error('[POST /troupes/:troupeId/badge]', err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

export default router;
