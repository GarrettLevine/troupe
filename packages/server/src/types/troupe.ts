export type TroupeRole = 'owner' | 'organizer' | 'member';

export interface TroupeSummary {
  id: string;
  name: string;
  role: TroupeRole;
  memberCount: number;
  createdAt: string;
}
