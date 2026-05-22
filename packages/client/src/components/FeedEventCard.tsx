import { FeedEvent } from '../hooks/useEventFeed';
import { TroupeBadge } from './TroupeBadge';
import { EVENT_TYPE_STYLES } from '../lib/constants';

function formatCompactDate(isoString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoString));
}

function formatTime(isoString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoString));
}

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
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-semibold text-gray-900 text-sm leading-snug truncate flex-1">{event.name}</h4>
            <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{formatCompactDate(event.eventAt)}</span>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {isCancelled && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                Cancelled
              </span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${EVENT_TYPE_STYLES[event.eventType]}`}>
              {event.eventType === 'show' ? 'Show' : 'Rehearsal'}
            </span>
          </div>

          {callDurationLine && (
            <p className="text-xs text-gray-500">{callDurationLine}</p>
          )}

          <p className="text-xs text-gray-500">Location: {event.location}</p>
        </div>
      </div>
    </button>
  );
}
