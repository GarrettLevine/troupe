import { FeedEvent } from '../hooks/useEventFeed';
import { TroupeBadge } from './TroupeBadge';
import { EVENT_TYPE_STYLES } from '../lib/constants';
import { formatCompactDate, formatTime } from '../lib/utils';

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
            <span className="text-xs text-gray-500">{callDurationLine || ' '}</span>
            <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{formatCompactDate(event.eventAt)}</span>
          </div>

          {/* Row 3: location */}
          <p className="text-xs text-gray-500">Location: {event.location}</p>
        </div>
      </div>
    </button>
  );
}
