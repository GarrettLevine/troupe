export type TroupeRole = 'owner' | 'organizer' | 'member';
export type EventType = 'show' | 'rehearsal';

export const BRAND_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
];

export const ROLE_STYLES: Record<TroupeRole, string> = {
  owner: 'bg-violet-100 text-violet-700',
  organizer: 'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-600',
};

export const EVENT_TYPE_STYLES: Record<EventType, string> = {
  show: 'bg-amber-100 text-amber-700',
  rehearsal: 'bg-teal-100 text-teal-700',
};

export const MAX_TROUPES_PER_USER = 5;
export const MAX_TROUPE_NAME_LENGTH = 100;

export const MAX_EVENT_NAME_LENGTH = 150;
export const MAX_EVENT_LOCATION_LENGTH = 200;
export const MAX_EVENT_DETAILS_LENGTH = 1000;

export const BADGE_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const BADGE_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
