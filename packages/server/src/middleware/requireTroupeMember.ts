import { Request, Response, NextFunction } from 'express';
import { query } from '../db';
import { TroupeRole } from '../types/troupe';

const ROLE_ORDER: Record<TroupeRole, number> = { member: 0, organizer: 1, owner: 2 };

export function requireTroupeMember(minRole?: TroupeRole) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { troupeId } = req.params;
    const userId = req.user!.id;

    interface Row { role: TroupeRole | null }
    const rows = await query<Row>(
      `SELECT tm.role
       FROM troupes t
       LEFT JOIN troupe_members tm ON tm.troupe_id = t.id AND tm.user_id = $2
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [troupeId, userId],
    ).catch(() => null);

    if (rows === null) {
      res.status(500).json({ error: { message: 'Internal server error' } });
      return;
    }

    if (rows.length === 0) {
      res.status(404).json({ error: { message: 'Troupe not found' } });
      return;
    }

    const role = rows[0].role;

    if (!role) {
      res.status(403).json({ error: { message: 'You are not a member of this troupe' } });
      return;
    }

    if (minRole && ROLE_ORDER[role] < ROLE_ORDER[minRole]) {
      const message =
        minRole === 'owner'
          ? 'Only the owner can perform this action'
          : 'Only owners and organizers can perform this action';
      res.status(403).json({ error: { message } });
      return;
    }

    req.troupeMember = { role, troupeId };
    next();
  };
}
