import { TroupeEvent } from '../hooks/useEvents';
import { EVENT_TYPE_STYLES } from '../lib/constants';
import { formatCompactDate, formatTime } from '../lib/utils';

interface EventCardProps {
  event: TroupeEvent;
  onClick?: () => void;
}

export function EventCard({ event, onClick }: EventCardProps) {
  const isCancelled = event.status === 'cancelled';

  const callDurationLine = [
    event.eventType === 'show' && event.callTime ? `Call time: ${formatTime(event.callTime)}` : null,
    event.durationFormatted ? `Duration: ${event.durationFormatted}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 transition-colors ${
        onClick ? 'hover:bg-gray-50 active:bg-gray-100' : 'cursor-default'
      } ${isCancelled ? 'opacity-50' : ''}`}
    >
      {/* Row 1: title + badge */}
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-semibold text-gray-900 text-sm leading-snug flex-1 min-w-0">{event.name}</h4>
        <div className="flex gap-1 shrink-0">
          {isCancelled && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              Cancelled
            </span>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${EVENT_TYPE_STYLES[event.eventType]}`}>
            {event.eventType === 'show' ? 'Show' : 'Rehearsal'}
          </span>
        </div>
      </div>

      {/* Row 2: call time / duration (left) + date (right) */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-gray-500">{callDurationLine || ' '}</span>
        <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{formatCompactDate(event.eventAt)}</span>
      </div>

      {/* Row 3: location */}
      <p className="text-xs text-gray-500">Location: {event.location}</p>

      {/* Row 4: details */}
      {event.details && (
        <p className="text-xs text-gray-600">{event.details}</p>
      )}
    </button>
  );
}
