import { query } from '../db';
import { AttendanceSummary, AttendanceStatus, AttendeeChip } from '../types/troupe';
import { getInitials } from './initials';

interface RawChip {
  userId: string;
  displayName: string;
}

interface AttendanceQueryRow {
  event_id: string;
  attending: RawChip[] | null;
  not_attending: RawChip[] | null;
  maybe: RawChip[] | null;
  late: RawChip[] | null;
  no_response: RawChip[] | null;
  total_members: string;
  current_user_attendance: AttendanceStatus | null;
}

export interface EventAttendanceData {
  attendance: AttendanceSummary;
  currentUserAttendance: AttendanceStatus | null;
}

export const EMPTY_ATTENDANCE: EventAttendanceData = {
  attendance: {
    attending: [],
    notAttending: [],
    maybe: [],
    late: [],
    noResponse: [],
    counts: { attending: 0, notAttending: 0, maybe: 0, late: 0, noResponse: 0, total: 0 },
  },
  currentUserAttendance: null,
};

function toChip(raw: RawChip): AttendeeChip {
  return { userId: raw.userId, displayName: raw.displayName, initials: getInitials(raw.displayName) };
}

function rowToData(row: AttendanceQueryRow): EventAttendanceData {
  const attending = (row.attending ?? []).map(toChip);
  const notAttending = (row.not_attending ?? []).map(toChip);
  const maybe = (row.maybe ?? []).map(toChip);
  const late = (row.late ?? []).map(toChip);
  const noResponse = (row.no_response ?? []).map(toChip);
  return {
    attendance: {
      attending,
      notAttending,
      maybe,
      late,
      noResponse,
      counts: {
        attending: attending.length,
        notAttending: notAttending.length,
        maybe: maybe.length,
        late: late.length,
        noResponse: noResponse.length,
        total: Number(row.total_members),
      },
    },
    currentUserAttendance: row.current_user_attendance,
  };
}

export async function fetchAttendance(
  eventIds: string[],
  userId: string,
): Promise<Map<string, EventAttendanceData>> {
  if (eventIds.length === 0) return new Map();

  const rows = await query<AttendanceQueryRow>(
    `WITH att AS (
       SELECT ea.event_id,
         json_agg(json_build_object('userId', ea.user_id::text, 'displayName', u.display_name)
           ORDER BY ea.created_at) FILTER (WHERE ea.status = 'attending') AS attending,
         json_agg(json_build_object('userId', ea.user_id::text, 'displayName', u.display_name)
           ORDER BY ea.created_at) FILTER (WHERE ea.status = 'not_attending') AS not_attending,
         json_agg(json_build_object('userId', ea.user_id::text, 'displayName', u.display_name)
           ORDER BY ea.created_at) FILTER (WHERE ea.status = 'maybe') AS maybe,
         json_agg(json_build_object('userId', ea.user_id::text, 'displayName', u.display_name)
           ORDER BY ea.created_at) FILTER (WHERE ea.status = 'late') AS late
       FROM event_attendance ea
       JOIN users u ON u.id = ea.user_id
       WHERE ea.event_id = ANY($1::uuid[])
       GROUP BY ea.event_id
     ),
     members AS (
       SELECT e.id AS event_id,
         json_agg(json_build_object('userId', tm.user_id::text, 'displayName', mu.display_name)
           ORDER BY mu.display_name) FILTER (WHERE ea.user_id IS NULL) AS no_response,
         COUNT(DISTINCT tm.user_id) AS total_members
       FROM events e
       JOIN troupe_members tm ON tm.troupe_id = e.troupe_id
       JOIN users mu ON mu.id = tm.user_id
       LEFT JOIN event_attendance ea ON ea.event_id = e.id AND ea.user_id = tm.user_id
       WHERE e.id = ANY($1::uuid[])
       GROUP BY e.id
     ),
     cua AS (
       SELECT event_id, status
       FROM event_attendance
       WHERE user_id = $2 AND event_id = ANY($1::uuid[])
     )
     SELECT
       m.event_id,
       COALESCE(att.attending, '[]'::json) AS attending,
       COALESCE(att.not_attending, '[]'::json) AS not_attending,
       COALESCE(att.maybe, '[]'::json) AS maybe,
       COALESCE(att.late, '[]'::json) AS late,
       COALESCE(m.no_response, '[]'::json) AS no_response,
       m.total_members::int AS total_members,
       cua.status AS current_user_attendance
     FROM members m
     LEFT JOIN att ON att.event_id = m.event_id
     LEFT JOIN cua ON cua.event_id = m.event_id`,
    [eventIds, userId],
  );

  const map = new Map<string, EventAttendanceData>();
  for (const row of rows) {
    map.set(row.event_id, rowToData(row));
  }
  return map;
}
