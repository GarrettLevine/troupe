import { FeedEvent } from '../hooks/useEventFeed';
import { AttendanceStatus } from '../hooks/useEvents';
import { TroupeBadge } from './TroupeBadge';
import { EVENT_TYPE_STYLES } from '../lib/constants';
import { formatCompactDate, formatTime } from '../lib/utils';

const ATTENDANCE_DOT: Record<AttendanceStatus, string> = {
  attending: 'bg-green-500',
  maybe: 'bg-amber-500',
  late: 'bg-blue-500',
  not_attending: 'bg-red-400',
};

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  attending: 'Attending',
  maybe: 'Maybe',
  late: 'Late',
  not_attending: 'Not Going',
};

const ATTENDANCE_TEXT: Record<AttendanceStatus, string> = {
  attending: 'text-green-700',
  maybe: 'text-amber-700',
  late: 'text-blue-700',
  not_attending: 'text-red-600',
};

interface FeedEventCardProps {
  event: FeedEvent;
  onClick?: () => void;
}

export function FeedEventCard({ event, onClick }: FeedEventCardProps) {
  const isCancelled = event.status === 'cancelled';

  const callDurationLine = [
    event.eventType === 'show' && event.callTime ? `Call time: ${formatTime(event.callTime)}` : null,
    event.durationFormatted ? `Duration: ${event.durationFormatted}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const { counts } = event.attendance;
  const countParts = [
    counts.attending > 0 && `${counts.attending} attending`,
    counts.maybe > 0 && `${counts.maybe} maybe`,
    counts.late > 0 && `${counts.late} late`,
    counts.notAttending > 0 && `${counts.notAttending} not going`,
  ].filter(Boolean).join(' · ');

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 hover:bg-gray-50 transition-colors active:bg-gray-100 ${
        isCancelled ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <TroupeBadge troupe={event.troupe} size="thumbnail" className="shrink-0 mt-0.5" />
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          {/* Row 1: title + badge/date */}
          <div className="flex items-start justify-between gap-3">
            <h4 className="font-semibold text-gray-900 text-sm leading-snug flex-1 min-w-0">{event.name}</h4>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex gap-1">
                {isCancelled && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    Cancelled
                  </span>
                )}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${EVENT_TYPE_STYLES[event.eventType]}`}>
                  {event.eventType === 'show' ? 'Show' : 'Rehearsal'}
                </span>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{formatCompactDate(event.eventAt)}</span>
            </div>
          </div>

          {/* Row 2: call/duration + location */}
          <div className="flex flex-col gap-0.5">
            {callDurationLine && (
              <p className="text-xs text-gray-500">{callDurationLine}</p>
            )}
            <p className="text-xs text-gray-500">Location: {event.location}</p>
          </div>

          {/* Row 3: attendance */}
          <div className="flex items-center justify-between gap-2">
            {event.currentUserAttendance ? (
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${ATTENDANCE_DOT[event.currentUserAttendance]}`} />
                <span className={`text-xs font-medium ${ATTENDANCE_TEXT[event.currentUserAttendance]}`}>
                  {ATTENDANCE_LABEL[event.currentUserAttendance]}
                </span>
              </div>
            ) : (
              <span className="text-xs text-gray-400">Respond</span>
            )}
            {countParts && (
              <span className="text-xs text-gray-400 shrink-0">{countParts}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
