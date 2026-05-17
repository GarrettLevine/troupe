import { useState, useRef, useEffect } from 'react';
import { TroupeEvent } from '../hooks/useEvents';
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

interface EventCardProps {
  event: TroupeEvent;
}

export function EventCard({ event }: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const detailsRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (!expanded) {
      const el = detailsRef.current;
      if (el) setIsClamped(el.scrollHeight > el.clientHeight);
    }
  }, [event.details, expanded]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2">
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
      {event.details && (
        <div>
          <p
            ref={detailsRef}
            className={`text-xs text-gray-600 leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}
          >
            {event.details}
          </p>
          {isClamped && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-violet-600 hover:text-violet-700 mt-0.5 transition-colors"
            >
              Show more
            </button>
          )}
          {expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="text-xs text-violet-600 hover:text-violet-700 mt-0.5 transition-colors"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
}
