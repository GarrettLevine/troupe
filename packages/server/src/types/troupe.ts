export type TroupeRole = 'owner' | 'organizer' | 'member';
export type EventType = 'show' | 'rehearsal';
export type EventStatus = 'scheduled' | 'cancelled';
export type AttendanceStatus = 'attending' | 'not_attending' | 'maybe' | 'late';

export interface AttendeeChip {
  userId: string;
  displayName: string;
  initials: string;
}

export interface AttendanceSummary {
  attending: AttendeeChip[];
  notAttending: AttendeeChip[];
  maybe: AttendeeChip[];
  late: AttendeeChip[];
  noResponse: AttendeeChip[];
  counts: {
    attending: number;
    notAttending: number;
    maybe: number;
    late: number;
    noResponse: number;
    total: number;
  };
}

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
  callTime: string | null;
  callTimeOffset: number | null;
  durationMinutes: number | null;
  durationFormatted: string | null;
  location: string;
  details: string | null;
  status: EventStatus;
  createdBy: string;
  attendance: AttendanceSummary;
  currentUserAttendance: AttendanceStatus | null;
}

export interface FeedEvent {
  id: string;
  name: string;
  eventType: EventType;
  eventAt: string;
  callTime: string | null;
  callTimeOffset: number | null;
  durationMinutes: number | null;
  durationFormatted: string | null;
  status: EventStatus;
  location: string;
  details: string | null;
  createdBy: string;
  attendance: AttendanceSummary;
  currentUserAttendance: AttendanceStatus | null;
  troupe: {
    id: string;
    name: string;
    hasBadge: boolean;
    updatedAt: string;
  };
}

export interface EventFeedResponse {
  events: FeedEvent[];
  nextCursor: string | null;
}

export interface InviteResponse {
  code: string;
  inviteUrl: string;
  expiresAt: string;
}

export interface InvitePreview {
  code: string;
  troupe: {
    id: string;
    name: string;
    memberCount: number;
    hasBadge: boolean;
  };
  expiresAt: string;
}
