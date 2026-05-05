import { Router, Request, Response } from 'express';
import { auth } from '../firebase';
import { query } from '../db';
import { DbUser } from '../types';

const router = Router();

router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  let uid: string;
  try {
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const { displayName } = req.body as { displayName?: string };

  let rows: DbUser[];
  try {
    rows = await query<DbUser>(
      `INSERT INTO users (firebase_uid, display_name)
       VALUES ($1, $2)
       ON CONFLICT (firebase_uid) DO UPDATE
         SET display_name = COALESCE(EXCLUDED.display_name, users.display_name),
             updated_at   = NOW()
       RETURNING *`,
      [uid, displayName ?? null]
    );
  } catch {
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  res.json(rows[0]);
});

export default router;
