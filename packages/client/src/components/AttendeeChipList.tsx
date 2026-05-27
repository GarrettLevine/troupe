import { AttendeeChip } from '../hooks/useEvents';
import { hashColor, ChipColorScheme, CHIP_COLOR_LABEL } from '../lib/constants';

interface AttendeeChipListProps {
  label: string;
  attendees: AttendeeChip[];
  colorScheme: ChipColorScheme;
  maxVisible?: number;
}

export function AttendeeChipList({ label, attendees, colorScheme, maxVisible = 8 }: AttendeeChipListProps) {
  if (attendees.length === 0) return null;

  const visible = attendees.slice(0, maxVisible);
  const overflow = attendees.length - maxVisible;

  return (
    <div className="flex flex-col gap-1.5">
      <p className={`text-xs font-semibold ${CHIP_COLOR_LABEL[colorScheme]}`}>
        {label} · {attendees.length}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((chip) => (
          <div
            key={chip.userId}
            title={chip.displayName}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0 ${hashColor(chip.userId)}`}
          >
            {chip.initials}
          </div>
        ))}
        {overflow > 0 && (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold text-gray-600 bg-gray-100 shrink-0">
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
