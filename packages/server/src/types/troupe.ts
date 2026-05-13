export type TroupeRole = 'owner' | 'organizer' | 'member';
export type EventType = 'show' | 'rehearsal';

export interface TroupeSummary {
  id: string;
  name: string;
  role: TroupeRole;
  memberCount: number;
  createdAt: string;
}

export interface TroupeMember {
  userId: string;
  displayName: string;
  role: TroupeRole;
}

export interface TroupeDetail {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  members: TroupeMember[];
  currentUserRole: TroupeRole;
}

export interface TroupeEvent {
  id: string;
  name: string;
  eventType: EventType;
  eventAt: string;
  location: string;
  details: string | null;
  createdBy: string;
}
