export type TroupeRole = 'owner' | 'organizer' | 'member';
export type EventType = 'show' | 'rehearsal';

export interface TroupeBadges {
  thumbnail: string;
  standard: string;
  large: string;
}

export interface TroupeSummary {
  id: string;
  name: string;
  role: TroupeRole;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  hasBadge: boolean;
  badges: TroupeBadges | null;
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
  updatedAt: string;
  memberCount: number;
  hasBadge: boolean;
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

export interface FeedEvent {
  id: string;
  name: string;
  eventType: EventType;
  eventAt: string;
  location: string;
  details: string | null;
  troupe: {
    id: string;
    name: string;
    hasBadge: boolean;
  };
}

export interface EventFeedResponse {
  events: FeedEvent[];
  nextCursor: string | null;
}
