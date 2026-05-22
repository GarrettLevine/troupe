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

export const CALL_TIME_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'None', value: null },
  { label: '15 mins before', value: 15 },
  { label: '30 mins before', value: 30 },
  { label: '45 mins before', value: 45 },
  { label: '1h before', value: 60 },
  { label: '1h 30m before', value: 90 },
  { label: '2h before', value: 120 },
];

export type ChipColorScheme = 'green' | 'red' | 'yellow' | 'blue' | 'neutral';

export const CHIP_COLOR_LABEL: Record<ChipColorScheme, string> = {
  green: 'text-green-700',
  red: 'text-red-700',
  yellow: 'text-amber-700',
  blue: 'text-blue-700',
  neutral: 'text-gray-500',
};

export type AttendanceStatus = 'attending' | 'not_attending' | 'maybe' | 'late';

export interface AttendanceOption {
  status: AttendanceStatus;
  label: string;
  dotClass: string;
  textClass: string;
  activeClass: string;
  inactiveClass: string;
}

export const ATTENDANCE_OPTIONS: AttendanceOption[] = [
  {
    status: 'attending',
    label: 'Attending',
    dotClass: 'bg-green-500',
    textClass: 'text-green-700',
    activeClass: 'bg-green-500 border-green-500 text-white',
    inactiveClass: 'border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-700',
  },
  {
    status: 'maybe',
    label: 'Maybe',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700',
    activeClass: 'bg-amber-500 border-amber-500 text-white',
    inactiveClass: 'border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-700',
  },
  {
    status: 'late',
    label: 'Late',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-700',
    activeClass: 'bg-blue-500 border-blue-500 text-white',
    inactiveClass: 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-700',
  },
  {
    status: 'not_attending',
    label: 'Not Going',
    dotClass: 'bg-red-400',
    textClass: 'text-red-600',
    activeClass: 'bg-red-400 border-red-400 text-white',
    inactiveClass: 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-700',
  },
];

export const DURATION_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'None', value: null },
  { label: '30m', value: 30 },
  { label: '45m', value: 45 },
  { label: '1h', value: 60 },
  { label: '1h 30m', value: 90 },
  { label: '2h', value: 120 },
  { label: '2h 30m', value: 150 },
  { label: '3h', value: 180 },
  { label: '3h 30m', value: 210 },
  { label: '4h', value: 240 },
];
