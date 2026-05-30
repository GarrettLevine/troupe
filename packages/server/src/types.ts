import { TroupeRole } from './types/troupe';

export interface DbUser {
  id: string;
  display_name: string | null;
  firebase_uid: string;
  created_at: Date;
  updated_at: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: DbUser;
      firebaseUid?: string;
      troupeMember?: { role: TroupeRole; troupeId: string };
    }
  }
}
