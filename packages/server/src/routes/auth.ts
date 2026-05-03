import { Router, Request, Response } from 'express';
import { auth } from '../firebase';
import { pool } from '../db';

const router = Router();

router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = await auth.verifyIdToken(token);
    const { displayName } = req.body as { displayName?: string };

    const result = await pool.query(
      `INSERT INTO users (firebase_uid, display_name)
       VALUES ($1, $2)
       ON CONFLICT (firebase_uid) DO UPDATE
         SET display_name = COALESCE(EXCLUDED.display_name, users.display_name),
             updated_at   = NOW()
       RETURNING *`,
      [decoded.uid, displayName ?? null]
    );

    res.json(result.rows[0]);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default router;
