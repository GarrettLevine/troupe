import { Request, Response, NextFunction } from 'express';
import { auth } from '../firebase';
import { pool } from '../db';
import { DbUser } from '../types';

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = await auth.verifyIdToken(token);

    const result = await pool.query<DbUser>('SELECT * FROM users WHERE firebase_uid = $1', [
      decoded.uid,
    ]);

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User not found — call POST /api/auth/sync first' });
      return;
    }

    req.user = result.rows[0];
    req.firebaseUid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
