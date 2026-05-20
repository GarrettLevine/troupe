import { useNavigate } from 'react-router-dom';
import { FeedEvent } from '../hooks/useEventFeed';
import { TroupeBadge } from './TroupeBadge';
import { EVENT_TYPE_STYLES } from '../lib/constants';
import { formatEventDate } from '../lib/utils';

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
      <div className="flex items-start gap-3">
        <TroupeBadge troupe={event.troupe} size="thumbnail" className="shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
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
        </div>
      </div>
    </button>
  );
}
