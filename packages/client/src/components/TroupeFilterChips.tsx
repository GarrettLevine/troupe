import { useRef, useEffect } from 'react';
import { TroupeSummary } from '../hooks/useTroupes';
import { TroupeBadge } from './TroupeBadge';

interface TroupeFilterChipsProps {
  troupes: TroupeSummary[];
  activeTroupeId: string | null;
  onChange: (troupeId: string | null) => void;
}

export function TroupeFilterChips({ troupes, activeTroupeId, onChange }: TroupeFilterChipsProps) {
  const allChipRef = useRef<HTMLButtonElement | null>(null);
  const activeChipRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const ref = activeTroupeId === null ? allChipRef : activeChipRef;
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTroupeId]);

  const handleClick = (troupeId: string | null) => {
    onChange(troupeId === activeTroupeId ? null : troupeId);
  };

  return (
    <div
      className="flex gap-2 overflow-x-auto py-1 px-0.5"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <button
        ref={allChipRef}
        onClick={() => handleClick(null)}
        className="shrink-0"
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ring-2 ring-offset-2 transition-all ${
            activeTroupeId === null
              ? 'bg-violet-600 ring-violet-600'
              : 'bg-gray-100 ring-transparent'
          }`}
        >
          <span
            className={`text-[10px] font-semibold ${
              activeTroupeId === null ? 'text-white' : 'text-gray-500'
            }`}
          >
            All
          </span>
        </div>
      </button>

      {troupes.map((troupe) => {
        const isActive = troupe.id === activeTroupeId;
        return (
          <button
            key={troupe.id}
            ref={isActive ? activeChipRef : undefined}
            onClick={() => handleClick(troupe.id)}
            className="shrink-0"
          >
            <div
              className={`rounded-full ring-2 ring-offset-2 transition-all ${
                isActive ? 'ring-violet-600' : 'ring-transparent'
              }`}
            >
              <TroupeBadge troupe={troupe} size="xs" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
