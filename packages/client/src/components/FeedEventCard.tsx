import { useNavigate } from 'react-router-dom';
import { FeedEvent } from '../hooks/useEventFeed';
import { TroupeBadge } from './TroupeBadge';
import { EVENT_TYPE_STYLES } from '../lib/constants';

function formatEventDate(eventAt: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(eventAt));
}

interface FeedEventCardProps {
  event: FeedEvent;
}

export function FeedEventCard({ event }: FeedEventCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/troupes/${event.troupe.id}`)}
      className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 hover:bg-gray-50 transition-colors active:bg-gray-100"
    >
      <div className="flex items-center gap-2">
        <TroupeBadge troupe={event.troupe} size="thumbnail" />
        <span className="text-xs font-medium text-gray-500 truncate">{event.troupe.name}</span>
      </div>
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-gray-900 text-sm leading-snug">{event.name}</h4>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${EVENT_TYPE_STYLES[event.eventType]}`}
        >
          {event.eventType === 'show' ? 'Show' : 'Rehearsal'}
        </span>
      </div>
      <p className="text-xs text-gray-500">{formatEventDate(event.eventAt)}</p>
      <p className="text-xs text-gray-500">{event.location}</p>
    </button>
  );
}
