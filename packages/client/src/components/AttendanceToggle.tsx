import { AttendanceStatus } from '../hooks/useEvents';
import { ATTENDANCE_OPTIONS } from '../lib/constants';

interface AttendanceToggleProps {
  value: AttendanceStatus | null;
  onChange: (status: AttendanceStatus | null) => void;
  loading: boolean;
  disabled: boolean;
}

export function AttendanceToggle({ value, onChange, loading, disabled }: AttendanceToggleProps) {
  return (
    <div
      className={`grid grid-cols-2 gap-1.5 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={disabled ? 'Cannot update attendance for a cancelled event' : undefined}
    >
      {ATTENDANCE_OPTIONS.map((opt) => {
        const isActive = value === opt.status;
        const isSpinning = loading && isActive;
        return (
          <button
            key={opt.status}
            type="button"
            disabled={disabled || loading}
            onClick={() => onChange(isActive ? null : opt.status)}
            className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-1.5
              ${isActive ? opt.activeClass : opt.inactiveClass}
              disabled:cursor-not-allowed`}
          >
            {isSpinning && (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
