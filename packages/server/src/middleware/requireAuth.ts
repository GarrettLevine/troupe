import { Request, Response, NextFunction } from 'express';
import { auth } from '../firebase';
import { query } from '../db';
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

  let uid: string;
  try {
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  let rows: DbUser[];
  try {
    rows = await query<DbUser>('SELECT * FROM users WHERE firebase_uid = $1', [uid]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  if (rows.length === 0) {
    res.status(401).json({ error: 'User not found — call POST /api/auth/sync first' });
    return;
  }

  req.user = rows[0];
  req.firebaseUid = uid;
  next();
}
